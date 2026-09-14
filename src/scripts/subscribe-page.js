/** Subscribe page: copies the absolute RSS feed URL to the clipboard. */

import { onReady } from './page.js';

const RESET_DELAY_MS = 2200;

onReady(() => {
  const button = document.getElementById('copy-rss-btn');
  const label = document.getElementById('copy-rss-text');
  const feedLink = document.getElementById('subscribe-rss-link');
  if (!button || !label || !feedLink) return;

  button.addEventListener('click', async () => {
    const feedUrl = new URL(feedLink.getAttribute('href'), window.location.href).href;

    try {
      await navigator.clipboard.writeText(feedUrl);
      label.textContent = 'Copied to Clipboard!';
      button.style.borderColor = 'var(--posts-accent, #38bdf8)';
      button.style.color = 'var(--posts-accent, #38bdf8)';
      setTimeout(() => {
        label.textContent = 'Copy Feed URL';
        button.style.borderColor = '';
        button.style.color = '';
      }, RESET_DELAY_MS);
    } catch (err) {
      window.prompt('Copy RSS feed URL:', feedUrl);
    }
  });
});
