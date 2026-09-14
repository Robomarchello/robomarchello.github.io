/**
 * Badges tool.
 *
 * New badges are created by uploading an image into assets/icons/ and storing
 * the path in `icon`. The built-in badges keep their inline `svg`; when both
 * are present `icon` wins, matching lib/icons.js.
 *
 * "Used in N projects" is computed from content/projects.json — each project's
 * `tools` array holds badge keys, so the count is a real lookup rather than
 * the hardcoded zero it used to show.
 */

import { getContent, saveContent, getBadgeUsage, upload, fileToBase64 } from './api.js';
import { initShell, markDirty, setDirty, toast, el, field, slugify } from './shell.js';

let badges = {};
let usage = {};
let projects = [];
let selectedKey = null;
let categoryFilter = 'all';
let searchQuery = '';

function iconNode(badge, key) {
  if (badge?.icon) return el('img', { src: badge.icon, alt: badge.name || key });
  const span = el('span');
  span.innerHTML = badge?.svg || '?';
  return span;
}

function categories() {
  return [...new Set(Object.values(badges).map(badge => badge.category).filter(Boolean))].sort();
}

/** Projects that reference a badge, by title — shown under the count. */
function usersOf(key) {
  return projects.filter(project => (project.tools || []).includes(key)).map(project => project.title);
}

// ------------------------------------------------------------------- grid

function renderGrid() {
  const grid = document.getElementById('badge-grid');
  grid.replaceChildren();

  const query = searchQuery.trim().toLowerCase();
  const keys = Object.keys(badges)
    .filter(key => categoryFilter === 'all' || badges[key].category === categoryFilter)
    .filter(key => !query || key.includes(query) || (badges[key].name || '').toLowerCase().includes(query))
    .sort();

  if (!keys.length) {
    grid.append(el('div', { class: 'empty' }, 'No badges match.'));
    return;
  }

  for (const key of keys) {
    const badge = badges[key];
    const count = usage[key] || 0;

    grid.append(
      el(
        'button',
        {
          type: 'button',
          class: `badge-tile${key === selectedKey ? ' is-active' : ''}`,
          title: key,
          onclick: () => {
            selectedKey = key;
            render();
          }
        },
        el('span', { class: 'badge-icon' }, iconNode(badge, key)),
        el('span', { class: 'badge-name' }, badge.name || key),
        el('span', { class: `badge-usage${count ? ' is-used' : ''}` }, count ? `${count} project${count === 1 ? '' : 's'}` : 'unused')
      )
    );
  }
}

// ----------------------------------------------------------------- editor

