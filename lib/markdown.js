/**
 * Markdown → HTML. The one and only post rendering pipeline.
 *
 * Used by the build (to generate post pages) and by the tools dev server
 * (to render the live editor preview), so what you see while writing is
 * byte-for-byte what gets published.
 */

import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import Prism from 'prismjs';
import loadLanguages from 'prismjs/components/index.js';
import { escapeHtml, slugify } from './html.js';

loadLanguages(['javascript', 'typescript', 'c', 'cpp', 'python', 'bash', 'json', 'css', 'markdown', 'yaml']);

const LANGUAGE_ALIASES = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  'c++': 'cpp'
};

function createRenderer() {
  const renderer = new marked.Renderer();

  renderer.heading = function heading({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const rawText = tokens.map(t => t.raw || t.text || '').join('');
    const id = slugify(rawText);
    const anchor = `<a href="#${id}" class="subheading-anchor" aria-label="Link to section: ${escapeHtml(rawText)}">#</a>`;

    if (depth === 2) return `\n<h2 class="post-section-subheading" id="${id}"><span>${text}</span>${anchor}</h2>\n`;
    if (depth === 3) return `\n<h3 class="post-section-h3" id="${id}"><span>${text}</span>${anchor}</h3>\n`;
    return `\n<h${depth} id="${id}">${text}</h${depth}>\n`;
  };

  renderer.blockquote = function blockquote({ tokens }) {
    return `\n<blockquote class="post-quote-block">\n${this.parser.parse(tokens)}\n</blockquote>\n`;
  };

  renderer.image = function image({ href, title, text }) {
    const altText = (text || title || '').trim();
    const captionText = (title || text || '').trim();
    const caption = captionText ? `<figcaption class="post-image-caption">${escapeHtml(captionText)}</figcaption>` : '';
    return `\n<figure class="post-image-figure"><img src="${escapeHtml(href)}" alt="${escapeHtml(altText)}" loading="lazy" />${caption}</figure>\n`;
  };

  renderer.code = function code({ text, lang }) {
    const rawLang = (lang || '').trim().toLowerCase();
    const language = LANGUAGE_ALIASES[rawLang] || rawLang;

    let highlighted;
    if (language && Prism.languages[language]) {
      try {
        highlighted = Prism.highlight(text, Prism.languages[language], language);
      } catch (err) {
        highlighted = escapeHtml(text);
      }
    } else {
      highlighted = escapeHtml(text);
    }

    return `\n<div class="post-code-block">
  <div class="post-code-header">
    <span>Snippet</span>
    <span class="lang-badge">${escapeHtml(rawLang || 'code')}</span>
  </div>
  <pre class="post-code-content"><code class="language-${escapeHtml(language || 'plaintext')}">${highlighted}</code></pre>
</div>\n`;
  };

  return renderer;
}

/** Makes bare <iframe> embeds responsive. */
function wrapIframes(html) {
  return html.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, match => `<div class="post-video-container">${match}</div>`);
}

export function renderMarkdown(body) {
  marked.setOptions({ gfm: true, breaks: false, renderer: createRenderer() });

  const normalized = String(body || '')
    // tolerate "![alt] (src)" with a space between the brackets
    .replace(/!\[([\s\S]*?)\]\s+\(([^)]+)\)/g, '![$1]($2)')
    // ++underline++ shorthand
    .replace(/\+\+([^+\n]+?)\+\+/g, '<u>$1</u>');

  return wrapIframes(marked.parse(normalized));
}

function formatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Parses one markdown file into the post object every renderer consumes.
 * `filename` supplies the fallback slug.
 */
export function parsePost(rawFileContent, filename = '') {
  const { data: frontmatter, content: body } = matter(rawFileContent);

  const fallbackSlug = filename
    ? path.basename(filename, path.extname(filename))
    : slugify(frontmatter.title || 'untitled');
  const slug = frontmatter.slug || fallbackSlug;
  const date = frontmatter.date || new Date().toISOString().slice(0, 10);

  const tags = Array.isArray(frontmatter.tags)
    ? frontmatter.tags
    : frontmatter.tags ? [frontmatter.tags] : [];

  return {
    id: frontmatter.id || slug,
    slug,
    title: frontmatter.title || 'Untitled Post',
    date,
    formattedDate: frontmatter.formattedDate || formatDate(date) || String(date),
    tags,
    description: frontmatter.description || '',
    lead: frontmatter.lead || '',
    coverImage: frontmatter.coverImage || '',
    frontmatter,
    rawMarkdown: body,
    contentHtml: renderMarkdown(body),
    wordCount: body.replace(/[#*`_[\]()>-]/g, ' ').split(/\s+/).filter(Boolean).length
  };
}

/** Serialises a post back to markdown-with-frontmatter for the tools to save. */
export function stringifyPost(frontmatter, body) {
  return matter.stringify(body || '', frontmatter || {});
}
