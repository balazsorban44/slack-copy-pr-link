// Settings popup for Copy PR Link for Slack.
// Stores the message prefix in chrome.storage.sync; the content script reads it
// and updates live via storage.onChanged.

const DEFAULT_PREFIX = ':opened:';

const input = document.getElementById('prefix');
const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');
const saveBtn = document.getElementById('save');

function renderPreview() {
  const p = input.value.trim();
  previewEl.textContent = '';
  if (p) previewEl.append(p + ' ');
  const b = document.createElement('b');
  b.textContent = 'PR title #123';
  previewEl.append(b); // bold = the part that becomes the clickable link
}

function load() {
  chrome.storage.sync.get({ prefix: DEFAULT_PREFIX }, (res) => {
    input.value = res && typeof res.prefix === 'string' ? res.prefix : DEFAULT_PREFIX;
    renderPreview();
    input.focus();
    input.select();
  });
}

function save() {
  const value = input.value.trim();
  chrome.storage.sync.set({ prefix: value }, () => {
    statusEl.textContent = chrome.runtime.lastError ? 'Error saving' : 'Saved ✓';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 1500);
  });
}

input.addEventListener('input', renderPreview);
saveBtn.addEventListener('click', save);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') save();
});

load();