function renderEditor() {
  const editor = document.getElementById('editor');
  editor.replaceChildren();

  if (!selectedKey || !badges[selectedKey]) {
    editor.append(el('div', { class: 'empty' }, 'Pick a badge, or create one.'));
    return;
  }

  const key = selectedKey;
  const badge = badges[key];
  const users = usersOf(key);
  const fileInput = document.getElementById('icon-input');

  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const ext = (file.name.match(/\.[^.]+$/) || ['.webp'])[0];
      const result = await upload('icons', `${key}${ext}`, await fileToBase64(file));
      badge.icon = result.path;
      markDirty();
      toast(`Uploaded ${result.filename}`, 'success');
      render();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      fileInput.value = '';
    }
  };

  // Renaming the key has to move the entry and repoint every project using it
  const keyInput = el('input', { type: 'text', value: key });
  keyInput.addEventListener('change', () => {
    const nextKey = slugify(keyInput.value).replace(/-/g, '');
    if (!nextKey || nextKey === key) {
      keyInput.value = key;
      return;
    }
    if (badges[nextKey]) {
      toast(`A badge named "${nextKey}" already exists.`, 'error');
      keyInput.value = key;
      return;
    }
    badges[nextKey] = badge;
    delete badges[key];
    usage[nextKey] = usage[key] || 0;
    delete usage[key];
    selectedKey = nextKey;
    markDirty();
    toast(`Renamed to "${nextKey}". Projects using it update on save.`, 'info');
    render();
  });

  editor.append(
    el('div', { class: 'media-preview' }, el('span', { class: 'badge-icon', style: 'width:64px;height:64px' }, iconNode(badge, key))),
    el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Key (used by projects)'), keyInput),
    field('Display name', badge, 'name', { onInput: render }),
    field('Category', badge, 'category', { placeholder: 'Hardware & Embedded' }),

    el('div', { class: 'section-heading' }, 'Icon'),
    el(
      'div',
      { class: 'file-row' },
      el('button', { type: 'button', class: 'small', onclick: () => fileInput.click() }, 'Upload image…'),
      badge.icon
        ? el('button', {
            type: 'button',
            class: 'small ghost',
            onclick: () => {
              delete badge.icon;
              markDirty();
              render();
            }
          }, badge.svg ? 'Use built-in SVG' : 'Clear')
        : null
    ),
    field('Icon path', badge, 'icon', { placeholder: '/assets/icons/name.webp' }),
    el('p', { class: 'hint' }, badge.svg ? 'This badge also has inline SVG; the icon path takes priority.' : 'Images live in assets/icons/.'),

    el('div', { class: 'section-heading' }, 'Used in projects'),
    el('p', {}, users.length ? `${users.length} project${users.length === 1 ? '' : 's'} use this badge:` : 'No projects use this badge yet.'),
    users.length ? el('ul', { class: 'hint', style: 'margin:.35rem 0 0;padding-left:1.1rem' }, ...users.map(title => el('li', {}, title))) : null,

    el('div', { class: 'section-heading' }, 'Danger zone'),
    el('button', {
      type: 'button',
      class: 'small danger',
      onclick: () => {
        if (users.length && !window.confirm(`${users.length} project(s) use "${key}". Delete anyway?`)) return;
        if (!users.length && !window.confirm(`Delete badge "${key}"?`)) return;
        delete badges[key];
        selectedKey = null;
        markDirty();
        render();
      }
    }, 'Delete badge')
  );
}

function renderFilters() {
  const select = document.getElementById('category-filter');
  const current = categoryFilter;
  select.replaceChildren(el('option', { value: 'all' }, 'All categories'));
  for (const category of categories()) {
    select.append(el('option', { value: category, selected: category === current }, category));
  }
  select.value = current;
}

function render() {
  renderFilters();
  renderGrid();
  renderEditor();
}

// ----------------------------------------------------------------- actions

function addBadge() {
  let key = 'newbadge';
  let suffix = 1;
  while (badges[key]) key = `newbadge${++suffix}`;

  badges[key] = { name: 'New badge', category: 'Custom', icon: '' };
  selectedKey = key;
  markDirty();
  render();
}

// -------------------------------------------------------------------- boot

initShell({
  onSave: async () => {
    // Keep project references in step with any key renames made here
    const validKeys = new Set(Object.keys(badges));
    let repointed = 0;
    for (const project of projects) {
      const before = (project.tools || []).length;
      project.tools = (project.tools || []).filter(toolKey => validKeys.has(toolKey));
      repointed += before - project.tools.length;
    }
    if (repointed) await saveContent('projects', projects);

    const result = await saveContent('badges', badges);
    usage = await getBadgeUsage();
    render();
    return result;
  }
});

document.getElementById('add-badge-btn').addEventListener('click', addBadge);
document.getElementById('category-filter').addEventListener('change', event => {
  categoryFilter = event.target.value;
  renderGrid();
});
document.getElementById('badge-search').addEventListener('input', event => {
  searchQuery = event.target.value;
  renderGrid();
});

(async function load() {
  try {
    [badges, projects, usage] = await Promise.all([getContent('badges'), getContent('projects'), getBadgeUsage()]);
    render();
    setDirty(false);
  } catch (err) {
    toast(err.message, 'error');
  }
})();
