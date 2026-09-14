/**
 * Smart navbar.
 * Desktop (> 640px): always visible.
 * Phones: hides on scroll down, returns on scroll up.
 */

const MOBILE_BREAKPOINT = 640;
const DELTA_THRESHOLD = 8;
const TOP_ZONE = 45;

export function initSmartNavbar() {
  const header = document.getElementById('site-header');
  if (!header) return;

  let lastScrollY = window.scrollY || 0;
  let lastDirection = 'up';
  let ticking = false;

  function update() {
    ticking = false;
    const currentScrollY = window.scrollY || 0;

    if (window.innerWidth > MOBILE_BREAKPOINT || currentScrollY <= TOP_ZONE) {
      header.classList.remove('nav-hidden');
      lastDirection = 'up';
      lastScrollY = currentScrollY;
      return;
    }

    const delta = currentScrollY - lastScrollY;
    if (Math.abs(delta) < DELTA_THRESHOLD) return;

    if (delta > 0 && currentScrollY > 70 && lastDirection !== 'down') {
      header.classList.add('nav-hidden');
      lastDirection = 'down';
    } else if (delta < 0 && lastDirection !== 'up') {
      header.classList.remove('nav-hidden');
      lastDirection = 'up';
    }
    lastScrollY = currentScrollY;
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    },
    { passive: true }
  );

  window.addEventListener(
    'resize',
    () => {
      if (window.innerWidth > MOBILE_BREAKPOINT) header.classList.remove('nav-hidden');
    },
    { passive: true }
  );
}
