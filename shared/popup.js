// Settings popup for Copy PR Link for Slack.
// Stores the message prefix and the link-text options in chrome.storage.sync;
// the content script reads them and updates live via storage.onChanged.

const DEFAULT_PREFIX = ':opened:';
// The defaults give the original "PR title (#123)" output.
const DEFAULTS = { prefix: DEFAULT_PREFIX, includeRepo: false, numberPosition: 'after' };

const input = document.getElementById('prefix');
const includeRepoEl = document.getElementById('include-repo');
const positionEl = document.getElementById('number-position');
const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');
const saveBtn = document.getElementById('save');

// Same rules as linkText() in content.js, with sample values.
function sampleLinkText() {
  const ref = (includeRepoEl.checked ? 'owner/repo' : '') + (positionEl.value === 'none' ? '' : '#123');
  if (!ref) return 'PR title';
  return positionEl.value === 'before' ? `${ref}: PR title` : `PR title (${ref})`;
}

function renderPreview() {
  const p = input.value.trim();
  previewEl.textContent = '';
  if (p) previewEl.append(p + ' ');
  const b = document.createElement('b');
  b.textContent = sampleLinkText();
  previewEl.append(b); // bold = the part that becomes the clickable link
}

function load() {
  chrome.storage.sync.get(DEFAULTS, (res) => {
    input.value = res && typeof res.prefix === 'string' ? res.prefix : DEFAULT_PREFIX;
    includeRepoEl.checked = !!res && res.includeRepo === true;
    const position = res && res.numberPosition;
    positionEl.value = ['after', 'before', 'none'].includes(position) ? position : 'after';
    renderPreview();
    input.focus();
    input.select();
  });
}

function save() {
  const value = input.value.trim();
  const settings = {
    prefix: value,
    includeRepo: includeRepoEl.checked,
    numberPosition: positionEl.value,
  };
  chrome.storage.sync.set(settings, () => {
    statusEl.textContent = chrome.runtime.lastError ? 'Error saving' : 'Saved ✓';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 1500);
  });
}

input.addEventListener('input', renderPreview);
includeRepoEl.addEventListener('change', renderPreview);
positionEl.addEventListener('change', renderPreview);
saveBtn.addEventListener('click', save);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') save();
});

load();
