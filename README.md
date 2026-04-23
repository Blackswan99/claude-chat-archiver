# Claude Chat Archiver

Browser-Extension (Firefox, Chrome) zum automatischen Archivieren deiner Chats von [claude.ai](https://claude.ai) als Markdown in ein GitHub-Repository — inklusive aller User-Uploads, Claude-Artefakte und Tool-Outputs.

> **Unabhängiges Tool.** Nicht von Anthropic oder GitHub, nicht affiliiert mit einem der beiden.

## Warum?

Claude.ai bietet keinen offiziellen Export aller Chats in einem offenen, versionskontrollierbaren Format. Wer längere Gespräche, Recherchen, Code-Arbeit oder tagebuchartige Nutzung betreibt, möchte diese Inhalte auch außerhalb der Plattform haben — durchsuchbar, diffbar, unabhängig von Account- oder Plattform-Änderungen.

Diese Extension löst das Problem **ohne DOM-Scraping**: Sie nutzt dieselbe JSON-API, die claude.ai selbst im Frontend verwendet, und lädt Chats strukturiert in ein GitHub-Repo. Inkrementell, idempotent, deterministisch.

## Features

- **Vollständige Chat-Verläufe** als Markdown mit YAML-Frontmatter (UUID, Timestamps, Modell)
- **Drei Arten von Anhängen** werden archiviert:
  - User-Uploads (PDFs, Bilder, Spreadsheets, Code-Dateien)
  - Von Claude erzeugte Artefakte (Code, HTML, SVG, Mermaid)
  - Tool-Outputs aus Code-Execution-Sessions
- **Inkrementeller Sync** — nur geänderte Chats werden neu hochgeladen
- **Ein Ordner pro Chat** mit klickbarem Attachment-Index
- **Optionaler Auto-Sync** im Hintergrund (min. 15 Minuten)
- **Keine externen Dependencies** — reines Vanilla-JS, kein npm, kein Bundler zur Laufzeit

## Ordnerstruktur im Archiv

```
dein-archiv-repo/
└── chats/
    ├── 2026-04-22_projekt-analyse_a3f7b2c1/
    │   ├── chat.md
    │   └── attachments/
    │       ├── daten.xlsx
    │       ├── artifact-01-skript.py
    │       └── tool-output-01.png
    └── 2026-04-21_recherche_f8e9d4a2/
        └── chat.md
```

---

## Installation

### Voraussetzungen

- **Firefox** (ab Version 115) oder Chromium-Browser (Chrome, Edge, Brave, Opera)
- Aktives [claude.ai](https://claude.ai)-Konto, im Browser eingeloggt
- GitHub-Konto mit einem Repository als Archiv-Ziel
- GitHub Personal Access Token mit Schreibrechten auf dieses Repo

### 1. Extension-Dateien besorgen

**Option A — ZIP-Download** (einfach):
1. Auf der Repo-Seite oben: **"Code" → "Download ZIP"**
2. ZIP entpacken

**Option B — Git-Clone**:
```bash
git clone https://github.com/Blackswan99/claude-chat-archiver.git
cd claude-chat-archiver
```

### 2a. In Firefox installieren (temporär)

1. `about:debugging#/runtime/this-firefox` in die Adressleiste
2. **"Temporäres Add-on laden..."** klicken
3. Die `manifest.json` aus dem entpackten Ordner auswählen

> ⚠️ Die Extension bleibt nur bis zum Firefox-Neustart geladen. Für dauerhafte Installation siehe Abschnitt [Firefox dauerhaft](#firefox-dauerhaft).

### 2b. In Chrome/Edge/Brave installieren

1. `chrome://extensions` öffnen
2. **Entwicklermodus** oben rechts aktivieren
3. **"Entpackte Erweiterung laden"** klicken
4. Den entpackten Ordner auswählen

### 3. GitHub Personal Access Token erstellen

**Fine-grained Token** (empfohlen, sicherer):
1. [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) öffnen
2. **Repository access:** Nur das Archiv-Repo auswählen (nicht "All repositories"!)
3. **Permissions → Repository permissions → Contents: Read and write**
4. Alle anderen Permissions auf "No access" lassen
5. Ablaufzeit setzen — z. B. 1 Jahr

**Classic Token** (einfacher, breiter):
1. [github.com/settings/tokens/new](https://github.com/settings/tokens/new)
2. Scope: `repo`

> Token sofort kopieren — GitHub zeigt ihn nur einmal an.

### 4. Settings in der Extension

1. Extension-Icon anklicken → ⚙ (Zahnrad)
2. Eintragen:
   - **GitHub Token** (der eben erstellte)
   - **Repository** im Format `username/repo`
   - Optional: Zielordner (Default: `chats`)
3. **"Testen"** klicken — sollte ein grünes OK mit Branch-Info zurückgeben
4. **"Speichern"**

Falls dein Zielrepo leer ist, legt die Extension beim ersten Sync automatisch einen Initial-Commit an.

### 5. Archivieren

1. Bei [claude.ai](https://claude.ai) eingeloggt sein (normaler Browser-Login)
2. Extension-Icon öffnen — die Chat-Liste lädt automatisch
3. Gewünschte Chats anhaken
4. **"Archivieren"** klicken

Fortschritt und Fehler erscheinen im Aktivitäts-Log am unteren Rand.

---

## Firefox dauerhaft

Das temporäre Add-on verschwindet bei jedem Firefox-Neustart. Für Dauerbetrieb:

1. Account anlegen auf [addons.mozilla.org/developers](https://addons.mozilla.org/developers/)
2. **"Submit a New Add-on"** → ZIP hochladen → **"On your own"** (Self-Distribution) wählen
3. Mozilla signiert die Extension automatisch (Minuten bis wenige Stunden)
4. Signierte `.xpi` per Drag & Drop in Firefox → bleibt permanent installiert

Das geht **ohne Veröffentlichung im Store**, ohne Review. Die signierte Version ist dann nur für dich (oder wen du sie gibst), nicht für Mozilla-Nutzer allgemein.

Für **Chrome dauerhaft** gibt es leider keinen analogen Weg — entweder Chrome Web Store (5 $ Gebühr, Review) oder Entwicklermodus dauerhaft aktiv.

---

## Einstellungen im Detail

| Setting | Bedeutung | Default |
|---|---|---|
| GitHub Token | Auth für die GitHub-API | — |
| Repository | Ziel-Repo im Format `owner/repo` | — |
| Zielordner | Unterordner im Repo für Chats | `chats` |
| Auto-Sync Intervall | Minuten zwischen Hintergrund-Syncs | 60 |
| Auto-Archive | Automatischer Sync aktivieren | aus |
| Max. Attachment-Größe | MB, größere Dateien werden übersprungen | 10 |
| Anhänge mit archivieren | Uploads, Artefakte, Tool-Outputs herunterladen | an |

---

## Release-Verifikation

Diese Extension hat Zugriff auf deine Claude-Session und dein GitHub-Token. Du solltest verifizieren können, dass der Code wirklich vom ursprünglichen Autor stammt und nicht manipuliert wurde.

### Als Nutzer: Authentizität prüfen

**Einfachster Check — GitHub-Web-UI:** Jeder Commit sollte ein grünes **"Verified"**-Badge neben dem Autor zeigen. Fehlt das Badge, wurde der Commit nicht signiert.

**Präziser Check — lokale GPG-Verifikation:**
```bash
# Den Public Key des Maintainers importieren
gpg --keyserver keyserver.ubuntu.com --recv-keys <MAINTAINER-KEY-ID>

# Commits prüfen
git log --show-signature | head -30
```

**Release-ZIP verifizieren:** Für jedes Release wird eine `.asc`-Signatur mitveröffentlicht:
```bash
gpg --verify claude-chat-archiver-v2.1.2.zip.asc claude-chat-archiver-v2.1.2.zip
```
Der Output muss `Good signature from "Blackswan99..."` enthalten, und der Key-Fingerprint muss mit dem offiziellen übereinstimmen:

**Offizieller Key-Fingerprint:**
```
(Wird nach Key-Generierung hier eingetragen)
```

> ⚠️ **Vorsicht bei Forks:** Ein Fork ist legitim, aber dessen Maintainer ist jemand anderes. Nur Releases aus `github.com/Blackswan99/claude-chat-archiver` sind vom Original-Autor signiert.

---

## Lizenz

**Apache License 2.0** — siehe [LICENSE](LICENSE) und [NOTICE](NOTICE).

Kurzfassung:
- ✅ Nutzung, Modifikation, Weitergabe — auch kommerziell — sind erlaubt
- ✅ Explizite Patent-Lizenz schützt dich vor Patent-Ansprüchen
- ⚠️ Copyright-Hinweis und LICENSE/NOTICE-Dateien müssen in Derivaten enthalten bleiben
- ⚠️ Änderungen an Dateien müssen kenntlich gemacht werden
- ❌ Keine Gewährleistung — das Tool wird "as is" bereitgestellt
- ❌ Der Name des Autors darf nicht ohne Zustimmung für Werbung verwendet werden

Für alle Details siehe den vollständigen Lizenztext.

---

## Architektur

```
popup.html / popup.js  ─(sendMessage)─▶  background.bundle.js
                                              │
                                              ├─▶ claude-api.js  ─▶  claude.ai/api
                                              ├─▶ github.js      ─▶  api.github.com
                                              ├─▶ markdown.js     (Konvertierung + Hash)
                                              └─▶ attachments.js  (Extraktion + Download)
```

Der Background-Worker ist die zentrale Logik. Das Popup ist reines UI und delegiert alle Operationen via `chrome.runtime.sendMessage`. API-Calls laufen direkt aus dem Worker mit `credentials: 'include'`, wodurch das Claude-Session-Cookie automatisch mitgesendet wird.

## Bundle neu bauen

Nach Änderungen an einem Source-Modul:
```bash
./build-bundle.sh
```
Erzeugt `background.bundle.js` aus allen Modul-Dateien. Das Bundle-Script ist reines Bash + sed, keine Node-Dependencies.

---

## Caveats

Die Claude.ai-API ist **nicht offiziell dokumentiert**. Anthropic kann sie jederzeit ändern. In der Praxis ist sie seit längerer Zeit stabil, aber Garantien gibt es keine. Die relevanten Aufrufe sind in `claude-api.js` konzentriert und einfach zu patchen, falls nötig.

**Tool-Outputs** aus Code-Execution-Sessions (generierte Files wie `.docx`, `.xlsx`) können nicht immer vollständig archiviert werden, da die Datei-URLs teilweise kurze Lebensdauer haben. In dem Fall erscheint im Attachment-Index ein Vermerk `(nur Referenz, kein Inhalt verfügbar)`.

Das Tool greift mit **deinen** Session-Credentials auf die Claude-API zu — es läuft im Rahmen dessen, was du als eingeloggter Nutzer ohnehin darfst. Keine privilegierte Operation, keine Anthropic-Billing-relevante Aktion.

---

## Mitwirken

Pull Requests sind willkommen. Vor größeren Änderungen bitte erst ein Issue aufmachen.

**Code-Stil:** keine Build-Tooling-Abhängigkeiten außer `bash` und `sed`. Kein TypeScript, kein Webpack, kein npm. Reine ES2022-Module, die sich händisch zu einer Datei verketten lassen.
