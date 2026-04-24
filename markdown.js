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
      return `\n> ⚠️ ${skipped.length} attachments could not be archived.\n`;
    }
    return '';
  }

  const bySource = { user_upload: [], artifact: [], tool_output: [], user_upload_text: [], tool_output_ref: [] };
  for (const a of attachments) {
    (bySource[a.source] || bySource.user_upload).push(a);
  }

  const lines = ['\n## 📎 Attachments\n'];

  if (bySource.user_upload.length + bySource.user_upload_text.length > 0) {
    lines.push('**User uploads:**');
    for (const a of [...bySource.user_upload, ...bySource.user_upload_text]) {
      lines.push(`- [\`${a.name}\`](${a.path})`);
    }
    lines.push('');
  }

  if (bySource.artifact.length > 0) {
    lines.push('**Claude artifacts:**');
    for (const a of bySource.artifact) {
      lines.push(`- [\`${a.name}\`](${a.path})`);
    }
    lines.push('');
  }

  if (bySource.tool_output.length > 0) {
    lines.push('**Tool outputs:**');
    for (const a of bySource.tool_output) {
      lines.push(`- [\`${a.name}\`](${a.path})`);
    }
    lines.push('');
  }

  if (skipped && skipped.length > 0) {
    lines.push('**Skipped:**');
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
export function conversationToMarkdown(conv, attachmentMeta = null) {
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

export function slugify(text, max = 60) {
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
export function toBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Simple SHA-256 als Hex — für Change-Detection (skip wenn unverändert).
 */
export async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
