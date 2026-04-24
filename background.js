/*
 * Copyright 2026 Blackswan99
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// background.js — Service Worker, zentrale Logik

import * as Claude from './claude-api.js';
import * as GH from './github.js';
import { conversationToMarkdown, slugify, sha256Hex } from './markdown.js';
import { extractAllAttachments, toBase64 } from './attachments.js';

// Convenience: wandelt ein Attachment-Objekt in base64 um (string oder ArrayBuffer).
function toAttachmentBase64(att) {
  if (att.binary || att.content instanceof ArrayBuffer) {
    return toBase64(att.content);
  }
  // String-Content
  return toBase64(att.content);
}

const ALARM_NAME = 'archiveSync';

// ---------- Install & Alarm-Setup ----------

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(['syncInterval', 'activity']);
  await chrome.storage.local.set({
    syncInterval: stored.syncInterval ?? 60,
    activity: stored.activity ?? [],
  });
  await rescheduleAlarm();
});

chrome.runtime.onStartup.addListener(rescheduleAlarm);

chrome.storage.onChanged.addListener((changes) => {
  if (changes.syncInterval || changes.autoArchive) rescheduleAlarm();
});

async function rescheduleAlarm() {
  await chrome.alarms.clear(ALARM_NAME);
  const { syncInterval = 60, autoArchive } = await chrome.storage.local.get([
    'syncInterval',
    'autoArchive',
  ]);
  if (autoArchive) {
    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: Math.max(15, syncInterval), // Chrome min = 1, aber 15 sinnvoll
    });
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  try {
    await runSync({ selectedOnly: true });
  } catch (e) {
    await logActivity(`Auto-Sync Fehler: ${e.message}`, '❌');
  }
});

// ---------- Message-Router für Popup ----------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.action === 'loadChats') {
        const chats = await loadChats();
        sendResponse({ ok: true, chats });
      } else if (msg.action === 'validateSettings') {
        const info = await validateSettings(msg.payload);
        sendResponse({ ok: true, info });
      } else if (msg.action === 'saveSettings') {
        await saveSettingsInWorker(msg.payload);
        sendResponse({ ok: true });
      } else if (msg.action === 'syncSelected') {
        const result = await runSync({ selectedOnly: true });
        sendResponse({ ok: true, result });
      } else if (msg.action === 'syncAll') {
        const result = await runSync({ selectedOnly: false });
        sendResponse({ ok: true, result });
      } else {
        sendResponse({ ok: false, error: 'unknown action' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true; // async response
});

// ---------- Kern-Flows ----------

async function loadChats() {
  const orgs = await Claude.checkAuth();
  const orgId = orgs[0].uuid;
  const convs = await Claude.listConversations(orgId);

  await chrome.storage.local.set({ orgId, lastChatList: Date.now() });

  return convs.map((c) => ({
    uuid: c.uuid,
    name: c.name || '(Untitled)',
    updated_at: c.updated_at,
    created_at: c.created_at,
  }));
}

async function validateSettings({ githubToken, repoUrl }) {
  const { owner, repo } = GH.parseRepoUrl(repoUrl);
  const meta = await GH.validateRepo(githubToken, owner, repo);
  await Claude.checkAuth();
  return {
    branch: meta.default_branch || 'main',
    empty: !(await GH.isRepoInitialized(githubToken, owner, repo, meta.default_branch || 'main')),
  };
}

/**
 * Speichert Settings im Worker-Kontext — unabhängig vom Popup-Lebenszyklus.
 * Wirft nur, wenn das Storage-API selbst fehlschlägt.
 */
async function saveSettingsInWorker(payload) {
  await chrome.storage.local.set(payload);
  // Trigger alarm reschedule wenn Interval/AutoArchive geändert
  await rescheduleAlarm();
}

