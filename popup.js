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

// popup.js — UI-Layer, delegiert alles an Background

const state = {
  chats: [],
  selected: new Set(),
};

const $ = (id) => document.getElementById(id);

// ---------- Messaging ----------

function send(action, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, payload }, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res) return reject(new Error('Keine Antwort vom Background'));
      if (!res.ok) return reject(new Error(res.error || 'Unbekannter Fehler'));
      resolve(res);
    });
  });
}

// ---------- Status ----------

function showStatus(msg, kind = '') {
  const el = $('status');
  el.textContent = msg;
  el.className = 'status ' + kind;
}
function hideStatus() { $('status').className = 'status hidden'; }

// ---------- Laden ----------

async function loadChats() {
  $('chatsList').innerHTML = '<div class="list-empty">Lade…</div>';
  try {
    const { chats } = await send('loadChats');
    state.chats = chats;
    // gespeicherte Auswahl restaurieren
    const { selectedChats = [] } = await chrome.storage.local.get(['selectedChats']);
    state.selected = new Set(selectedChats.filter((uuid) => chats.some((c) => c.uuid === uuid)));
    renderChats();
  } catch (e) {
    $('chatsList').innerHTML = `<div class="list-empty">${e.message}</div>`;
    if (e.message.includes('401') || e.message.includes('eingeloggt')) {
      showStatus('Bitte bei claude.ai einloggen', 'err');
    }
  }
}

async function loadActivity() {
  const { activity = [] } = await chrome.storage.local.get(['activity']);
  const el = $('activity');
  if (activity.length === 0) {
    el.innerHTML = '<div class="list-empty">Keine Aktivität</div>';
    return;
  }
  el.innerHTML = activity
    .map((a) => `
      <div class="activity-item">
        <span>${a.icon}</span>
        <span>${escapeHtml(a.message)}</span>
        <span class="activity-time">${a.time}</span>
      </div>
    `)
    .join('');
}

// ---------- Rendering ----------

function renderChats() {
  $('chatCount').textContent = state.chats.length;
  const el = $('chatsList');
  if (state.chats.length === 0) {
    el.innerHTML = '<div class="list-empty">Keine Chats gefunden</div>';
    updateButtons();
    return;
  }
  el.innerHTML = state.chats
    .map((c) => {
      const checked = state.selected.has(c.uuid) ? 'checked' : '';
      const date = c.updated_at ? new Date(c.updated_at).toLocaleDateString('de-DE') : '';
      return `
        <div class="chat-item">
          <input type="checkbox" data-uuid="${c.uuid}" ${checked} />
          <div class="chat-item-body">
            <span class="chat-item-title">${escapeHtml(c.name)}</span>
            <span class="chat-item-meta">${date}</span>
          </div>
        </div>
      `;
    })
    .join('');
  el.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const uuid = cb.dataset.uuid;
      if (cb.checked) state.selected.add(uuid);
      else state.selected.delete(uuid);
      await chrome.storage.local.set({ selectedChats: [...state.selected] });
      updateButtons();
    });
  });
  updateButtons();
}

async function updateButtons() {
  const { githubToken } = await chrome.storage.local.get(['githubToken']);
  $('syncBtn').disabled = state.selected.size === 0 || !githubToken;
  $('syncBtn').textContent = `📤 Archivieren (${state.selected.size})`;
}

// ---------- Settings ----------

async function openSettings() {
  const cfg = await chrome.storage.local.get([
    'githubToken', 'repoUrl', 'chatsPath', 'syncInterval', 'autoArchive',
    'maxAttachmentMB', 'includeAttachments',
  ]);
  console.log('[Archiver] openSettings — loaded from storage:', {
    ...cfg,
    githubToken: cfg.githubToken ? `${cfg.githubToken.slice(0, 8)}…(${cfg.githubToken.length} chars)` : '(leer)',
    repoUrl: cfg.repoUrl || '(leer)',
  });
  $('githubToken').value = cfg.githubToken || '';
  $('repoUrl').value = cfg.repoUrl || '';
  $('chatsPath').value = cfg.chatsPath || 'chats';
  $('syncInterval').value = cfg.syncInterval || 60;
  $('autoArchive').checked = !!cfg.autoArchive;
  $('maxAttachmentMB').value = cfg.maxAttachmentMB || 10;
  $('includeAttachments').checked = cfg.includeAttachments !== false;
  $('settingsModal').classList.remove('hidden');
}

