/**
 * Shared page chrome: navigation, footer, and the inline script that applies
 * the saved palette before first paint.
 *
 * These used to be hand-copied into all eight HTML files, which is how the
 * nav and footer drifted apart between pages.
 */

import { escapeHtml } from '../html.js';
import { url } from '../paths.js';
import { socialIconMarkup } from '../icons.js';
import { PALETTES, DARK_BG, STORAGE_KEY, getReadableDarkAccent } from '../../src/scripts/theme.js';

export function renderNav(site, activeHref) {
  return (site.nav || [])
    .map(item => {
      const active = item.href === activeHref ? ' class="active"' : '';
      return `          <a href="${escapeHtml(url(item.href))}"${active}>${escapeHtml(item.label)}</a>`;
    })
    .join('\n');
}

export function renderSocials(site) {
  return (site.socials || [])
    .map(
      social => `        <a href="${escapeHtml(social.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(social.label)}">
          ${socialIconMarkup(social.icon)}
        </a>`
    )
    .join('\n');
}

/**
 * Inline, render-blocking palette bootstrap. Values are derived from the same
 * PALETTES array the runtime uses, so the two can never disagree.
 *
 * @param {'light'|'dark'} scheme light pages paint the palette background,
 *   dark (post) pages always paint DARK_BG and only need the lifted accents.
 */
export function renderThemeBootstrap(scheme = 'light') {
  const accents = PALETTES.map(p => getReadableDarkAccent(p.accent));
  const accentHovers = PALETTES.map(p => getReadableDarkAccent(p.accentHover));

  const lightData = JSON.stringify(
    PALETTES.map(p => [p.bg, p.cardBg, p.textMain, p.textMuted, p.accent, p.accentHover])
  );
  const darkData = JSON.stringify(accents.map((accent, i) => [accent, accentHovers[i]]));

  const body = `          var p = ${lightData}[idx] || ${lightData}[0];
          var d = ${darkData}[idx] || ${darkData}[0];
          r.setProperty('--bg-color', p[0]);
          r.setProperty('--card-bg', p[1]);
          r.setProperty('--text-main', p[2]);
          r.setProperty('--text-muted', p[3]);
          r.setProperty('--accent-color', p[4]);
          r.setProperty('--accent-hover', p[5]);
          r.setProperty('--posts-accent', d[0]);
          r.setProperty('--posts-accent-hover', d[1]);
          r.setProperty('--accent-readable-dark', d[0]);
          r.setProperty('--accent-readable-dark-hover', d[1]);
          document.documentElement.style.backgroundColor = p[0];`;

  return `<script>
      (function() {
        try {
          var idx = parseInt(localStorage.getItem('${STORAGE_KEY}'), 10) || 0;
          var r = document.documentElement.style;
${body}
          requestAnimationFrame(function() {
            requestAnimationFrame(function() {
              document.documentElement.classList.remove('is-loading');
            });
          });
        } catch (e) {
          document.documentElement.classList.remove('is-loading');
        }
      })();
    </script>`;
}