async function runSync({ selectedOnly }) {
  // Safety check: Consent required before any data transmission
  const { consentAccepted } = await chrome.storage.local.get(['consentAccepted']);
  if (!consentAccepted) {
    throw new Error('Zustimmung zur Datenübertragung fehlt — bitte Extension-Popup öffnen.');
  }

  const cfg = await chrome.storage.local.get([
    'githubToken',
    'repoUrl',
    'selectedChats',
    'orgId',
    'chatsPath',
    'syncedHashes',
    'defaultBranch',
    'maxAttachmentMB',
    'includeAttachments',
  ]);

  if (!cfg.githubToken || !cfg.repoUrl) throw new Error('GitHub nicht konfiguriert');

  const { owner, repo } = GH.parseRepoUrl(cfg.repoUrl);
  const basePath = (cfg.chatsPath || 'chats').replace(/^\/|\/$/g, '');

  // Default-Branch ermitteln (einmalig pro Sync, wird gecacht)
  const branch = await GH.getDefaultBranch(cfg.githubToken, owner, repo);

  // Falls Repo noch komplett leer ist → Initial-Commit
  const initialized = await GH.isRepoInitialized(cfg.githubToken, owner, repo, branch);
  if (!initialized) {
    await logActivity('Repo ist leer — lege Initial-Commit an', 'ℹ️');
    await GH.bootstrapRepo(cfg.githubToken, owner, repo, branch);
  }

  await chrome.storage.local.set({ defaultBranch: branch });

  // Chats bestimmen
  let orgId = cfg.orgId;
  if (!orgId) {
    const orgs = await Claude.checkAuth();
    orgId = orgs[0].uuid;
  }
  const allConvs = await Claude.listConversations(orgId);

  const selected = new Set(cfg.selectedChats || []);
  const targets = selectedOnly
    ? allConvs.filter((c) => selected.has(c.uuid))
    : allConvs;

  if (targets.length === 0) {
    await logActivity('Keine Chats zum Archivieren', 'ℹ️');
    return { created: 0, updated: 0, skipped: 0 };
  }

  const hashes = cfg.syncedHashes || {};
  let created = 0, updated = 0, skipped = 0, errors = 0;
  let attachmentsUploaded = 0, attachmentsSkipped = 0;

  for (const conv of targets) {
    try {
      // Inkrementell: wenn updated_at sich nicht geändert hat, überspringen
      const cached = hashes[conv.uuid];
      if (cached && cached.updated_at === conv.updated_at) {
        skipped++;
        continue;
      }

      const full = await Claude.getConversation(orgId, conv.uuid);

      // Attachments extrahieren und nachladen (wenn aktiviert)
      const attachmentMeta = cfg.includeAttachments !== false
        ? await extractAllAttachments(full, {
            maxBytes: (cfg.maxAttachmentMB || 10) * 1024 * 1024,
          })
        : { attachments: [], skipped: [] };

      const md = conversationToMarkdown(full, attachmentMeta);
      const hash = await sha256Hex(md);

      if (cached && cached.hash === hash && attachmentMeta.attachments.length === 0) {
        hashes[conv.uuid] = { ...cached, updated_at: conv.updated_at };
        skipped++;
        continue;
      }

      // Chat bekommt eigenen Ordner
      const datePrefix = (conv.created_at || '').slice(0, 10) || 'undated';
      const chatDir = `${basePath}/${datePrefix}_${slugify(conv.name)}_${conv.uuid.slice(0, 8)}`;
      const chatPath = `${chatDir}/chat.md`;

      // 1. Chat.md hochladen
      const { action } = await GH.putFile(
        cfg.githubToken,
        owner,
        repo,
        chatPath,
        md,
        `Archive: ${conv.name || conv.uuid}`,
        branch
      );

      // 2. Alle Attachments hochladen
      for (const att of attachmentMeta.attachments) {
        try {
          const attPath = `${chatDir}/${att.path}`;
          const b64 = toAttachmentBase64(att);
          await GH.putFileBase64(
            cfg.githubToken,
            owner,
            repo,
            attPath,
            b64,
            `Attachment for: ${conv.name || conv.uuid}`,
            branch
          );
          attachmentsUploaded++;
        } catch (e) {
          attachmentsSkipped++;
          console.warn(`Attachment upload failed: ${att.name}`, e.message);
        }
      }

      attachmentsSkipped += attachmentMeta.skipped.length;

      hashes[conv.uuid] = { hash, updated_at: conv.updated_at, path: chatPath };
      if (action === 'created') created++;
      else updated++;
    } catch (e) {
      errors++;
      await logActivity(`Fehler bei ${conv.name}: ${e.message}`, '⚠️');
    }
  }

  await chrome.storage.local.set({ syncedHashes: hashes, lastSync: Date.now() });
  const attInfo = attachmentsUploaded > 0 || attachmentsSkipped > 0
    ? `, ${attachmentsUploaded} Anhänge${attachmentsSkipped ? ` (${attachmentsSkipped} skipped)` : ''}`
    : '';
  await logActivity(
    `Sync: +${created} neu, ~${updated} aktualisiert, ${skipped} übersprungen${attInfo}${errors ? `, ${errors} Fehler` : ''}`,
    errors ? '⚠️' : '✅'
  );

  return { created, updated, skipped, errors, attachmentsUploaded, attachmentsSkipped };
}

async function logActivity(message, icon = '•') {
  const { activity = [] } = await chrome.storage.local.get(['activity']);
  activity.unshift({
    message,
    icon,
    time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    ts: Date.now(),
  });
  await chrome.storage.local.set({ activity: activity.slice(0, 20) });
}
