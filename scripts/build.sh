#!/usr/bin/env bash
# Assemble the loadable extension folders, then package them.
#
# shared/ is the single source of truth. Chrome refuses to load unpacked
# extensions whose files are symlinks resolving outside the extension root, so we
# copy REAL files from shared/ into chrome/ and firefox/ (each keeps only its own
# manifest.json in git; the copied files are git-ignored). Then zip each folder.
#
# Run this after editing anything in shared/, and before loading from source.
# Output: dist/chrome.zip, dist/firefox.zip
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p dist
rm -f dist/*.zip

files=(content.js content.css popup.html popup.js)

for browser in chrome firefox; do
  for f in "${files[@]}"; do
    cp -f --remove-destination "shared/$f" "$browser/$f"
  done
  rm -rf "$browser/icons"
  mkdir -p "$browser/icons"
  cp -f shared/icons/*.png "$browser/icons/"

  ( cd "$browser" && zip -qr -X "../dist/$browser.zip" manifest.json "${files[@]}" icons )
done

echo "Synced shared/ -> chrome/, firefox/ (real files) and packaged:"
ls -l dist