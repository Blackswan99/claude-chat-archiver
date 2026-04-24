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

import * as Claude from './claude-api.js';

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
export function toBase64(data) {
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
export async function extractAllAttachments(conv, opts = {}) {
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
      skipped.push({ name: att.name, reason: 'reference only, content not available' });
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
        skipped.push({ name: att.name, reason: `too large (${(buf.byteLength / 1e6).toFixed(1)} MB)` });
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
      skipped.push({ name: att.name, reason: `text too large` });
      continue;
    }

    loaded.push(att);
  }

  return { attachments: loaded, skipped };
}
