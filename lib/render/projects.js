/** Project cards for /projects.html, and the featured card on the home page. */

import { escapeHtml } from '../html.js';
import { url } from '../paths.js';
import { badgeIconMarkup, badgeName, linkIconMarkup } from '../icons.js';

const PLACEHOLDER_IMAGE = 'https://placehold.co/1920x1080/png';

const ARROW_SVG = `<span class="link-arrow-wrap" aria-hidden="true">
                  <svg class="link-arrow-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </span>`;

function imageSrc(project) {
  return url(project.media?.src || PLACEHOLDER_IMAGE);
}

function imageAlt(project) {
  return project.media?.alt || `${project.title || 'Project'} preview`;
}

function renderBadges(project, badges) {
  return (project.tools || [])
    .map(key => {
      const name = escapeHtml(badgeName(badges, key));
      return `                <span class="tool-badge" title="${name}" aria-label="${name}" data-badge="${escapeHtml(key)}">
                  ${badgeIconMarkup(badges, key)}
                  <span class="tool-tooltip">${name}</span>
                </span>`;
    })
    .join('\n');
}

function renderLinks(project) {
  return (project.links || [])
    .map(link => {
      const label = escapeHtml(link.label || 'View link');
      const href = escapeHtml(link.url || '#');
      return `              <a href="${href}" target="_blank" rel="noopener noreferrer" class="project-feed-link">
                ${linkIconMarkup(link.type || 'external')}
                <span class="link-label">${label}</span>
                ${ARROW_SVG}
              </a>`;
    })
    .join('\n');
}

export function renderProjectCard(project, badges) {
  const id = escapeHtml(project.id || 'project');
  const mediaId = id.replace(/^project-/, '');
  // data-tools is pre-baked so the browser can filter without shipping any JSON.
  const toolKeys = escapeHtml((project.tools || []).join('|'));

  return `        <!-- Project: ${escapeHtml(project.title || '')} -->
        <article class="project-feed-card" id="${id}" data-tools="${toolKeys}">
          <div class="project-feed-media" id="media-${escapeHtml(mediaId)}">
            <img src="${escapeHtml(imageSrc(project))}" alt="${escapeHtml(imageAlt(project))}" loading="lazy" width="1920" height="1080" />
          </div>
          <div class="project-feed-body">
            <div class="project-feed-header">
              <h2 class="project-feed-title">${escapeHtml(project.title || 'Untitled project')}</h2>
              <div class="project-tools-row" aria-label="Tools Used">
${renderBadges(project, badges)}
              </div>
            </div>
            <p class="project-feed-desc">${escapeHtml(project.description || '')}</p>
            <div class="project-feed-links">
${renderLinks(project)}
            </div>
          </div>
        </article>`;
}

export function renderProjectsFeed(projects, badges) {
  if (!projects.length) {
    return '        <p class="project-feed-desc">No projects published yet.</p>';
  }
  return projects.map(project => renderProjectCard(project, badges)).join('\n\n');
}

/** The single highlighted project on the home page. */
export function renderFeaturedProject(projects) {
  const featured = projects.find(p => p.featured) || projects[0];
  if (!featured) return '';

  return `        <div class="project-img" id="project-img-box">
          <img src="${escapeHtml(imageSrc(featured))}" alt="${escapeHtml(imageAlt(featured))}" loading="lazy" width="1920" height="1080" />
        </div>
        <div class="project-content" id="project-content-box">
          <h3>${escapeHtml(featured.title || '')}</h3>
          <p>${escapeHtml(featured.description || '')}</p>
          <a href="${escapeHtml(url(`/projects.html#${featured.id}`))}" class="btn" id="view-project-btn">View Project</a>
        </div>`;
}
