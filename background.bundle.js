// AUTO-GENERATED BUNDLE — DO NOT EDIT DIRECTLY
// Original sources: claude-api.js, markdown.js, github.js, attachments.js, background.js
// Build: simple concat with import/export stripping


// ==================== markdown.js ====================
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

// markdown.js — Konvertiert ein Claude-Conversation-Objekt in Markdown.

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString();
  } catch {
    return iso;
  }
}

/**
 * Extrahiert Textinhalt aus einem Message-Content-Block.
 * Claude-Messages haben oft `content: [{type: "text", text: "..."}, ...]`.
 */
function extractMessageText(msg) {
  // Fall 1: Neues Format mit content-Array
  if (Array.isArray(msg.content)) {
    return msg.content
      .map((block) => {
        if (block.type === 'text') return block.text || '';
        if (block.type === 'tool_use') {
          return `\n\`\`\`tool_use (${block.name || 'unknown'})\n${JSON.stringify(block.input || {}, null, 2)}\n\`\`\`\n`;
        }
        if (block.type === 'tool_result') {
          const content = typeof block.content === 'string'
            ? block.content
            : JSON.stringify(block.content, null, 2);
          return `\n\`\`\`tool_result\n${content}\n\`\`\`\n`;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  // Fall 2: Legacy-Format mit text-Feld
  if (typeof msg.text === 'string') return msg.text;
  return '';
}

function formatAttachments(msg) {
  if (!msg.attachments || msg.attachments.length === 0) return '';
  const lines = msg.attachments.map((a) => {
    const name = a.file_name || a.name || 'attachment';
    const size = a.file_size ? ` (${a.file_size} bytes)` : '';
    return `- 📎 \`${name}\`${size}`;
  });
  return '\n\n**Attachments:**\n' + lines.join('\n');
}

/**
 * Rendert einen Attachment-Index am Anfang der Markdown-Datei.
 * Zeigt klickbare Links zu den Dateien im attachments/-Ordner.
 */
function renderAttachmentIndex(attachments, skipped) {
  if (!attachments || attachments.length === 0) {
    if (skipped && skipped.length > 0) {
      return `\n> ⚠️ ${skipped.length} Anhänge konnten nicht archiviert werden.\n`;
    }
    return '';
  }

  const bySource = { user_upload: [], artifact: [], tool_output: [], user_upload_text: [], tool_output_ref: [] };
  for (const a of attachments) {
    (bySource[a.source] || bySource.user_upload).push(a);
  }

  const lines = ['\n## 📎 Anhänge\n'];

  if (bySource.user_upload.length + bySource.user_upload_text.length > 0) {
    lines.push('**User-Uploads:**');
    for (const a of [...bySource.user_upload, ...bySource.user_upload_text]) {
      lines.push(`- [\`${a.name}\`](${a.path})`);
    }
    lines.push('');
  }

  if (bySource.artifact.length > 0) {
    lines.push('**Claude-Artefakte:**');
    for (const a of bySource.artifact) {
      lines.push(`- [\`${a.name}\`](${a.path})`);
    }
    lines.push('');
  }

  if (bySource.tool_output.length > 0) {
    lines.push('**Tool-Outputs:**');
    for (const a of bySource.tool_output) {
      lines.push(`- [\`${a.name}\`](${a.path})`);
    }
    lines.push('');
  }

  if (skipped && skipped.length > 0) {
    lines.push('**Übersprungen:**');
    for (const s of skipped) {
      lines.push(`- \`${s.name}\` — ${s.reason}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Wandelt eine Conversation (aus getConversation) in Markdown um.
 * Optional: attachmentMeta = { attachments, skipped } aus extractAllAttachments.
 */
function conversationToMarkdown(conv, attachmentMeta = null) {
  const messages = conv.chat_messages || [];
  const lines = [];

  // Frontmatter
  lines.push('---');
  lines.push(`title: ${JSON.stringify(conv.name || 'Untitled')}`);
  lines.push(`uuid: ${conv.uuid}`);
  lines.push(`created: ${formatDate(conv.created_at)}`);
  lines.push(`updated: ${formatDate(conv.updated_at)}`);
  if (conv.model) lines.push(`model: ${conv.model}`);
  lines.push(`messages: ${messages.length}`);
  if (attachmentMeta) {
    lines.push(`attachments: ${attachmentMeta.attachments.length}`);
  }
  lines.push('---');
  lines.push('');
  lines.push(`# ${conv.name || 'Untitled Chat'}`);
  lines.push('');
  if (conv.summary) {
    lines.push(`> ${conv.summary}`);
    lines.push('');
  }

  // Attachment-Index am Anfang (einfach zu finden beim Browsing auf GitHub)
  if (attachmentMeta) {
    lines.push(renderAttachmentIndex(attachmentMeta.attachments, attachmentMeta.skipped));
  }

  for (const msg of messages) {
    const sender = msg.sender === 'human' ? '👤 User' : '🤖 Claude';
    const ts = formatDate(msg.created_at);
    lines.push(`## ${sender}`);
    if (ts) lines.push(`*${ts}*`);
    lines.push('');
    lines.push(extractMessageText(msg));
    lines.push(formatAttachments(msg));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

function slugify(text, max = 60) {
  return (text || 'untitled')
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c]))
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max);
}

/**
 * UTF-8-sicheres Base64 (ersetzt das kaputte Buffer.from() aus v1).
 */
function toBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Simple SHA-256 als Hex — für Change-Detection (skip wenn unverändert).
 */
async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ==================== claude-api.js ====================
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

async function getOrganizations() {
  return apiFetch('/organizations');
}

/**
 * Liefert alle Chats der Org als kompakte Liste.
 * Felder: uuid, name, summary, created_at, updated_at
 */
async function listConversations(orgId) {
  return apiFetch(`/organizations/${orgId}/chat_conversations`);
}

/**
 * Voller Chat mit allen Nachrichten (chat_messages) inkl. attachments.
 */
async function getConversation(orgId, convUuid) {
  return apiFetch(
    `/organizations/${orgId}/chat_conversations/${convUuid}?tree=True&rendering_mode=messages`
  );
}

/**
 * Prüft, ob der User eingeloggt ist. Wirft bei 401/403.
 */
async function checkAuth() {
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
async function downloadFile(url) {
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

// ==================== github.js ====================
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

// github.js — Minimaler GitHub-Contents-API-Client


const GH_BASE = 'https://api.github.com';

function authHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/**
 * Holt die SHA einer existierenden Datei (nötig für Updates), null wenn nicht vorhanden.
 */
async function getFileSha(token, owner, repo, path, branch = 'main') {
  const url = `${GH_BASE}/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub SHA lookup failed: ${res.status}`);
  const data = await res.json();
  return data.sha;
}

/**
 * Erstellt oder aktualisiert eine Datei. Idempotent durch SHA-Lookup.
 * Gibt { action: 'created'|'updated'|'unchanged' } zurück.
 */
async function putFile(token, owner, repo, path, content, message, branch = 'main') {
  return putFileBase64(token, owner, repo, path, toBase64Utf8(content), message, branch);
}

/**
 * Wie putFile, aber akzeptiert bereits base64-enkodierte Daten (für Binärdateien).
 */
async function putFileBase64(token, owner, repo, path, base64Content, message, branch = 'main') {
  const existingSha = await getFileSha(token, owner, repo, path, branch);

  const body = {
    message,
    content: base64Content,
    branch,
  };
  if (existingSha) body.sha = existingSha;

  const url = `${GH_BASE}/repos/${owner}/${repo}/contents/${encodePath(path)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub PUT ${res.status}: ${err.message || 'unknown'}`);
  }
  return { action: existingSha ? 'updated' : 'created' };
}

/**
 * URL-Encoding für Pfade — behandelt Slashes korrekt.
 */
function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

/**
 * Validiert Token + Repo — ruft /repos/{owner}/{repo} auf.
 * Gibt Repo-Metadaten inkl. default_branch zurück.
 */
async function validateRepo(token, owner, repo) {
  const res = await fetch(`${GH_BASE}/repos/${owner}/${repo}`, { headers: authHeaders(token) });
  if (res.status === 401) throw new Error('Token ungültig oder abgelaufen');
  if (res.status === 404) throw new Error(`Repo ${owner}/${repo} nicht gefunden oder kein Zugriff`);
  if (!res.ok) throw new Error(`GitHub-Fehler: ${res.status}`);
  return res.json();
}

/**
 * Liest den Default-Branch. Fallback 'main'.
 */
async function getDefaultBranch(token, owner, repo) {
  const meta = await validateRepo(token, owner, repo);
  return meta.default_branch || 'main';
}

/**
 * Prüft, ob das Repo mindestens einen Commit hat (sonst schlägt PUT fehl).
 * Gibt true/false zurück. Ein frisch erstelltes leeres Repo liefert hier 409.
 */
async function isRepoInitialized(token, owner, repo, branch) {
  const url = `${GH_BASE}/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  return res.ok;
}

/**
 * Legt einen Initial-Commit (.gitkeep) an, falls das Repo leer ist.
 */
async function bootstrapRepo(token, owner, repo, branch = 'main') {
  // Einen .gitkeep im Root erzeugen — PUT auf ein leeres Repo legt automatisch den Branch an
  const url = `${GH_BASE}/repos/${owner}/${repo}/contents/.gitkeep`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Initial commit (Claude Chat Archiver)',
      content: btoa('# Claude Chat Archive\n'),
      branch,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Repo-Bootstrap fehlgeschlagen: ${res.status} ${err.message || ''}`);
  }
}

function parseRepoUrl(input) {
  // Akzeptiert "owner/repo" oder "https://github.com/owner/repo(.git)"
  const s = (input || '').trim().replace(/\.git$/, '');
  const m = s.match(/(?:github\.com\/)?([^/\s]+)\/([^/\s]+)\/?$/);
  if (!m) throw new Error('Ungültiges Repo-Format. Erwartet: owner/repo');
  return { owner: m[1], repo: m[2] };
}

// ==================== attachments.js ====================
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

// attachments.js — Extraktion aller Attachments aus einer Claude-Conversation
//
// Liefert ein Array von { name, path, url?, content? } — path ist relativ
// zum Chat-Ordner (z.B. "attachments/foo.pdf").
//
// Drei Quellen:
//  1. User-Uploads: conv.chat_messages[].files_v2 + .files + .attachments
//  2. Artefakte: <antartifact>-Tags in Assistant-Messages
//  3. Tool-Outputs: base64-Blöcke in tool_result-Content
//
// url → muss via Claude.downloadFile() nachgeladen werden (ArrayBuffer)
// content → bereits vorhandener Text/Binary (ArrayBuffer oder String)


// Sanitize-Regex für Dateinamen im Repo
function sanitizeName(name, fallback = 'file') {
  const clean = (name || fallback)
    .replace(/[\x00-\x1f<>:"|?*\\]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 100);
  return clean || fallback;
}

function guessExtension(mime) {
  if (!mime) return '';
  const map = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
    'image/webp': '.webp', 'image/svg+xml': '.svg',
    'application/pdf': '.pdf',
    'text/plain': '.txt', 'text/markdown': '.md', 'text/csv': '.csv',
    'application/json': '.json',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/zip': '.zip',
  };
  return map[mime] || '';
}

/**
 * Typ 1 — User-Uploads aus Messages extrahieren.
 */
function extractUserUploads(conv) {
  const results = [];
  const messages = conv.chat_messages || [];
  let counter = 0;

  for (const msg of messages) {
    // Neues Format: files_v2
    const filesV2 = msg.files_v2 || [];
    for (const f of filesV2) {
      counter++;
      const name = sanitizeName(f.file_name || `upload_${counter}`);
      const ext = name.includes('.') ? '' : guessExtension(f.file_kind || f.mime_type);
      results.push({
        name: name + ext,
        path: `attachments/${name}${ext}`,
        url: f.preview_url || f.download_url || f.url ||
             (f.file_uuid ? `/api/${conv.uuid ? 'organizations/' + conv.uuid + '/' : ''}files/${f.file_uuid}/content` : null),
        source: 'user_upload',
        fileUuid: f.file_uuid,
      });
    }

    // Älteres Format: files
    const files = msg.files || [];
    for (const f of files) {
      counter++;
      const name = sanitizeName(f.file_name || `upload_${counter}`);
      results.push({
        name,
        path: `attachments/${name}`,
        url: f.preview_url || f.url,
        source: 'user_upload',
      });
    }

    // Legacy: attachments
    const atts = msg.attachments || [];
    for (const a of atts) {
      counter++;
      const name = sanitizeName(a.file_name || a.name || `attachment_${counter}`);
      // Attachments haben oft den Inhalt direkt inline (extracted_content)
      if (a.extracted_content) {
        results.push({
          name: name + (name.endsWith('.txt') ? '' : '.txt'),
          path: `attachments/${name}${name.endsWith('.txt') ? '' : '.txt'}`,
          content: a.extracted_content,
          source: 'user_upload_text',
        });
      }
    }
  }

  return results;
}

/**
 * Typ 2 — Claude-Artefakte aus Assistant-Messages extrahieren.
 * Claude markiert Artefakte mit <antartifact identifier="..." type="..." language="..." title="...">...</antartifact>
 */
function extractArtifacts(conv) {
  const results = [];
  const messages = conv.chat_messages || [];
  let counter = 0;

  // Ext-Mapping für Artifact-Types
  const typeToExt = {
    'application/vnd.ant.code': {
      python: '.py', javascript: '.js', typescript: '.ts', jsx: '.jsx', tsx: '.tsx',
      html: '.html', css: '.css', json: '.json', yaml: '.yaml', sql: '.sql',
      bash: '.sh', shell: '.sh', powershell: '.ps1', rust: '.rs', go: '.go',
      java: '.java', cpp: '.cpp', c: '.c', csharp: '.cs', php: '.php', ruby: '.rb',
    },
    'application/vnd.ant.react': '.jsx',
    'image/svg+xml': '.svg',
    'application/vnd.ant.mermaid': '.mmd',
    'text/html': '.html',
    'text/markdown': '.md',
    'application/vnd.ant.pptx': '.pptx',
  };

  function extForArtifact(type, language) {
    if (type === 'application/vnd.ant.code') {
      return typeToExt[type][language] || '.txt';
    }
    return typeToExt[type] || '.txt';
  }

  for (const msg of messages) {
    if (msg.sender !== 'assistant') continue;

    // Text aus content-blocks sammeln
    let fullText = '';
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'text' && block.text) fullText += block.text;
      }
    } else if (typeof msg.text === 'string') {
      fullText = msg.text;
    }

    // Regex über alle <antartifact>-Blöcke
    const regex = /<antartifact\s+([^>]+)>([\s\S]*?)<\/antartifact>/g;
    let m;
    while ((m = regex.exec(fullText)) !== null) {
      counter++;
      const attrStr = m[1];
      const body = m[2];
      const attrs = {};
      for (const a of attrStr.matchAll(/(\w+)="([^"]*)"/g)) attrs[a[1]] = a[2];

      const title = attrs.title || attrs.identifier || `artifact_${counter}`;
      const ext = extForArtifact(attrs.type, attrs.language);
      const baseName = sanitizeName(title).replace(/\.[^.]+$/, ''); // existing ext weg
      const name = `artifact-${String(counter).padStart(2, '0')}-${baseName}${ext}`;
      results.push({
        name,
        path: `attachments/${name}`,
        content: body,
        source: 'artifact',
      });
    }
  }

  return results;
}

