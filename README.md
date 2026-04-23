# Claude Chat Archiver

Browser extension (Firefox, Chrome) that automatically archives your chats from [claude.ai](https://claude.ai) as Markdown into a GitHub repository — including all user uploads, Claude artifacts, and tool outputs.

> **Independent tool.** Not built by Anthropic or GitHub, and not affiliated with either of them.

## Why?

Claude.ai does not offer an official export of all chats in an open, version-controllable format. Anyone doing longer conversations, research, coding work, or journal-style usage will want those contents available outside the platform — searchable, diffable, and independent of account or platform changes.

This extension solves the problem **without DOM scraping**: it uses the same JSON API that claude.ai itself uses in the frontend, and uploads chats in a structured way to a GitHub repo. Incremental, idempotent, deterministic.

## Features

- **Complete chat histories** as Markdown with YAML frontmatter (UUID, timestamps, model)
- **Three kinds of attachments** are archived:
  - User uploads (PDFs, images, spreadsheets, code files)
  - Claude-generated artifacts (code, HTML, SVG, Mermaid)
  - Tool outputs from code-execution sessions
- **Incremental sync** — only changed chats are re-uploaded
- **One folder per chat** with a clickable attachment index
- **Optional auto-sync** in the background (min. 15 minutes)
- **No external dependencies** — pure vanilla JS, no npm, no runtime bundler

## Archive folder structure

```
your-archive-repo/
└── chats/
    ├── 2026-04-22_project-analysis_a3f7b2c1/
    │   ├── chat.md
    │   └── attachments/
    │       ├── data.xlsx
    │       ├── artifact-01-script.py
    │       └── tool-output-01.png
    └── 2026-04-21_research_f8e9d4a2/
        └── chat.md
```

---

## Installation

### Requirements

- **Firefox** (version 115 or newer) or a Chromium-based browser (Chrome, Edge, Brave, Opera)
- Active [claude.ai](https://claude.ai) account, logged in in your browser
- GitHub account with a repository as the archive target
- GitHub Personal Access Token with write access to that repo

### 1. Get the extension files

**Option A — ZIP download** (easiest):
1. On the repo page: **"Code" → "Download ZIP"**
2. Extract the ZIP

**Option B — Git clone**:
```bash
git clone https://github.com/Blackswan99/claude-chat-archiver.git
cd claude-chat-archiver
```

### 2a. Install in Firefox (temporary)

1. Enter `about:debugging#/runtime/this-firefox` in the address bar
2. Click **"Load Temporary Add-on..."**
3. Select the `manifest.json` from the extracted folder

> ⚠️ The extension is only loaded until Firefox is restarted. For permanent installation see the section [Firefox permanent](#firefox-permanent).

### 2b. Install in Chrome/Edge/Brave

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **"Load unpacked"**
4. Select the extracted folder

### 3. Create a GitHub Personal Access Token

**Fine-grained token** (recommended, more secure):
1. Open [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
2. **Repository access:** Select only the archive repo (not "All repositories"!)
3. **Permissions → Repository permissions → Contents: Read and write**
4. Leave all other permissions on "No access"
5. Set an expiration — e.g. 1 year

**Classic token** (simpler, broader):
1. [github.com/settings/tokens/new](https://github.com/settings/tokens/new)
2. Scope: `repo`

> Copy the token right away — GitHub only shows it once.

### 4. Extension settings

1. Click the extension icon → ⚙ (gear)
2. Fill in:
   - **GitHub Token** (the one you just created)
   - **Repository** in the form `username/repo`
   - Optional: target folder (default: `chats`)
3. Click **"Test"** — should return a green OK with branch info
4. Click **"Save"**

If your target repo is empty, the extension will automatically create an initial commit on the first sync.

### 5. Archive

1. Be logged in to [claude.ai](https://claude.ai) (regular browser login)
2. Open the extension icon — the chat list loads automatically
3. Tick the chats you want
4. Click **"Archive"**

Progress and errors appear in the activity log at the bottom.

---

## Firefox permanent

The temporary add-on disappears every time Firefox restarts. For permanent use:

1. Create an account at [addons.mozilla.org/developers](https://addons.mozilla.org/developers/)
2. **"Submit a New Add-on"** → upload the ZIP → choose **"On your own"** (self-distribution)
3. Mozilla signs the extension automatically (minutes to a few hours)
4. Drag and drop the signed `.xpi` into Firefox → stays installed permanently

This works **without store publication** and without review. The signed version is then only for you (or whoever you give it to), not for Mozilla users at large.

For **Chrome permanent** there is unfortunately no equivalent path — either the Chrome Web Store (5 $ fee, review) or keeping Developer mode permanently enabled.

---

## Settings in detail

| Setting | Meaning | Default |
|---|---|---|
| GitHub Token | Auth for the GitHub API | — |
| Repository | Target repo in the form `owner/repo` | — |
| Target folder | Subfolder in the repo for chats | `chats` |
| Auto-sync interval | Minutes between background syncs | 60 |
| Auto-archive | Enable automatic syncing | off |
| Max. attachment size | MB, larger files are skipped | 10 |
| Archive attachments | Download uploads, artifacts, tool outputs | on |

---

## Release verification

This extension has access to your Claude session and your GitHub token. You should be able to verify that the code really comes from the original author and has not been tampered with.

### As a user: verify authenticity

**Simplest check — GitHub web UI:** every commit should show a green **"Verified"** badge next to the author. If the badge is missing, the commit was not signed.

**Precise check — local GPG verification:**
```bash
# Import the maintainer's public key
gpg --keyserver keyserver.ubuntu.com --recv-keys <MAINTAINER-KEY-ID>

# Check commits
git log --show-signature | head -30
```

**Verify a release ZIP:** every release ships with a `.asc` signature:
```bash
gpg --verify claude-chat-archiver-v1.0.0.zip.asc claude-chat-archiver-v1.0.0.zip
```
The output must contain `Good signature from "Blackswan99..."`, and the key fingerprint must match the official one:

**Official key fingerprint:**
```
(to be filled in after key generation)
```

> ⚠️ **Careful with forks:** a fork is legitimate, but its maintainer is someone else. Only releases from `github.com/Blackswan99/claude-chat-archiver` are signed by the original author.

---

## License

**Apache License 2.0** — see [LICENSE](LICENSE) and [NOTICE](NOTICE).

Short version:
- ✅ Use, modification, redistribution — including commercial — are permitted
- ✅ Explicit patent license protects you from patent claims
- ⚠️ Copyright notice and LICENSE/NOTICE files must be retained in derivatives
- ⚠️ Modifications to files must be marked as such
- ❌ No warranty — the tool is provided "as is"
- ❌ The author's name may not be used for promotion without permission

For all details see the full license text.

---

## Architecture

```
popup.html / popup.js  ─(sendMessage)─▶  background.bundle.js
                                              │
                                              ├─▶ claude-api.js  ─▶  claude.ai/api
                                              ├─▶ github.js      ─▶  api.github.com
                                              ├─▶ markdown.js     (conversion + hash)
                                              └─▶ attachments.js  (extraction + download)
```

The background worker holds the central logic. The popup is pure UI and delegates all operations via `chrome.runtime.sendMessage`. API calls go directly from the worker with `credentials: 'include'`, so the Claude session cookie is automatically attached.

## Rebuild the bundle

After changes to any source module:
```bash
./build-bundle.sh
```
Creates `background.bundle.js` from all module files. The build script is pure Bash + sed, no Node dependencies.

---

## Caveats

The Claude.ai API is **not officially documented**. Anthropic can change it at any time. In practice it has been stable for a while, but there are no guarantees. The relevant calls are concentrated in `claude-api.js` and are easy to patch if necessary.

**Tool outputs** from code-execution sessions (generated files like `.docx`, `.xlsx`) cannot always be fully archived, since the file URLs sometimes have a short lifetime. In that case the attachment index shows a note `(reference only, no content available)`.

The tool accesses the Claude API with **your** session credentials — it operates within what you as a logged-in user are allowed to do anyway. No privileged operation, no Anthropic billing-relevant action.

---

## Contributing

Pull requests are welcome. For larger changes please open an issue first.

**Code style:** no build tooling dependencies other than `bash` and `sed`. No TypeScript, no Webpack, no npm. Plain ES2022 modules that can be concatenated into a single file by hand.
