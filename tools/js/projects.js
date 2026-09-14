/**
 * Projects tool.
 *
 * Reads content/projects.json and content/badges.json from disk on load, and
 * Save writes content/projects.json straight back. Nothing is kept in
 * localStorage, which is why edits now survive a reload.
 *
 * Preview images are uploaded into assets/projects/ and stored as a path —
 * never as an inline base64 data URL.
 */

import { getContent, saveContent, upload, fileToBase64 } from './api.js';
import { initShell, markDirty, setDirty, toast, el, field, slugify } from './shell.js';

const LINK_TYPES = ['github', 'youtube', 'doc', 'demo', 'download', 'external'];

let projects = [];
let badges = {};
let selectedIndex = 0;

// ------------------------------------------------------------------ badges

function badgeIcon(key) {
  const badge = badges[key];
  if (badge?.icon) return el('img', { src: badge.icon, alt: badge.name || key });
  const span = el('span');
  span.innerHTML = badge?.svg || '?';
  return span;
}

const badgeLabel = key => badges[key]?.name || key;

// -------------------------------------------------------------------- list

function renderList() {
  const list = document.getElementById('project-list');
  list.replaceChildren();

  if (!projects.length) {
    list.append(el('div', { class: 'empty' }, 'No projects yet. Press + Add.'));
    return;
  }

  projects.forEach((project, index) => {
    list.append(
      el(
        'button',
        {
          type: 'button',
          class: `item${index === selectedIndex ? ' is-active' : ''}`,
          onclick: () => {
            selectedIndex = index;
            render();
          }
        },
        el(
          'span',
          { class: 'item-main' },
          el('span', { class: 'item-title' }, project.title || 'Untitled'),
          el('span', { class: 'item-sub' }, `${(project.tools || []).length} badge(s) · ${(project.links || []).length} link(s)`)
        ),
        project.featured ? el('span', { title: 'Featured on the home page' }, '★') : null
      )
    );
  });
}

// ------------------------------------------------------------------ editor

function renderToolPicker(project) {
  const chosen = el(
    'div',
    { class: 'chip-row' },
    ...(project.tools || []).map((key, index) =>
      el(
        'span',
        { class: 'chip', title: key },
        badgeIcon(key),
        badgeLabel(key),
        el('button', {
          type: 'button',
          title: 'Remove',
          onclick: () => {
            project.tools.splice(index, 1);
            markDirty();
            render();
          }
        }, '×')
      )
    )
  );

  const picker = el('select', {
    onchange: event => {
      const key = event.target.value;
      if (!key) return;
      project.tools = project.tools || [];
      if (!project.tools.includes(key)) {
        project.tools.push(key);
        markDirty();
        render();
      }
      event.target.value = '';
    }
  });

  picker.append(el('option', { value: '' }, 'Add a tool badge…'));
  for (const key of Object.keys(badges).sort()) {
    if ((project.tools || []).includes(key)) continue;
    picker.append(el('option', { value: key }, `${badges[key].name || key}  (${key})`));
  }

  return el(
    'div',
    {},
    el('div', { class: 'section-heading' }, 'Tool badges'),
    (project.tools || []).length ? chosen : el('p', { class: 'hint' }, 'No badges selected.'),
    el('div', { style: 'margin-top:.6rem' }, picker),
    el('p', { class: 'hint' }, 'Badges come from content/badges.json — manage them in the Badges tool.')
  );
}

function renderMedia(project) {
  project.media = project.media || {};

  const preview = project.media.src
    ? el('img', { src: project.media.src, alt: 'Preview' })
    : el('div', { class: 'empty' }, 'No image selected');

  const fileInput = document.getElementById('image-input');

  async function handleFile() {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const stem = slugify(project.id?.replace(/^project-/, '') || project.title || 'project');
      const ext = (file.name.match(/\.[^.]+$/) || ['.png'])[0];
      const result = await upload('projects', `${stem}${ext}`, await fileToBase64(file));
      project.media.src = result.path;
      markDirty();
      toast(`Uploaded ${result.filename}`, 'success');
      render();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      fileInput.value = '';
    }
  }

  fileInput.onchange = handleFile;

  return el(
    'div',
    {},
    el('div', { class: 'section-heading' }, 'Preview image'),
    el('div', { class: 'media-preview' }, preview),
    el(
      'div',
      { class: 'file-row' },
      el('button', { type: 'button', class: 'small', onclick: () => fileInput.click() }, 'Upload image…'),
      el('button', {
        type: 'button',
        class: 'small ghost',
        onclick: () => {
          project.media.src = '';
          markDirty();
          render();
        }
      }, 'Clear')
    ),
    field('Image path', project.media, 'src', { placeholder: '/assets/projects/name.png' }),
    field('Alt text', project.media, 'alt', { placeholder: 'Describes the image for screen readers' })
  );
}

