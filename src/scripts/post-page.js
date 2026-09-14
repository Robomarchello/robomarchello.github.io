/**
 * Post detail page. The article is fully rendered at build time, so this only
 * handles the shared chrome plus deep-linking into a section heading.
 */

import { onReady } from './page.js';

onReady(() => {
  if (!window.location.hash) return;

  const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
  if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 60);
});
