/**
 * Shared tool shell: unsaved-changes tracking, the Save / Build actions in the
 * top bar, and toast notifications.
 *
 * Every tool page gets the same contract — one Save button that writes the
 * source file, one Build button that regenerates dist/.
 */

import { runBuild } from './api.js';

let isDirty = false;
let saveHandler = null;

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ------------------------------------------------------------------ toast

export function toast(message, kind = 'info') {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    document.body.appendChild(host);
  }

  const element = document.createElement('div');
  element.className = `toast toast-${kind}`;
  element.textContent = message;
  host.appendChild(element);

  setTimeout(() => element.classList.add('is-leaving'), 2600);
  setTimeout(() => element.remove(), 3000);
}

// ------------------------------------------------------------ dirty state

export function markDirty() {
  setDirty(true);
}

export function setDirty(value) {
  isDirty = value;
  const button = document.getElementById('save-btn');
  if (button) {
    button.classList.toggle('is-dirty', value);
    button.textContent = value ? 'Save changes *' : 'Save changes';
  }
  const indicator = document.getElementById('dirty-indicator');
  if (indicator) indicator.textContent = value ? 'Unsaved changes' : 'All changes saved';
}

export const getDirty = () => isDirty;

// ---------------------------------------------------------------- actions

async function doSave() {
  if (!saveHandler) return;
  const button = document.getElementById('save-btn');
  button?.setAttribute('disabled', 'true');

  try {
    const result = await saveHandler();
    setDirty(false);
    toast(result?.saved ? `Saved ${result.saved}` : 'Saved', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    button?.removeAttribute('disabled');
  }
}

async function doBuild() {
  const button = document.getElementById('build-btn');
  const original = button?.textContent;
  button?.setAttribute('disabled', 'true');
  if (button) button.textContent = 'Building…';

  try {
    if (isDirty && saveHandler) await doSave();
    const result = await runBuild();
    toast(`Built ${result.pages} pages and ${result.posts} post page(s) in ${result.ms}ms`, 'success');
  } catch (err) {
    toast(`Build failed: ${err.message}`, 'error');
  } finally {
    button?.removeAttribute('disabled');
    if (button && original) button.textContent = original;
  }
}

/**
 * Wires the top bar.
 * @param {() => Promise<any>} onSave writes this tool's source file(s)
 */
export function initShell({ onSave }) {
  saveHandler = onSave;

  document.getElementById('save-btn')?.addEventListener('click', doSave);
  document.getElementById('build-btn')?.addEventListener('click', doBuild);

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      doSave();
    }
  });

  window.addEventListener('beforeunload', event => {
    if (!isDirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  setDirty(false);
}

// ----------------------------------------------------------------- helpers

/** `el('div', { class: 'x' }, 'text')` — small DOM builder. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : value);
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** A labelled form field bound to `object[key]`. */
export function field(label, object, key, { type = 'text', placeholder = '', rows = 0, onInput } = {}) {
  const input = rows
    ? el('textarea', { rows: String(rows), placeholder })
    : el('input', { type, placeholder });

  input.value = object[key] ?? '';
  input.addEventListener('input', () => {
    object[key] = input.value;
    markDirty();
    onInput?.(input.value);
  });

  return el('label', { class: 'field' }, el('span', { class: 'field-label' }, label), input);
}
