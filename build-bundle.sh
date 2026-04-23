#!/bin/bash
# build-bundle.sh — Verkettet alle Module zu einer einzigen background.bundle.js
# Strippt import/export-Statements, behält aber die Funktionalität.

set -e
cd "$(dirname "$0")"

OUT=background.bundle.js

cat > "$OUT" <<'HEADER'
// AUTO-GENERATED BUNDLE — DO NOT EDIT DIRECTLY
// Original sources: claude-api.js, markdown.js, github.js, attachments.js, background.js
// Build: simple concat with import/export stripping

HEADER

# Reihenfolge wichtig: Dependencies first
for f in markdown.js claude-api.js github.js attachments.js background.js; do
  echo "" >> "$OUT"
  echo "// ==================== $f ====================" >> "$OUT"
  # Strippe: import-Zeilen, 'export ' Prefix (Funktions-Exports werden globale Funktions-Decls)
  sed -E \
    -e '/^import .*from .*;$/d' \
    -e 's/^export (function |async function |const |let |var )/\1/' \
    -e 's/^export \{[^}]+\};?$//' \
    "$f" >> "$OUT"
done

# Namespace-Shim: Im Original werden Claude.* und GH.* verwendet. Im Bundle
# sind alle Funktionen global, also bauen wir Namespace-Objekte die darauf zeigen.
# Der Shim muss VOR background.js eingefügt werden — wir patchen das hier nachträglich.

SHIM='
// ==================== namespace-shim ====================
const Claude = {
  getOrganizations, listConversations, getConversation, checkAuth, downloadFile,
};
const GH = {
  getFileSha, putFile, putFileBase64, validateRepo, getDefaultBranch,
  isRepoInitialized, bootstrapRepo, parseRepoUrl,
};
'

# Shim VOR dem background.js-Block einfügen
awk -v shim="$SHIM" '
  /^\/\/ ==================== background\.js ====================/ { print shim }
  { print }
' "$OUT" > "$OUT.tmp" && mv "$OUT.tmp" "$OUT"

echo "Built $OUT ($(wc -l < "$OUT") lines, $(wc -c < "$OUT") bytes)"