function closeSettings() { $('settingsModal').classList.add('hidden'); }

async function saveSettings() {
  const payload = {
    githubToken: $('githubToken').value.trim(),
    repoUrl: $('repoUrl').value.trim(),
    chatsPath: $('chatsPath').value.trim() || 'chats',
    syncInterval: Math.max(15, parseInt($('syncInterval').value, 10) || 60),
    autoArchive: $('autoArchive').checked,
    maxAttachmentMB: Math.max(1, Math.min(100, parseInt($('maxAttachmentMB').value, 10) || 10)),
    includeAttachments: $('includeAttachments').checked,
  };
  if (!payload.githubToken || !payload.repoUrl) {
    showStatus('Token und Repo sind Pflicht', 'err');
    return;
  }

  showStatus('Speichere…');
  console.log('[Archiver] saveSettings payload:', {
    ...payload,
    githubToken: payload.githubToken ? `${payload.githubToken.slice(0, 8)}…` : '',
  });

  try {
    // Direkt im Popup-Kontext schreiben — unabhängig vom Background-Worker
    await chrome.storage.local.set(payload);
    console.log('[Archiver] storage.local.set done');

    // Verifizieren durch sofortiges Re-Read
    const verify = await chrome.storage.local.get(Object.keys(payload));
    console.log('[Archiver] verify read:', {
      ...verify,
      githubToken: verify.githubToken ? `${verify.githubToken.slice(0, 8)}…` : '(leer!)',
    });

    if (!verify.githubToken || verify.githubToken !== payload.githubToken) {
      throw new Error('Verifikation fehlgeschlagen: Storage hat nicht den erwarteten Wert zurückgegeben');
    }

    // Parallel: Background informieren (Alarm rescheduling) — Fehler hier ignorieren
    send('saveSettings', payload).catch((e) => {
      console.warn('[Archiver] Background-Notify fehlgeschlagen (unkritisch):', e.message);
    });

    showStatus('✓ Gespeichert', 'ok');
    setTimeout(() => {
      closeSettings();
      hideStatus();
      updateButtons();
    }, 700);
  } catch (e) {
    console.error('[Archiver] saveSettings error:', e);
    showStatus('✗ ' + e.message, 'err');
  }
}

async function testSettings() {
  const payload = {
    githubToken: $('githubToken').value.trim(),
    repoUrl: $('repoUrl').value.trim(),
  };
  showStatus('Teste Verbindung…');
  try {
    const { info } = await send('validateSettings', payload);
    const branchInfo = `Branch: ${info.branch}${info.empty ? ' (Repo leer, wird beim Sync initialisiert)' : ''}`;
    showStatus(`✓ Claude + GitHub OK — ${branchInfo}`, 'ok');
  } catch (e) {
    showStatus('✗ ' + e.message, 'err');
  }
}

// ---------- Aktionen ----------

async function syncSelected() {
  showStatus('Archiviere…');
  try {
    const { result } = await send('syncSelected');
    const attInfo = result.attachmentsUploaded > 0
      ? `, ${result.attachmentsUploaded} Anhänge`
      : '';
    showStatus(
      `✓ ${result.created} neu, ${result.updated} aktualisiert, ${result.skipped} übersprungen${attInfo}`,
      'ok'
    );
    await loadActivity();
  } catch (e) {
    showStatus('✗ ' + e.message, 'err');
  }
}

function selectAll() {
  state.selected = new Set(state.chats.map((c) => c.uuid));
  chrome.storage.local.set({ selectedChats: [...state.selected] });
  renderChats();
}

function clearSelection() {
  state.selected.clear();
  chrome.storage.local.set({ selectedChats: [] });
  renderChats();
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ---------- Init ----------

document.addEventListener('DOMContentLoaded', () => {
  $('settingsBtn').addEventListener('click', openSettings);
  $('closeSettingsBtn').addEventListener('click', closeSettings);
  $('saveSettingsBtn').addEventListener('click', saveSettings);
  $('testBtn').addEventListener('click', testSettings);
  $('reloadBtn').addEventListener('click', loadChats);
  $('syncBtn').addEventListener('click', syncSelected);
  $('selectAllBtn').addEventListener('click', selectAll);
  $('clearBtn').addEventListener('click', clearSelection);

  loadChats();
  loadActivity();
});
