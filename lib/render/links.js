/** Link sections for /links.html. */

import { escapeHtml } from '../html.js';
import { url } from '../paths.js';

const EXTERNAL_ARROW = '<svg class="link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';

const COPY_ICON = '<svg class="email-copy-icon" id="email-copy-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

/**
 * Email blocks ship obfuscated (user / host in separate spans and data
 * attributes); links.js reassembles them for real visitors.
 */
function renderEmailBlock(link, id, title) {
  const user = escapeHtml(link.emailUser || 'user');
  const host = escapeHtml(link.emailHost || 'example.com');

  return `          <!-- Email: obfuscated against scrapers, click to copy -->
          <div class="link-block" id="${id}" role="button" tabindex="0" title="Click to copy email address" aria-label="Copy email address" data-u="${user}" data-h="${host}">
            <h3 class="link-block-title">${title}</h3>
            <div class="link-block-right">
              <span class="link-block-url" id="email-address-text">
                <span class="u-text">${user}</span><span class="at-text"> [at] </span><span class="h-text">${host}</span>
              </span>
              <span class="email-copy-btn" id="email-copy-status" title="Click to copy" aria-label="Copy email address">
                <span class="copy-badge-label" aria-hidden="true">Copied!</span>
                ${COPY_ICON}
              </span>
            </div>
          </div>`;
}

export function renderLinkItem(link) {
  const id = escapeHtml(link.id || 'link');
  const title = escapeHtml(link.title || 'Untitled link');

  if (link.type === 'email') return renderEmailBlock(link, id, title);

  const href = escapeHtml(url(link.url || '#'));
  const displayUrl = escapeHtml(link.displayUrl || link.url || '');
  const target = link.target === '_self' ? '' : ' target="_blank" rel="noopener noreferrer"';

  return `          <a href="${href}"${target} class="link-block" id="${id}">
            <h3 class="link-block-title">${title}</h3>
            <div class="link-block-right">
              <span class="link-block-url">${displayUrl}</span>
              ${EXTERNAL_ARROW}
            </div>
          </a>`;
}

export function renderLinkSection(section, index = 0) {
  const id = escapeHtml(section.id || `section-${index}`);
  const title = escapeHtml(section.title || 'Section');
  const stackId = id.endsWith('-section') ? id.replace(/-section$/, '-stack') : `${id}-stack`;
  const items = (section.links || []).map(renderLinkItem).join('\n\n');

  return `      <!-- Section ${index + 1}: ${title} -->
      <section class="links-section" id="${id}">
        <h2 class="section-title">${title}</h2>
        <div class="links-stack" id="${stackId}">
${items}
        </div>
      </section>`;
}

export function renderLinkSections(linksData) {
  return (linksData?.sections || []).map(renderLinkSection).join('\n\n');
}
