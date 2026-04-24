# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [1.0.1] - 2026-04-23

### Fixed
- Consent screen stayed visible after clicking "I understand — Continue".
  The accept flag was correctly persisted, but the `.hidden` CSS class was
  not globally defined, so the UI didn't update. Added a global
  `.hidden { display: none !important; }` rule.

## [1.0.0] - 2026-04-23

### Added
- First-run consent screen informing users about data transmission to the
  configured GitHub repository, with explicit Accept/Decline. Consent is
  required before any sync operation.
- `data_collection_permissions` declaration in the manifest (required for
  Firefox 140+ AMO submissions).

### Changed
- Switched popup rendering from `innerHTML` template strings to DOM API
  (`createElement` / `textContent`) for improved safety and AMO compliance.
- Removed unsupported `service_worker` manifest key; Firefox uses the
  `scripts` key exclusively.

### Fixed
- Firefox: background worker could not reliably resolve ES module imports.
  All modules are now pre-built into `background.bundle.js` via
  `build-bundle.sh`.
- Settings persistence: writes happen directly in the popup context with
  immediate verification via re-read.

## [0.3.0] - 2026-04-23

### Added
- Full attachment archiving: user uploads, Claude artifacts, and tool outputs
- New folder structure: each chat gets its own directory containing
  `chat.md` plus an `attachments/` subfolder
- Attachment index at the top of every `chat.md` with clickable GitHub links

## [0.2.0] - 2026-04-22

### Fixed
- Default branch detection (`main` vs. `master`) instead of hardcoding
- Empty repositories are automatically bootstrapped with an initial commit

## [0.1.0] - 2026-04-22

### Changed
- Complete rewrite: no more DOM scraping — uses the internal Claude.ai JSON API
  authenticated via session cookie

### Added
- Incremental sync via `updated_at` + SHA-256 hash
- UTF-8-safe Base64 encoding for GitHub uploads
- Markdown output with frontmatter
- SHA handling for updating existing files

### Removed
- Content script (DOM extraction no longer needed)
