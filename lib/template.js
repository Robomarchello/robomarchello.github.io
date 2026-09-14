/**
 * A deliberately tiny template engine — just enough for a static site.
 *
 *   {{> partial }}   include templates/partials/<name>.html (same data)
 *   {{{ value }}}    insert pre-rendered HTML verbatim
 *   {{ value }}      insert an HTML-escaped value
 *
 * Keys may be dotted paths ({{ site.title }}). Missing keys render as "".
 * Loops are intentionally absent: lists are built by the renderers in
 * lib/render/ where they can be unit-reasoned about as plain functions.
 */

import fs from 'fs';
import path from 'path';
import { PAGES_DIR, PARTIALS_DIR } from './paths.js';
import { escapeHtml } from './html.js';

const partialCache = new Map();

function readPartial(name) {
  if (!partialCache.has(name)) {
    const file = path.join(PARTIALS_DIR, `${name}.html`);
    if (!fs.existsSync(file)) throw new Error(`Missing partial: templates/partials/${name}.html`);
    partialCache.set(name, fs.readFileSync(file, 'utf-8'));
  }
  return partialCache.get(name);
}

function lookup(data, keyPath) {
  return keyPath.split('.').reduce((value, key) => (value == null ? undefined : value[key]), data);
}

export function render(template, data = {}, depth = 0) {
  if (depth > 10) throw new Error('Template partials nested too deeply (circular include?)');

  return template
    .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => render(readPartial(name), data, depth + 1))
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, key) => {
      const value = lookup(data, key);
      return value == null ? '' : String(value);
    })
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
      const value = lookup(data, key);
      return value == null ? '' : escapeHtml(value);
    });
}

export function renderPage(pageName, data = {}) {
  const file = path.join(PAGES_DIR, `${pageName}.html`);
  if (!fs.existsSync(file)) throw new Error(`Missing page template: templates/pages/${pageName}.html`);
  return render(fs.readFileSync(file, 'utf-8'), data);
}

/** Clears cached partials so the dev server picks up template edits. */
export function clearTemplateCache() {
  partialCache.clear();
}
