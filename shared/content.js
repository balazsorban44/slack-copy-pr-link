// Copy PR Link for Slack
// Adds an icon button to GitHub pull request pages. Clicking it puts a rich-text
// link on the clipboard: an emoji shortcode, then "PR title #number" linked to the
// PR URL — so pasting into Slack gives ":opened: <linked title #number>".
//
// GitHub ships two PR header layouts (classic Rails and the newer React header),
// so injection tries the classic action bar, then sits right after the title's
// "Edit title" button, then falls back to under the title heading.

(() => {
  'use strict';

  const PR_PATH = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
  const PR_LIST_PATH = /^\/[^/]+\/[^/]+\/pulls/;
  const BTN_ID = 'slack-copy-pr-link-btn';
  const BTN_TITLE = 'Copy a Slack-ready link to this PR';

  // Text prefixed to the copied content (before the link). Configurable from the
  // extension popup; defaults to the :opened: Slack emoji shortcode. Cached here
  // (and kept in sync) so the click handler can build the clipboard synchronously.
  const DEFAULT_PREFIX = ':opened:';
  let prefixText = DEFAULT_PREFIX;
  try {
    chrome.storage.sync.get({ prefix: DEFAULT_PREFIX }, (res) => {
      if (!chrome.runtime.lastError && res && typeof res.prefix === 'string') {
        prefixText = res.prefix;
      }
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if ((area === 'sync' || area === 'local') && changes.prefix) {
        prefixText = changes.prefix.newValue ?? '';
      }
    });
  } catch (e) {
    /* storage unavailable — fall back to the default prefix */
  }

  // Official Slack mark (4-color), inlined so we don't depend on extension assets.
  const ICON_SVG =
    '<svg class="scpl-icon" viewBox="0 0 127 127" width="16" height="16" aria-hidden="true">' +
    '<path fill="#E01E5A" d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80c0-7.3 5.9-13.2 13.2-13.2h13.2V80zm6.6 0c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z"/>' +
    '<path fill="#36C5F0" d="M47 27c-7.3 0-13.2-5.9-13.2-13.2C33.8 6.5 39.7.6 47 .6c7.3 0 13.2 5.9 13.2 13.2V27H47zm0 6.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H13.9C6.6 60.1.7 54.2.7 46.9c0-7.3 5.9-13.2 13.2-13.2H47z"/>' +
    '<path fill="#2EB67D" d="M99.9 46.9c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V46.9zm-6.6 0c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V13.8C66.9 6.5 72.8.6 80.1.6c7.3 0 13.2 5.9 13.2 13.2v33.1z"/>' +
    '<path fill="#ECB22E" d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.8h13.2zm0-6.6c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H80.1z"/>' +
    '</svg>';

  const ICON_OK =
    '<svg class="scpl-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">' +
    '<path fill="#1a7f37" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>';

  const ICON_FAIL =
    '<svg class="scpl-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">' +
    '<path fill="#cf222e" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>';

  function prNumber() {
    const m = location.pathname.match(PR_PATH);
    return m ? m[3] : null;
  }

  // The PR title heading: in both UIs it's a heading whose text contains "#<number>".
  function findTitleHeading(number) {
    if (!number) return document.querySelector('.gh-header-title') || null;
    const re = new RegExp('#' + number + '(?!\\d)');
    for (const h1 of document.querySelectorAll('h1')) {
      if (re.test(h1.textContent || '')) return h1;
    }
    const classic = document.querySelector('.gh-header-title');
    if (classic) return classic;
    for (const el of document.querySelectorAll('h2, [role="heading"]')) {
      if (re.test(el.textContent || '')) return el;
    }
    return null;
  }

  function cleanTitle(raw, number) {
    return String(raw)
      .replace(new RegExp('\\s*#' + number + '(?!\\d)'), '') // normalize away the "#123" marker
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Read just the human title out of an element, dropping interactive controls and
  // screen-reader-only labels (e.g. the "Edit title" button's sr-only text).
  function readTitle(el, number) {
    if (!el) return '';
    const bdi = el.matches && el.matches('bdi')
      ? el
      : (el.querySelector ? el.querySelector('bdi') : null);
    const src = bdi || el;
    const clone = src.cloneNode(true);
    clone
      .querySelectorAll(
        'button, a, svg, input, textarea, select, [role="button"], ' +
        '.sr-only, .visually-hidden, [hidden], [aria-hidden="true"]'
      )
      .forEach((n) => n.remove());
    return cleanTitle(clone.textContent || '', number);
  }

  function getPrInfo() {
    const m = location.pathname.match(PR_PATH);
    if (!m) return null;
    const [, owner, repo, number] = m;
    // Canonical PR URL, so sub-tabs (/files, /commits) and query params never
    // leak into the copied link.
    const url = `${location.origin}/${owner}/${repo}/pull/${number}`;

    const base =
      readTitle(document.querySelector('.js-issue-title, [data-testid="issue-title"]'), number) ||
      readTitle(findTitleHeading(number), number) ||
      cleanTitle(document.title.replace(/\s*·.*$/, ''), number) ||
      'Pull Request';

    // Keep the PR number in the link text, the way GitHub shows it.
    const title = `${base} #${number}`;

    return { url, title, number };
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function copyLink(info) {
    const prefix = prefixText ? prefixText + ' ' : '';
    // Emoji sits OUTSIDE the anchor so Slack renders it as an emoji, not link text.
    const html = `${prefix}<a href="${escapeHtml(info.url)}">${escapeHtml(info.title)}</a>`;
    const text = `${prefix}${info.title}\n${info.url}`;

    // Preferred: async clipboard API with both HTML and plain-text flavors.
    try {
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ]);
        return true;
      }
    } catch (e) {
      // Fall through to the execCommand fallback below.
    }

    // Fallback: hook the copy event so we can set rich + plain flavors.
    try {
      const handler = (e) => {
        e.clipboardData.setData('text/html', html);
        e.clipboardData.setData('text/plain', text);
        e.preventDefault();
      };
      document.addEventListener('copy', handler);
      const ok = document.execCommand('copy');
      document.removeEventListener('copy', handler);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function flash(btn, ok) {
    clearTimeout(btn._scplTimer);
    btn.innerHTML = ok ? ICON_OK : ICON_FAIL;
    btn.title = ok ? 'Copied!' : 'Copy failed';
    btn._scplTimer = setTimeout(() => {
      btn.innerHTML = ICON_SVG;
      btn.title = BTN_TITLE;
    }, 1200);
  }

  function makeButton() {
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.className = 'btn btn-sm scpl-btn';
    btn.title = BTN_TITLE;
    btn.setAttribute('aria-label', 'Copy PR link for Slack');
    btn.innerHTML = ICON_SVG;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const info = getPrInfo();
      if (!info) return;
      const ok = await copyLink(info);
      flash(btn, ok);
    });
    return btn;
  }

  // Find the visible "Edit title" control sitting in the title row (not a hidden
  // form control or a menu item elsewhere on the page). The React header's pencil
  // button names itself via aria-labelledby and carries an .octicon-pencil glyph.
  function findEditButtonNear(heading) {
    if (!heading) return null;
    const visible = (el) => el.getClientRects().length > 0;
    const inMenu = (el) => !!el.closest('[role="menu"], [role="menuitem"], [role="dialog"]');
    const accName = (el) => {
      let n = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
      if (!n) {
        const lb = el.getAttribute('aria-labelledby');
        if (lb) {
          n = lb
            .split(/\s+/)
            .map((id) => {
              const ref = el.ownerDocument.getElementById(id);
              return ref ? ref.textContent || '' : '';
            })
            .join(' ')
            .trim();
        }
      }
      if (!n) n = (el.textContent || '').trim();
      return n;
    };
    const scopes = [
      heading,
      heading.parentElement,
      heading.parentElement && heading.parentElement.parentElement,
    ].filter(Boolean);
    const select = (scope) => scope.querySelectorAll('button, a[role="button"], [role="button"]');

    // 1) The pencil icon button — the most reliable signal in the React header.
    for (const scope of scopes) {
      for (const el of select(scope)) {
        if (visible(el) && !inMenu(el) && el.querySelector('.octicon-pencil')) return el;
      }
    }
    // 2) An explicit "Edit title" accessible name (resolves aria-labelledby too).
    for (const scope of scopes) {
      for (const el of select(scope)) {
        if (visible(el) && !inMenu(el) && /edit\s*title/i.test(accName(el))) return el;
      }
    }
    // 3) Any visible "edit" control next to the title.
    for (const scope of scopes) {
      for (const el of select(scope)) {
        if (visible(el) && !inMenu(el) && /\bedit\b/i.test(accName(el))) return el;
      }
    }
    return null;
  }

  function getPrInfoFromRow(row) {
    const a = row.querySelector('a.markdown-title, a.js-navigation-open[href*="/pull/"]');
    if (!a) return null;
    const m = (a.getAttribute('href') || '').match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!m) return null;
    const [, owner, repo, number] = m;
    return {
      url: `${location.origin}/${owner}/${repo}/pull/${number}`,
      title: `${a.textContent.trim()} #${number}`,
      number,
    };
  }

  function makeListButton(info) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm scpl-btn scpl-list-btn';
    btn.title = BTN_TITLE;
    btn.setAttribute('aria-label', 'Copy PR link for Slack');
    btn.innerHTML = ICON_SVG;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ok = await copyLink(info);
      flash(btn, ok);
    });
    return btn;
  }

  function ensureListButtons() {
    if (!PR_LIST_PATH.test(location.pathname)) return;
    for (const row of document.querySelectorAll('.js-issue-row:not([data-scpl])')) {
      const info = getPrInfoFromRow(row);
      if (!info) continue;
      row.setAttribute('data-scpl', '1');
      const titleLink = row.querySelector('a.markdown-title, a.js-navigation-open[href*="/pull/"]');
      if (!titleLink) continue;
      const btn = makeListButton(info);
      const statusSpan = titleLink.nextElementSibling?.tagName === 'SPAN'
        ? titleLink.nextElementSibling
        : null;
      (statusSpan || titleLink).insertAdjacentElement('afterend', btn);
    }
  }

  function ensureButton() {
    if (!PR_PATH.test(location.pathname)) return;
    if (document.getElementById(BTN_ID)) return;

    const btn = makeButton();
    const heading = findTitleHeading(prNumber());

    // New React header: place it INSIDE the title row, right after the Edit
    // (pencil) button — which itself lives inside the <h1>.
    const editBtn = findEditButtonNear(heading);
    if (editBtn && editBtn.parentElement) {
      btn.classList.add('scpl-btn--inline');
      editBtn.insertAdjacentElement('afterend', btn);
      return;
    }

    // Classic Rails header: drop into the existing action bar next to Edit/Code.
    const actions = document.querySelector('.gh-header-actions');
    if (actions && actions.getClientRects().length) {
      actions.prepend(btn);
      return;
    }

    // Fallback: append within the heading so it stays on the title row.
    if (heading) {
      btn.classList.add('scpl-btn--inline');
      heading.appendChild(btn);
      return;
    }
    // Header not ready yet; the observer will retry.
  }

  // Coalesce the (potentially frequent) DOM mutations into one check per frame.
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureButton();
      ensureListButtons();
    });
  }

  ensureButton();
  ensureListButtons();

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // GitHub navigates between pages with Turbo/PJAX/React without a full reload.
  document.addEventListener('turbo:render', schedule);
  document.addEventListener('pjax:end', schedule);
})();
