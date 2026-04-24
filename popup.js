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

// popup.js — UI layer; delegates operations to background worker.

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
      if (!res) return reject(new Error('No response from background worker'));
      if (!res.ok) return reject(new Error(res.error || 'Unknown error'));
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

function hideStatus() {
  $('status').className = 'status hidden';
}

// ---------- DOM helpers ----------

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function makeEl(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent != null) el.textContent = textContent;
  return el;
}

function setEmptyState(el, text) {
  clearChildren(el);
  el.appendChild(makeEl('div', 'list-empty', text));
}

// ---------- Loading ----------

async function loadChats() {
  setEmptyState($('chatsList'), 'Loading…');
  try {
    const { chats } = await send('loadChats');
    state.chats = chats;
    const { selectedChats = [] } = await chrome.storage.local.get(['selectedChats']);
    state.selected = new Set(selectedChats.filter((uuid) => chats.some((c) => c.uuid === uuid)));
    renderChats();
  } catch (e) {
    setEmptyState($('chatsList'), e.message);
    if (e.message.includes('401') || e.message.includes('logged in')) {
      showStatus('Please log in to claude.ai first.', 'err');
    }
  }
}

async function loadActivity() {
  const { activity = [] } = await chrome.storage.local.get(['activity']);
  const el = $('activity');
  clearChildren(el);
  if (activity.length === 0) {
    el.appendChild(makeEl('div', 'list-empty', 'No activity yet'));
    return;
  }
  for (const a of activity) {
    const item = makeEl('div', 'activity-item');
    item.appendChild(makeEl('span', null, a.icon));
    item.appendChild(makeEl('span', null, a.message));
    item.appendChild(makeEl('span', 'activity-time', a.time));
    el.appendChild(item);
  }
}

// ---------- Rendering ----------

function renderChats() {
  $('chatCount').textContent = state.chats.length;
  const el = $('chatsList');
  clearChildren(el);
  if (state.chats.length === 0) {
    el.appendChild(makeEl('div', 'list-empty', 'No chats found'));
    updateButtons();
    return;
  }
  for (const c of state.chats) {
    const date = c.updated_at ? new Date(c.updated_at).toLocaleDateString() : '';

    const item = makeEl('div', 'chat-item');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.uuid = c.uuid;
    cb.checked = state.selected.has(c.uuid);
    cb.addEventListener('change', async () => {
      if (cb.checked) state.selected.add(c.uuid);
      else state.selected.delete(c.uuid);
      await chrome.storage.local.set({ selectedChats: [...state.selected] });
      updateButtons();
    });

    const body = makeEl('div', 'chat-item-body');
    body.appendChild(makeEl('span', 'chat-item-title', c.name));
    body.appendChild(makeEl('span', 'chat-item-meta', date));

    item.appendChild(cb);
    item.appendChild(body);
    el.appendChild(item);
  }
  updateButtons();
}

async function updateButtons() {
  const { githubToken } = await chrome.storage.local.get(['githubToken']);
  const btn = $('syncBtn');
  btn.disabled = state.selected.size === 0 || !githubToken;
  btn.textContent = state.selected.size > 0
    ? `Archive (${state.selected.size})`
    : 'Archive';
}

// ---------- Settings (opens in a tab) ----------

function openOptions() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
}

// ---------- Actions ----------

async function syncSelected() {
  showStatus('Archiving…');
  try {
    const { result } = await send('syncSelected');
    const attInfo = result.attachmentsUploaded > 0
      ? `, ${result.attachmentsUploaded} attachments`
      : '';
    showStatus(
      `✓ ${result.created} new, ${result.updated} updated, ${result.skipped} skipped${attInfo}`,
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

// ---------- Consent handling ----------

async function checkConsent() {
  const { consentAccepted } = await chrome.storage.local.get(['consentAccepted']);
  if (consentAccepted) {
    $('consentScreen').classList.add('hidden');
    $('mainUI').classList.remove('hidden');
    return true;
  }
  $('consentScreen').classList.remove('hidden');
  $('mainUI').classList.add('hidden');
  return false;
}

async function acceptConsent() {
  await chrome.storage.local.set({
    consentAccepted: true,
    consentAcceptedAt: new Date().toISOString(),
  });
  $('consentScreen').classList.add('hidden');
  $('mainUI').classList.remove('hidden');
  loadChats();
  loadActivity();
}

function declineConsent() {
  window.close();
}

// ---------- Init ----------

document.addEventListener('DOMContentLoaded', async () => {
  $('settingsBtn').addEventListener('click', openOptions);
  $('reloadBtn').addEventListener('click', loadChats);
  $('syncBtn').addEventListener('click', syncSelected);
  $('selectAllBtn').addEventListener('click', selectAll);
  $('clearBtn').addEventListener('click', clearSelection);
  $('consentAcceptBtn').addEventListener('click', acceptConsent);
  $('consentDeclineBtn').addEventListener('click', declineConsent);

  const hasConsent = await checkConsent();
  if (hasConsent) {
    loadChats();
    loadActivity();
  }
});
