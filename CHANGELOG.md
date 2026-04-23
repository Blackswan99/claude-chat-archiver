# Changelog

Alle wesentlichen Änderungen werden hier dokumentiert. Das Format folgt
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionierung
[Semantic Versioning](https://semver.org/lang/de/).

## [2.1.2] - 2026-04-23

### Fixed
- Firefox: Background-Worker konnte ES-Modul-Imports nicht zuverlässig auflösen.
  Alle Module werden nun zu `background.bundle.js` vorgebaut (`build-bundle.sh`).
- Settings-Persistenz: Writes laufen direkt im Popup-Kontext mit sofortiger
  Verifikation durch Re-Read — unabhängig vom Background-Worker-Lifecycle.

## [2.1.0] - 2026-04-23

### Added
- Vollständige Attachment-Archivierung: User-Uploads, Claude-Artefakte,
  Tool-Outputs
- Neue Ordnerstruktur: jeder Chat erhält eigenes Verzeichnis mit
  `chat.md` + `attachments/`-Unterordner
- Attachment-Index am Anfang jeder `chat.md` mit klickbaren GitHub-Links
- Settings: Max-Attachment-Größe (MB), Anhänge optional deaktivierbar

## [2.0.2] - 2026-04-22

### Fixed
- Default-Branch-Detection (`main` vs. `master`) statt Hardcoding
- Leere Repos werden automatisch mit Initial-Commit bootstrapped
- Korrektes URL-Encoding für Pfade mit Unterordnern

## [2.0.0] - 2026-04-22

### Changed
- Komplettes Rewrite: Keine DOM-Scraping mehr, Nutzung der internen
  Claude.ai-JSON-API über Session-Cookie

### Added
- Inkrementeller Sync: unveränderte Chats per `updated_at` + SHA-256-Hash
  übersprungen
- UTF-8-sicheres Base64-Encoding für GitHub-Uploads
- Markdown-Output mit Frontmatter, korrekter Tool-Use/Tool-Result-Darstellung
- SHA-Handling für Updates existierender Dateien

### Removed
- Content-Script (DOM-Extraktion nicht mehr nötig)
