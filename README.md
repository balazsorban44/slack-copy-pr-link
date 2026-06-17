# Copy PR Link for Slack

A tiny Chrome extension that adds a Slack-logo button to GitHub pull request
pages. Click it and the PR is copied to your clipboard as:

> `:opened:` &nbsp; [**PR title #123**](#) ← hyperlinked to the PR URL

Paste into Slack and you get the `:opened:` emoji followed by the PR title (with
its number) as a clean clickable link, instead of a bare URL. The emoji is plain
text outside the link, so Slack renders it as the emoji.

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome (or any Chromium browser — Edge, Brave, Arc).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this folder
   (`chrome-slack-copy-pr-link`).
4. Open any GitHub PR — a Slack-logo button appears in the title row, right after
   the *Edit title* button.

To update later, pull the latest files and click the ↻ refresh icon on the
extension's card in `chrome://extensions`.

## Usage

1. Go to a pull request, e.g. `https://github.com/owner/repo/pull/123`.
2. Click the Slack-logo button (it briefly shows a ✓).
3. Paste into the Slack message box. You'll see the emoji + the PR title as a hyperlink.

The link always points at the canonical PR URL, so it works from any PR sub-tab
(*Conversation*, *Files changed*, *Commits*, …).

## How it works

- A content script runs only on `https://github.com/*/*/pull/*`.
- On click it reads the PR title from the page (stripping UI controls like the
  "Edit title" button) and builds the canonical PR URL from the path, then writes
  **two clipboard flavors**:
  - `text/html` → `:opened: <a href="URL">Title #123</a>` (what Slack and other rich editors use)
  - `text/plain` → `:opened: Title #123` + newline + `URL` (fallback for plain-text targets)
- The button is placed right after the **Edit title** button (new React header) or
  in the action bar (classic header), and is re-injected across GitHub's in-page
  (Turbo/PJAX/React) navigation.

## Settings

Click the extension's toolbar icon to open settings and change the **message
prefix** — the text added before the link. It defaults to the `:opened:` Slack
emoji shortcode; set any shortcode you like (e.g. `:rocket:`) or leave it blank
for no prefix. Changes apply immediately, no reload needed.

> Tip: pin the extension (puzzle-piece menu → pin) so the icon is always visible.

## Customize (code)

Other tweaks live in [`content.js`](content.js) — reload the extension after
editing. For example, to change the link text, edit `getPrInfo()` (e.g. format
the number as `` `${base} (#${number})` ``).

## Permissions

- `clipboardWrite` — to place the link on your clipboard.
- `storage` — to remember your message-prefix setting.

No data is collected or sent anywhere; everything runs locally in your browser.
Your prefix setting is stored with `chrome.storage.sync`.
