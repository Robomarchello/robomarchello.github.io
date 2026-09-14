/** Canonical filesystem layout. Every module resolves paths through here. */

import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const CONTENT_DIR = path.join(ROOT, 'content');
export const POSTS_DIR = path.join(CONTENT_DIR, 'posts');

export const TEMPLATES_DIR = path.join(ROOT, 'templates');
export const PAGES_DIR = path.join(TEMPLATES_DIR, 'pages');
export const PARTIALS_DIR = path.join(TEMPLATES_DIR, 'partials');

export const SRC_DIR = path.join(ROOT, 'src');
export const SCRIPTS_DIR = path.join(SRC_DIR, 'scripts');
export const STYLES_DIR = path.join(SRC_DIR, 'styles');

export const ASSETS_DIR = path.join(ROOT, 'assets');
export const ICONS_DIR = path.join(ASSETS_DIR, 'icons');
export const PROJECT_IMAGES_DIR = path.join(ASSETS_DIR, 'projects');
export const POST_ASSETS_DIR = path.join(ASSETS_DIR, 'posts');

export const DIST_DIR = path.join(ROOT, 'dist');

export const TOOLS_DIR = path.join(ROOT, 'tools');

/**
 * Deployment base path. GitHub Pages project sites live under /<repo>/,
 * user sites and custom domains under /.
 */
export function basePath() {
  const raw = process.env.BASE_PATH || '/';
  const withLead = raw.startsWith('/') ? raw : `/${raw}`;
  return withLead.endsWith('/') ? withLead : `${withLead}/`;
}

/** Rewrites a root-absolute site URL ("/posts.html") for the deployment base. */
export function url(sitePath) {
  const base = basePath();
  if (!sitePath) return base;
  if (/^([a-z]+:)?\/\//i.test(sitePath) || sitePath.startsWith('mailto:') || sitePath.startsWith('#')) {
    return sitePath;
  }
  if (!sitePath.startsWith('/')) return sitePath;
  return base + sitePath.slice(1);
}
