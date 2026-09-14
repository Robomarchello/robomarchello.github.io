/**
 * Post listing markup.
 *
 * Cards and tag pills are fully pre-baked, each carrying the data attributes
 * the browser needs to filter. No post JSON is shipped to the client and the
 * page is complete before any script runs.
 */

import { escapeHtml } from '../html.js';
import { url } from '../paths.js';

export const ALL_TAG = 'All';

/** Tag names in descending frequency, ties broken alphabetically. */
export function collectTags(posts) {
  const counts = new Map();
  for (const post of posts) {
    for (const tag of post.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return [[ALL_TAG, posts.length], ...ordered];
}

export function renderTagPills(posts) {
  return collectTags(posts)
    .map(([tag, count], index) => {
      const isActive = index === 0 ? ' is-active' : '';
      return `            <button type="button" class="tag-filter-pill${isActive}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)} <span class="tag-filter-count">${count}</span></button>`;
    })
    .join('\n');
}

export function postUrl(post) {
  return url(`/posts/${post.slug}.html`);
}

export function renderPostCard(post) {
  const tags = post.tags || [];
  const chips = tags
    .map(tag => `              <span class="post-tag-chip" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</span>`)
    .join('\n');

  const href = escapeHtml(postUrl(post));

  return `        <article class="post-card" id="post-card-${escapeHtml(post.id)}" data-tags="${escapeHtml(tags.join('|'))}" data-href="${href}" role="button" tabindex="0" aria-label="Read post: ${escapeHtml(post.title)}">
          <div class="post-meta-row">
            <time datetime="${escapeHtml(post.date)}" class="post-date">${escapeHtml(post.formattedDate)}</time>
            <div class="post-tags-list" aria-label="Tags">
${chips}
            </div>
          </div>
          <h3 class="post-title">
            <a href="${href}" class="post-title-link">${escapeHtml(post.title)}</a>
          </h3>
          <p class="post-description">${escapeHtml(post.description)}</p>
        </article>`;
}

export function renderPostsFeed(posts) {
  if (!posts.length) {
    return `        <div class="posts-empty-state">
          <h4 class="posts-empty-title">No posts yet</h4>
          <p class="posts-empty-desc">Nothing published so far — check back soon.</p>
        </div>`;
  }
  return posts.map(renderPostCard).join('\n');
}

/** Tag chips shown in a post page header. */
export function renderPostTagChips(post) {
  return (post.tags || [])
    .map(tag => `<span class="post-tag-chip">${escapeHtml(tag)}</span>`)
    .join('\n            ');
}
