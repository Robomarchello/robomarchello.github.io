/**
 * Links tool. Reads and writes content/links.json.
 *
 * A link is either `standard` (an anchor) or `email` (obfuscated user/host
 * that the links page reassembles and turns into click-to-copy).
 */

import { getContent, saveContent } from './api.js';
import { initShell, markDirty, setDirty, toast, el, field, slugify } from './shell.js';

let data = { sections: [] };
let selectedIndex = 0;

const sections = () => data.sections || (data.sections = []);

// -------------------------------------------------------------------- list

function renderList() {
  const list = document.getElementById('section-list');
  list.replaceChildren();

  if (!sections().length) {
    list.append(el('div', { class: 'empty' }, 'No sections yet. Press + Add.'));
    return;
  }

  sections().forEach((section, index) => {
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
          el('span', { class: 'item-title' }, section.title || 'Untitled section'),
          el('span', { class: 'item-sub' }, `${(section.links || []).length} link(s)`)
        )
      )
    );
  });
}

// ------------------------------------------------------------------ editor

function renderLinkCard(section, link, index) {
  const typeSelect = el('select', {
    onchange: event => {
      link.type = event.target.value;
      markDirty();
      render();
    }
  });
  for (const type of ['standard', 'email']) {
    typeSelect.append(el('option', { value: type, selected: (link.type || 'standard') === type }, type));
  }

  const targetSelect = el('select', {
    onchange: event => {
      link.target = event.target.value;
      markDirty();
    }
  });
  for (const target of ['_blank', '_self']) {
    targetSelect.append(el('option', { value: target, selected: (link.target || '_blank') === target }, target === '_blank' ? 'new tab' : 'same tab'));
  }

  const specific =
    link.type === 'email'
      ? [
          el('div', { class: 'field-row' }, field('Email user', link, 'emailUser', { placeholder: 'me' }), field('Email host', link, 'emailHost', { placeholder: 'example.com' })),
          el('p', { class: 'hint' }, 'Published obfuscated as "me [at] example.com" and reassembled in the browser.')
        ]
      : [
          field('URL', link, 'url', { type: 'url', placeholder: 'https://…' }),
          field('Shown as', link, 'displayUrl', { placeholder: 'example.com/me' }),
          el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Opens in'), targetSelect)
        ];

  return el(
    'div',
    { class: 'subcard' },
    el(
      'div',
      { class: 'subcard-head' },
      el('strong', {}, `Link ${index + 1}`),
      el(
        'span',
        { style: 'display:flex;gap:.35rem' },
        el('button', {
          type: 'button',
          class: 'small ghost',
          title: 'Move up',
          onclick: () => {
            if (index === 0) return;
            [section.links[index - 1], section.links[index]] = [section.links[index], section.links[index - 1]];
            markDirty();
            render();
          }
        }, '↑'),
        el('button', {
          type: 'button',
          class: 'small ghost',
          title: 'Move down',
          onclick: () => {
            if (index >= section.links.length - 1) return;
            [section.links[index + 1], section.links[index]] = [section.links[index], section.links[index + 1]];
            markDirty();
            render();
          }
        }, '↓'),
        el('button', {
          type: 'button',
          class: 'small danger',
          onclick: () => {
            section.links.splice(index, 1);
            markDirty();
            render();
          }
        }, 'Remove')
      )
    ),
    field('Title', link, 'title', { placeholder: 'GitHub' }),
    el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Type'), typeSelect),
    ...specific
  );
}

function renderEditor() {
  const editor = document.getElementById('editor');
  editor.replaceChildren();

  const section = sections()[selectedIndex];
  document.getElementById('editor-title').textContent = section ? section.title || 'Untitled section' : 'Section';

  if (!section) {
    editor.append(el('div', { class: 'empty' }, 'Select a section, or add one.'));
    return;
  }

  section.links = section.links || [];

  editor.append(
    field('Heading', section, 'title', { onInput: renderList }),
    field('ID (anchor)', section, 'id', { placeholder: 'contact-section' }),
    el('div', { class: 'section-heading' }, 'Links'),
    ...section.links.map((link, index) => renderLinkCard(section, link, index)),
    el('button', {
      type: 'button',
      class: 'small',
      onclick: () => {
        section.links.push({ id: `link-${Date.now()}`, title: 'New link', url: 'https://', displayUrl: '', target: '_blank', type: 'standard' });
        markDirty();
        render();
      }
    }, '+ Add link')
  );
}

function render() {
  renderList();
  renderEditor();
}

// ----------------------------------------------------------------- actions

function addSection() {
  sections().push({ id: `section-${sections().length + 1}`, title: 'New section', links: [] });
  selectedIndex = sections().length - 1;
  markDirty();
  render();
}

function deleteSection() {
  const section = sections()[selectedIndex];
  if (!section) return;
  if (!window.confirm(`Delete section "${section.title}" and its ${(section.links || []).length} link(s)?`)) return;

  sections().splice(selectedIndex, 1);
  selectedIndex = Math.max(0, selectedIndex - 1);
  markDirty();
  render();
}

function move(offset) {
  const target = selectedIndex + offset;
  if (target < 0 || target >= sections().length) return;
  [sections()[selectedIndex], sections()[target]] = [sections()[target], sections()[selectedIndex]];
  selectedIndex = target;
  markDirty();
  render();
}

// -------------------------------------------------------------------- boot

initShell({
  onSave: async () => {
    for (const section of sections()) {
      section.id = section.id?.trim() || `${slugify(section.title)}-section`;
      for (const link of section.links || []) {
        link.id = link.id?.trim() || `link-${slugify(link.title)}`;
        if (link.type !== 'email' && !link.displayUrl) {
          link.displayUrl = String(link.url || '').replace(/^https?:\/\//, '');
        }
      }
    }
    return saveContent('links', data);
  }
});

document.getElementById('add-section-btn').addEventListener('click', addSection);
document.getElementById('delete-section-btn').addEventListener('click', deleteSection);
document.getElementById('move-up-btn').addEventListener('click', () => move(-1));
document.getElementById('move-down-btn').addEventListener('click', () => move(1));

(async function load() {
  try {
    data = await getContent('links');
    render();
    setDirty(false);
  } catch (err) {
    toast(err.message, 'error');
  }
})();
