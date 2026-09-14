/**
 * Behaviour every page shares. Each page entry script calls onReady() with
 * whatever extra work it needs.
 */

import { initPalette, initPaletteButton } from './theme.js';
import { initSmartNavbar } from './nav.js';

function initCommon() {
  initPalette();
  initPaletteButton();
  initSmartNavbar();
}

/** Runs common page setup plus `extra`, once the DOM is parsed. */
export function onReady(extra) {
  const run = () => {
    initCommon();
    if (typeof extra === 'function') extra();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
}
