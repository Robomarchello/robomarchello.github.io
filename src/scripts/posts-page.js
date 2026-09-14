/**
 * Posts listing: tag filtering and the two-row tag overflow toggle.
 *
 * Every card and pill is already in the HTML with a `data-tags` attribute, so
 * this script only ever shows and hides existing nodes. Nothing is fetched and
 * nothing is re-rendered — the page is complete before this file loads.
 */

import { onReady } from './page.js';

const ALL_TAG = 'All';
const VISIBLE_TAG_ROWS = 2;

let activeTag = ALL_TAG;
let isTagsExpanded = false;

const cardTags = new WeakMap();

function tagsOf(card) {
  if (!cardTags.has(card)) {
    cardTags.set(card, (card.dataset.tags || '').split('|').map(t => t.trim()).filter(Boolean));
  }
  return cardTags.get(card);
}

function applyFilter() {
  const cards = Array.from(document.querySelectorAll('.post-card'));
  const countEl = document.getElementById('filter-results-count');
  const emptyState = document.getElementById('posts-empty-state');

  let visible = 0;
  for (const card of cards) {
    const tags = tagsOf(card);
    const matches = activeTag === ALL_TAG || tags.some(t => t.toLowerCase() === activeTag.toLowerCase());
    card.hidden = !matches;
    card.style.display = matches ? '' : 'none';
    if (matches) visible += 1;
  }

  document.querySelectorAll('.tag-filter-pill').forEach(pill => {
    const isMatching = (pill.dataset.tag || '').toLowerCase() === activeTag.toLowerCase();
    pill.classList.toggle('is-active', isMatching);
  });

  if (countEl) {
    const showCount = activeTag !== ALL_TAG;
    countEl.style.display = showCount ? 'inline-block' : 'none';
    countEl.textContent = showCount ? `Showing ${visible} post${visible === 1 ? '' : 's'} in "${activeTag}"` : '';
  }

  if (emptyState) {
    emptyState.style.display = visible === 0 && cards.length > 0 ? '' : 'none';
    const nameEl = document.getElementById('empty-tag-name');
    if (nameEl) nameEl.textContent = activeTag;
  }
}

function selectTag(tag) {
  activeTag = tag;
  applyFilter();
}

/**
 * Collapses the pill row to two rows when it wraps further, revealing a
 * "show more" toggle. Pills are grouped into rows by their offset from the
 * top of the container.
 */
function updateTagOverflow() {
  const container = document.getElementById('tags-row');
  const toggle = document.getElementById('tags-overflow-toggle');
  if (!container || !toggle) return;

  const pills = Array.from(container.querySelectorAll('.tag-filter-pill'));
  if (!pills.length) {
    toggle.style.display = 'none';
    return;
  }

  // Measure with everything visible
  pills.forEach(pill => {
    pill.style.display = '';
  });
  container.style.maxHeight = 'none';
  container.classList.remove('is-collapsed');

  const containerTop = container.getBoundingClientRect().top;
  const rows = new Map();
  for (const pill of pills) {
    const offset = Math.round(Math.round(pill.getBoundingClientRect().top - containerTop) / 8) * 8;
    if (!rows.has(offset)) rows.set(offset, []);
    rows.get(offset).push(pill);
  }

  const rowKeys = [...rows.keys()].sort((a, b) => a - b);
  if (rowKeys.length <= VISIBLE_TAG_ROWS) {
    toggle.style.display = 'none';
    return;
  }

  toggle.style.display = 'inline-flex';
  const kept = new Set(rowKeys.slice(0, VISIBLE_TAG_ROWS).flatMap(key => rows.get(key)));
  const hidden = pills.filter(pill => !kept.has(pill));
  const toggleText = toggle.querySelector('.toggle-text');

  if (isTagsExpanded) {
    container.classList.remove('is-collapsed');
    container.style.maxHeight = `${container.scrollHeight + 10}px`;
    toggle.classList.add('is-expanded');
    toggle.setAttribute('aria-expanded', 'true');
    if (toggleText) toggleText.textContent = 'Show fewer tags';
    return;
  }

  const cutoff = Math.ceil(Math.max(...[...kept].map(p => p.getBoundingClientRect().bottom - containerTop))) + 2;
  container.classList.add('is-collapsed');
  container.style.maxHeight = `${cutoff}px`;
  hidden.forEach(pill => {
    pill.style.display = 'none';
  });
  toggle.classList.remove('is-expanded');
  toggle.setAttribute('aria-expanded', 'false');
  if (toggleText) toggleText.textContent = `Show more tags (+${hidden.length})`;
}

function initEvents() {
  const tagsRow = document.getElementById('tags-row');
  if (tagsRow) {
    tagsRow.addEventListener('click', event => {
      const pill = event.target.closest('.tag-filter-pill');
      if (pill?.dataset.tag) selectTag(pill.dataset.tag);
    });
  }

  const toggle = document.getElementById('tags-overflow-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      isTagsExpanded = !isTagsExpanded;
      updateTagOverflow();
    });
  }

  const resetBtn = document.getElementById('empty-reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', () => selectTag(ALL_TAG));

  const feed = document.getElementById('posts-feed');
  if (feed) {
    feed.addEventListener('click', event => {
      // A chip inside a card filters rather than navigating
      const chip = event.target.closest('.post-tag-chip');
      if (chip?.dataset.tag) {
        event.preventDefault();
        selectTag(chip.dataset.tag);
        document.getElementById('browse-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      if (event.target.closest('.post-title-link')) return; // let the anchor work

      const card = event.target.closest('.post-card');
      if (card?.dataset.href) window.location.href = card.dataset.href;
    });

    feed.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('.post-title-link')) return;

      const card = event.target.closest('.post-card');
      if (card?.dataset.href) {
        event.preventDefault();
        window.location.href = card.dataset.href;
      }
    });
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateTagOverflow, 150);
  });
}

onReady(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const tagParam = urlParams.get('tag') || (window.location.hash ? decodeURIComponent(window.location.hash.replace(/^#tag=/, '').replace(/^#/, '')) : null);
  if (tagParam) {
    activeTag = tagParam;
  }
  initEvents();
  applyFilter();
  requestAnimationFrame(updateTagOverflow);
});