function renderLinks(project) {
  project.links = project.links || [];

  const cards = project.links.map((link, index) => {
    const typeSelect = el('select', {
      onchange: event => {
        link.type = event.target.value;
        markDirty();
      }
    });
    for (const type of LINK_TYPES) {
      typeSelect.append(el('option', { value: type, selected: link.type === type }, type));
    }

    return el(
      'div',
      { class: 'subcard' },
      el(
        'div',
        { class: 'subcard-head' },
        el('strong', {}, `Link ${index + 1}`),
        el('button', {
          type: 'button',
          class: 'small danger',
          onclick: () => {
            project.links.splice(index, 1);
            markDirty();
            render();
          }
        }, 'Remove')
      ),
      field('Label', link, 'label', { placeholder: 'See source code' }),
      field('URL', link, 'url', { type: 'url', placeholder: 'https://…' }),
      el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Icon type'), typeSelect)
    );
  });

  return el(
    'div',
    {},
    el('div', { class: 'section-heading' }, 'Links'),
    ...cards,
    el('button', {
      type: 'button',
      class: 'small',
      onclick: () => {
        project.links.push({ label: 'New link', url: 'https://', type: 'external' });
        markDirty();
        render();
      }
    }, '+ Add link')
  );
}

function renderEditor() {
  const editor = document.getElementById('editor');
  editor.replaceChildren();

  const project = projects[selectedIndex];
  document.getElementById('editor-title').textContent = project ? project.title || 'Untitled' : 'Editor';

  if (!project) {
    editor.append(el('div', { class: 'empty' }, 'Select a project, or add one.'));
    return;
  }

  const featured = el('input', {
    type: 'checkbox',
    id: 'featured-toggle',
    checked: !!project.featured,
    onchange: event => {
      // Exactly one project is featured on the home page
      projects.forEach(p => {
        p.featured = false;
      });
      project.featured = event.target.checked;
      markDirty();
      render();
    }
  });

  editor.append(
    field('Title', project, 'title', { onInput: renderList }),
    field('ID (anchor on the projects page)', project, 'id', { placeholder: 'project-name' }),
    field('Description', project, 'description', { rows: 3 }),
    el('div', { class: 'checkbox' }, featured, el('label', { for: 'featured-toggle' }, 'Featured on the home page')),
    renderMedia(project),
    renderToolPicker(project),
    renderLinks(project)
  );
}

function render() {
  renderList();
  renderEditor();
}

// ----------------------------------------------------------------- actions

function addProject() {
  projects.push({
    id: `project-new-${projects.length + 1}`,
    title: 'New project',
    media: { src: '', alt: '' },
    tools: [],
    description: '',
    links: [],
    featured: projects.length === 0
  });
  selectedIndex = projects.length - 1;
  markDirty();
  render();
}

function deleteProject() {
  const project = projects[selectedIndex];
  if (!project) return;
  if (!window.confirm(`Delete "${project.title}"? This cannot be undone once saved.`)) return;

  projects.splice(selectedIndex, 1);
  selectedIndex = Math.max(0, selectedIndex - 1);
  markDirty();
  render();
}

function move(offset) {
  const target = selectedIndex + offset;
  if (target < 0 || target >= projects.length) return;
  [projects[selectedIndex], projects[target]] = [projects[target], projects[selectedIndex]];
  selectedIndex = target;
  markDirty();
  render();
}

// -------------------------------------------------------------------- boot

initShell({
  onSave: async () => {
    for (const project of projects) {
      project.id = project.id?.trim() || `project-${slugify(project.title)}`;
    }
    return saveContent('projects', projects);
  }
});

document.getElementById('add-project-btn').addEventListener('click', addProject);
document.getElementById('delete-project-btn').addEventListener('click', deleteProject);
document.getElementById('move-up-btn').addEventListener('click', () => move(-1));
document.getElementById('move-down-btn').addEventListener('click', () => move(1));

(async function load() {
  try {
    [projects, badges] = await Promise.all([getContent('projects'), getContent('badges')]);
    render();
    setDirty(false);
  } catch (err) {
    toast(err.message, 'error');
  }
})();