/**
 * Typ 3 — Tool-Outputs aus tool_result-Blöcken (z.B. Code-Execution-Files).
 * Claude liefert Dateien als base64 in content-Arrays mit type 'image' oder 'document'.
 */
function extractToolOutputs(conv) {
  const results = [];
  const messages = conv.chat_messages || [];
  let counter = 0;

  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      // Tool-Results mit file-artifacts
      if (block.type === 'tool_result' && block.content) {
        const inner = Array.isArray(block.content) ? block.content : [block.content];
        for (const item of inner) {
          // Base64-Image oder -Document
          if (item && item.type === 'image' && item.source?.type === 'base64') {
            counter++;
            const ext = guessExtension(item.source.media_type) || '.png';
            const name = `tool-output-${String(counter).padStart(2, '0')}${ext}`;
            results.push({
              name,
              path: `attachments/${name}`,
              content: base64ToArrayBuffer(item.source.data),
              source: 'tool_output',
              binary: true,
            });
          }
        }
      }

      // Manche Code-Execution-Tools liefern URLs zu generated files
      if (block.type === 'tool_use' && block.name === 'present_files' && block.input?.filepaths) {
        for (const path of block.input.filepaths) {
          counter++;
          const basename = path.split('/').pop() || `file_${counter}`;
          // Output-URLs laufen über /api/organizations/.../files/...
          // Leider nicht immer verfügbar — wir markieren als unvollständig
          results.push({
            name: sanitizeName(basename),
            path: `attachments/${sanitizeName(basename)}`,
            placeholder: path,
            source: 'tool_output_ref',
          });
        }
      }
    }
  }

  return results;
}

