/**
 * Links page: reassembles obfuscated email addresses for real visitors and
 * turns those blocks into click-to-copy buttons.
 */

import { onReady } from './page.js';

const COPY_ICON = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
const CHECK_ICON = '<polyline points="20 6 9 17 4 12"></polyline>';
const RESET_DELAY_MS = 2500;

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);

  return new Promise((resolve, reject) => {
    const field = document.createElement('textarea');
    field.value = text;
    field.style.position = 'fixed';
    field.style.left = '-9999px';
    document.body.appendChild(field);
    field.select();
    try {
      document.execCommand('copy');
      resolve();
    } catch (err) {
      reject(err);
    } finally {
      document.body.removeChild(field);
    }
  });
}

function initCopyBlock(block) {
  const badge = block.querySelector('.email-copy-btn, .link-copy-btn');
  const iconEl = block.querySelector('.email-copy-icon, .link-copy-icon');
  const urlText = block.querySelector('.link-block-url');
  let resetTimer = null;

  const value = block.dataset.copy || `${block.dataset.u || ''}@${block.dataset.h || ''}`;

  // Replace the "[at]" placeholder now that we know a real browser is here
  if (block.dataset.u && urlText) urlText.textContent = value;

  function showSuccess() {
    if (iconEl) iconEl.innerHTML = CHECK_ICON;
    block.classList.add('copied');
    badge?.classList.add('copied');
    block.title = 'Copied to clipboard!';

    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      if (iconEl) iconEl.innerHTML = COPY_ICON;
      block.classList.remove('copied');
      badge?.classList.remove('copied');
      block.title = 'Click to copy';
    }, RESET_DELAY_MS);
  }

  function handleCopy(event) {
    event?.preventDefault();
    copyToClipboard(value).then(showSuccess, () => {});
  }

  block.addEventListener('click', handleCopy);
  block.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') handleCopy(event);
  });
}

onReady(() => {
  document
    .querySelectorAll('.link-block[data-u], .link-block[data-copy], .link-block.copyable')
    .forEach(initCopyBlock);
});
