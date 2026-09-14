/**
 * Posts tool. Reads and writes content/posts/*.md — the only place a post
 * lives. There is no posts.json to keep in sync any more.
 *
 * The preview is rendered server-side by lib/markdown.js, the exact module the
 * build uses, so the preview cannot drift from the published page.
 */

import { listPosts, getPost, savePost, deletePost, renderPreview, upload, fileToBase64 } from './api.js';
import { initShell, markDirty, setDirty, toast, el, field, slugify } from './shell.js';

const PREVIEW_DEBOUNCE_MS = 250;

let posts = [];
let current = null; // { slug, oldSlug, frontmatter, rawMarkdown }
let previewTimer = null;

// ----------------------------------------------------------------- preview

async function refreshPreview() {
  const target = document.getElementById('markdown-preview');
  if (!current) {
    target.replaceChildren();
    return;
  }
  try {
    const { html } = await renderPreview(current.rawMarkdown);
    target.innerHTML = html;
  } catch (err) {
    target.textContent = `Preview failed: ${err.message}`;
  }
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, PREVIEW_DEBOUNCE_MS);
}

// -------------------------------------------------------------------- list

function renderList() {
  const list = document.getElementById('post-list');
  list.replaceChildren();

  if (!posts.length) {
    list.append(el('div', { class: 'empty' }, 'No posts yet. Press + New.'));
    return;
  }

  for (const post of posts) {
    list.append(
      el(
        'button',
        {
          type: 'button',
          class: `item${current && post.slug === current.oldSlug ? ' is-active' : ''}`,
          onclick: () => selectPost(post.slug)
        },
        el(
          'span',
          { class: 'item-main' },
          el('span', { class: 'item-title' }, post.title || 'Untitled'),
          el('span', { class: 'item-sub' }, `${post.formattedDate} · ${(post.tags || []).join(', ') || 'no tags'}`)
        )
      )
    );
  }
}

// ------------------------------------------------------------- frontmatter

function renderFrontmatter() {
  const host = document.getElementById('frontmatter');
  host.replaceChildren();

  if (!current) {
    host.append(el('div', { class: 'empty' }, 'No post selected.'));
    return;
  }

  const fm = current.frontmatter;

  const slugInput = el('input', { type: 'text', value: current.slug });
  slugInput.addEventListener('input', () => {
    current.slug = slugify(slugInput.value);
    markDirty();
  });

  const tagsInput = el('input', {
    type: 'text',
    value: (fm.tags || []).join(', '),
    placeholder: 'Physics, Game Dev'
  });
  tagsInput.addEventListener('input', () => {
    fm.tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(Boolean);
    markDirty();
  });

  const dateInput = el('input', { type: 'date', value: String(fm.date || '').slice(0, 10) });
  dateInput.addEventListener('input', () => {
    fm.date = dateInput.value;
    markDirty();
  });

  host.append(
    field('Title', fm, 'title', {
      onInput: value => {
        document.getElementById('editor-title').textContent = value || 'Markdown';
      }
    }),
    el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Slug (file name & URL)'), slugInput),
    el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Date'), dateInput),
    el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Tags (comma separated)'), tagsInput),
    field('Description', fm, 'description', { rows: 2 }),
    field('Lead paragraph', fm, 'lead', { rows: 2 }),
    el('p', { class: 'hint' }, `Publishes to /posts/${current.slug || 'slug'}.html`)
  );
}

// ------------------------------------------------------------------ editor

function renderEditor() {
  const input = document.getElementById('markdown-input');
  input.value = current?.rawMarkdown ?? '';
  input.disabled = !current;
  document.getElementById('editor-title').textContent = current?.frontmatter.title || 'Markdown';
}

function render() {
  renderList();
  renderFrontmatter();
  renderEditor();
  schedulePreview();
}

// ----------------------------------------------------------------- actions

async function selectPost(slug) {
  try {
    const post = await getPost(slug);
    current = {
      slug: post.slug,
      oldSlug: post.slug,
      frontmatter: { ...post.frontmatter, title: post.title, date: post.date, tags: post.tags, description: post.description, lead: post.lead },
      rawMarkdown: post.rawMarkdown
    };
    setDirty(false);
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function addPost() {
  const today = new Date().toISOString().slice(0, 10);
  current = {
    slug: 'new-post',
    oldSlug: null,
    frontmatter: { title: 'New post', date: today, tags: [], description: '', lead: '' },
    rawMarkdown: '## Introduction\n\nStart writing here.\n'
  };
  markDirty();
  render();
}

async function removePost() {
  if (!current?.oldSlug) {
    current = null;
    render();
    return;
  }
  if (!window.confirm(`Delete "${current.frontmatter.title}"? The markdown file is removed from disk.`)) return;

  try {
    await deletePost(current.oldSlug);
    toast('Post deleted', 'success');
    current = null;
    posts = await listPosts();
    setDirty(false);
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function insertImage() {
  const input = document.getElementById('asset-input');
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file || !current) return;
    try {
      const result = await upload('posts', file.name, await fileToBase64(file));
      const textarea = document.getElementById('markdown-input');
      const snippet = `\n![${file.name.replace(/\.[^.]+$/, '')}](${result.path})\n`;
      const at = textarea.selectionStart ?? textarea.value.length;

      textarea.value = textarea.value.slice(0, at) + snippet + textarea.value.slice(at);
      current.rawMarkdown = textarea.value;
      markDirty();
      schedulePreview();
      toast(`Uploaded ${result.filename}`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      input.value = '';
    }
  };
  input.click();
}

// -------------------------------------------------------------------- boot

initShell({
  onSave: async () => {
    if (!current) throw new Error('No post selected');

    current.slug = slugify(current.slug || current.frontmatter.title);
    if (!current.slug) throw new Error('The post needs a slug');

    const frontmatter = { ...current.frontmatter, slug: current.slug, id: current.slug };
    const result = await savePost(current.slug, {
      slug: current.slug,
      oldSlug: current.oldSlug,
      frontmatter,
      rawMarkdown: current.rawMarkdown
    });

    current.oldSlug = current.slug;
    posts = await listPosts();
    renderList();
    return result;
  }
});

document.getElementById('add-post-btn').addEventListener('click', addPost);
document.getElementById('delete-post-btn').addEventListener('click', removePost);
document.getElementById('insert-image-btn').addEventListener('click', insertImage);

document.getElementById('markdown-input').addEventListener('input', event => {
  if (!current) return;
  current.rawMarkdown = event.target.value;
  markDirty();
  schedulePreview();
});

(async function load() {
  try {
    posts = await listPosts();
    render();
    if (posts.length) await selectPost(posts[0].slug);
  } catch (err) {
    toast(err.message, 'error');
  }
})();
