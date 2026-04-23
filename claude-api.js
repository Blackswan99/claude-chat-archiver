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

// claude-api.js — Interne Claude.ai-API
// Auth erfolgt via sessionKey-Cookie, das der Browser automatisch mitschickt,
// solange host_permissions für claude.ai/* gesetzt sind.

const BASE = 'https://claude.ai/api';

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Claude API ${res.status}: ${path}`);
  }
  return res.json();
}

export async function getOrganizations() {
  return apiFetch('/organizations');
}

/**
 * Liefert alle Chats der Org als kompakte Liste.
 * Felder: uuid, name, summary, created_at, updated_at
 */
export async function listConversations(orgId) {
  return apiFetch(`/organizations/${orgId}/chat_conversations`);
}

/**
 * Voller Chat mit allen Nachrichten (chat_messages) inkl. attachments.
 */
export async function getConversation(orgId, convUuid) {
  return apiFetch(
    `/organizations/${orgId}/chat_conversations/${convUuid}?tree=True&rendering_mode=messages`
  );
}

/**
 * Prüft, ob der User eingeloggt ist. Wirft bei 401/403.
 */
export async function checkAuth() {
  const orgs = await getOrganizations();
  if (!Array.isArray(orgs) || orgs.length === 0) {
    throw new Error('Keine Organisation gefunden — bist du bei claude.ai eingeloggt?');
  }
  return orgs;
}

/**
 * Lädt eine Binärdatei (z.B. User-Upload) von der Claude-API.
 * URL-Formate, die wir unterstützen:
 *   - /api/organizations/{orgId}/files/{fileUuid}/content
 *   - Absolute URLs (für generated assets / tool outputs)
 * Gibt ArrayBuffer zurück oder null bei Fehler.
 */
export async function downloadFile(url) {
  // Relative URL → absolut machen
  const fullUrl = url.startsWith('http') ? url : `https://claude.ai${url}`;
  try {
    const res = await fetch(fullUrl, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) {
      console.warn(`downloadFile ${res.status}: ${fullUrl}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`downloadFile error: ${e.message}`);
    return null;
  }
}
