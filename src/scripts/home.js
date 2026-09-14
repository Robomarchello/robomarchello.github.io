/** Home page: the days-since counter and the springy hero title. */

import { onReady } from './page.js';

const WAVE_INTERVAL_MS = 4000;
const WAVE_STAGGER_S = 0.065;

function initDaysCounter() {
  const element = document.getElementById('python-days');
  if (!element) return;

  const since = new Date(element.dataset.since || '2020-10-01');
  const days = Math.ceil(Math.abs(Date.now() - since.getTime()) / 86400000);
  element.textContent = days.toLocaleString();
}

function initTitleAnimation() {
  const heroTitle = document.getElementById('hero-title');
  const chars = Array.from(document.querySelectorAll('.hero h1 .char'));
  if (!chars.length) return;

  let recurringTimer = null;

  function triggerWave() {
    chars.forEach((char, index) => {
      // Never interrupt a character the visitor is currently poking at
      if (char.matches(':hover') || char.classList.contains('is-bouncing')) return;

      char.classList.remove('is-wave');
      void char.offsetWidth; // reflow so the animation restarts cleanly
      char.style.animationDelay = `${index * WAVE_STAGGER_S}s`;
      char.classList.add('is-wave');
    });
  }

  function startTimer() {
    clearInterval(recurringTimer);
    recurringTimer = setInterval(triggerWave, WAVE_INTERVAL_MS);
  }

  setTimeout(() => {
    triggerWave();
    startTimer();
  }, 350);

  // Pause while the tab is hidden so animations don't queue up
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(recurringTimer);
    } else {
      triggerWave();
      startTimer();
    }
  });

  if (heroTitle) {
    heroTitle.addEventListener('click', event => {
      if (event.target?.classList.contains('char')) return;
      triggerWave();
      startTimer();
    });
  }

  chars.forEach(char => {
    const bounce = () => {
      char.classList.remove('is-wave', 'is-bouncing');
      char.style.animationDelay = '0s';
      void char.offsetWidth;
      char.classList.add('is-bouncing');
    };

    char.addEventListener('mouseenter', bounce);
    char.addEventListener('touchstart', bounce, { passive: true });
    char.addEventListener('animationend', event => {
      if (event.animationName === 'elasticCartoonWave' || event.animationName === 'elasticIntroWave') {
        char.classList.remove('is-wave');
      }
      if (event.animationName === 'elasticJellyPop') {
        char.classList.remove('is-bouncing');
      }
    });
  });
}

onReady(() => {
  initDaysCounter();
  initTitleAnimation();
});
