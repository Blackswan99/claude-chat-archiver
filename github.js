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

import { toBase64Utf8 } from './markdown.js';

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
export async function getFileSha(token, owner, repo, path, branch = 'main') {
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
export async function putFile(token, owner, repo, path, content, message, branch = 'main') {
  return putFileBase64(token, owner, repo, path, toBase64Utf8(content), message, branch);
}

/**
 * Wie putFile, aber akzeptiert bereits base64-enkodierte Daten (für Binärdateien).
 */
export async function putFileBase64(token, owner, repo, path, base64Content, message, branch = 'main') {
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
export async function validateRepo(token, owner, repo) {
  const res = await fetch(`${GH_BASE}/repos/${owner}/${repo}`, { headers: authHeaders(token) });
  if (res.status === 401) throw new Error('Token invalid or expired');
  if (res.status === 404) throw new Error(`Repository ${owner}/${repo} not found or not accessible`);
  if (!res.ok) throw new Error(`GitHub error: ${res.status}`);
  return res.json();
}

/**
 * Liest den Default-Branch. Fallback 'main'.
 */
export async function getDefaultBranch(token, owner, repo) {
  const meta = await validateRepo(token, owner, repo);
  return meta.default_branch || 'main';
}

/**
 * Prüft, ob das Repo mindestens einen Commit hat (sonst schlägt PUT fehl).
 * Gibt true/false zurück. Ein frisch erstelltes leeres Repo liefert hier 409.
 */
export async function isRepoInitialized(token, owner, repo, branch) {
  const url = `${GH_BASE}/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  return res.ok;
}

/**
 * Legt einen Initial-Commit (.gitkeep) an, falls das Repo leer ist.
 */
export async function bootstrapRepo(token, owner, repo, branch = 'main') {
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
    throw new Error(`Repository bootstrap failed: ${res.status} ${err.message || ''}`);
  }
}

export function parseRepoUrl(input) {
  // Akzeptiert "owner/repo" oder "https://github.com/owner/repo(.git)"
  const s = (input || '').trim().replace(/\.git$/, '');
  const m = s.match(/(?:github\.com\/)?([^/\s]+)\/([^/\s]+)\/?$/);
  if (!m) throw new Error('Invalid repository format. Expected: owner/repo');
  return { owner: m[1], repo: m[2] };
}
