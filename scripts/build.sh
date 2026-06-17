#!/usr/bin/env bash
# Build installable, ready-to-load zips for each browser from shared/ + the
# per-browser manifest. Real files only (no symlinks) so the zips work anywhere.
#
# Output: dist/chrome.zip, dist/firefox.zip
set -euo pipefail

cd "$(dirname "$0")/.."
out="dist"
rm -rf "$out"
mkdir -p "$out"

for browser in chrome firefox; do
  stage="$out/stage-$browser"
  mkdir -p "$stage/icons"
  cp shared/content.js shared/content.css shared/popup.html shared/popup.js "$stage/"
  cp shared/icons/*.png "$stage/icons/"
  cp "$browser/manifest.json" "$stage/manifest.json"
  ( cd "$stage" && zip -qr -X "../$browser.zip" . )
  rm -rf "$stage"
done

echo "Built:"
ls -l "$out"
