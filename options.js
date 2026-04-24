/*
 * Copyright 2026 Blackswan99
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

const $ = (id) => document.getElementById(id);

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

function showStatus(msg, kind = '') {
  const el = $('status');
  el.textContent = msg;
  el.className = 'status ' + kind;
}

function hideStatus() {
  $('status').className = 'status hidden';
}

async function loadSettings() {
  const cfg = await chrome.storage.local.get([
    'githubToken', 'repoUrl', 'chatsPath', 'syncInterval', 'autoArchive',
    'maxAttachmentMB', 'includeAttachments',
  ]);
  $('githubToken').value = cfg.githubToken || '';
  $('repoUrl').value = cfg.repoUrl || '';
  $('chatsPath').value = cfg.chatsPath || 'chats';
  $('syncInterval').value = cfg.syncInterval || 60;
  $('autoArchive').checked = !!cfg.autoArchive;
  $('maxAttachmentMB').value = cfg.maxAttachmentMB || 10;
  $('includeAttachments').checked = cfg.includeAttachments !== false;
}

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
    showStatus('Token and Repository are required.', 'err');
    return;
  }

  showStatus('Saving…');
  try {
    await chrome.storage.local.set(payload);
    // Verify
    const verify = await chrome.storage.local.get(['githubToken']);
    if (verify.githubToken !== payload.githubToken) {
      throw new Error('Verification failed: storage did not persist the expected value.');
    }
    // Inform background (non-blocking)
    send('saveSettings', payload).catch((e) => {
      console.warn('[Archiver] Background notify failed (non-critical):', e.message);
    });
    showStatus('✓ Settings saved.', 'ok');
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
  if (!payload.githubToken || !payload.repoUrl) {
    showStatus('Please enter Token and Repository first.', 'err');
    return;
  }
  showStatus('Testing connection…');
  try {
    const { info } = await send('validateSettings', payload);
    const emptyNote = info.empty ? ' (repository is empty — will be initialized on first sync)' : '';
    showStatus(`✓ Claude + GitHub reachable — Branch: ${info.branch}${emptyNote}`, 'ok');
  } catch (e) {
    showStatus('✗ ' + e.message, 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('saveBtn').addEventListener('click', saveSettings);
  $('testBtn').addEventListener('click', testSettings);
  loadSettings();
});