function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Konvertiert ArrayBuffer/String zu Base64 (für GitHub-Upload).
 */
function toBase64(data) {
  if (typeof data === 'string') {
    // UTF-8 sicher
    const bytes = new TextEncoder().encode(data);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  // ArrayBuffer
  const bytes = new Uint8Array(data);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/**
 * Entry-Point: alle Attachments einer Conversation extrahieren.
 * Lädt remote-URLs nach, dedupliziert nach path.
 * Respektiert maxBytes (default 10 MB pro Datei).
 */
async function extractAllAttachments(conv, opts = {}) {
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;
  const skipped = [];

  const raw = [
    ...extractUserUploads(conv),
    ...extractArtifacts(conv),
    ...extractToolOutputs(conv),
  ];

  // Nachladen von URLs
  const loaded = [];
  const seenPaths = new Set();

  for (const att of raw) {
    // Duplikat?
    let uniquePath = att.path;
    let dupCount = 1;
    while (seenPaths.has(uniquePath)) {
      const dot = att.path.lastIndexOf('.');
      uniquePath = dot > 0
        ? `${att.path.slice(0, dot)}_${dupCount}${att.path.slice(dot)}`
        : `${att.path}_${dupCount}`;
      dupCount++;
    }
    seenPaths.add(uniquePath);
    att.path = uniquePath;
    att.name = uniquePath.split('/').pop();

    // Placeholder: überspringen (nur Referenz, keine Datei)
    if (att.placeholder) {
      skipped.push({ name: att.name, reason: 'nur Referenz, kein Inhalt verfügbar' });
      continue;
    }

    // URL → download
    if (att.url && !att.content) {
      const buf = await Claude.downloadFile(att.url);
      if (!buf) {
        skipped.push({ name: att.name, reason: 'Download fehlgeschlagen' });
        continue;
      }
      if (buf.byteLength > maxBytes) {
        skipped.push({ name: att.name, reason: `zu groß (${(buf.byteLength / 1e6).toFixed(1)} MB)` });
        continue;
      }
      att.content = buf;
      att.binary = true;
    }

    // Content-Check
    if (att.content == null) {
      skipped.push({ name: att.name, reason: 'kein Inhalt' });
      continue;
    }

    // Größen-Check für inline content
    if (typeof att.content === 'string' && att.content.length > maxBytes) {
      skipped.push({ name: att.name, reason: `Text zu groß` });
      continue;
    }

    loaded.push(att);
  }

  return { attachments: loaded, skipped };
}


// ==================== namespace-shim ====================
const Claude = {
  getOrganizations, listConversations, getConversation, checkAuth, downloadFile,
};
const GH = {
  getFileSha, putFile, putFileBase64, validateRepo, getDefaultBranch,
  isRepoInitialized, bootstrapRepo, parseRepoUrl,
};

// ==================== background.js ====================
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
