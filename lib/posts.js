/**
 * Post storage. content/posts/*.md is the only place a post ever lives —
 * everything else (listing page, detail pages, RSS) is derived at build time.
 */

import fs from 'fs';
import path from 'path';
import { POSTS_DIR } from './paths.js';
import { parsePost, stringifyPost } from './markdown.js';

function ensureDir() {
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
}

function postPath(slug) {
  return path.join(POSTS_DIR, `${slug}.md`);
}

/** All posts, newest first. */
export function loadPosts() {
  ensureDir();
  const posts = [];

  for (const file of fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'))) {
    try {
      posts.push(parsePost(fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8'), file));
    } catch (err) {
      console.error(`[posts] Skipping ${file}: ${err.message}`);
    }
  }

  return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function loadPost(slug) {
  const target = postPath(slug);
  if (!fs.existsSync(target)) return null;
  return parsePost(fs.readFileSync(target, 'utf-8'), `${slug}.md`);
}

/**
 * Writes a post. When `oldSlug` differs the previous file is removed, so a
 * rename never leaves an orphan behind.
 */
export function savePost({ slug, oldSlug, frontmatter, rawMarkdown }) {
  if (!slug) throw new Error('A slug is required');
  ensureDir();

  if (oldSlug && oldSlug !== slug && fs.existsSync(postPath(oldSlug))) {
    fs.unlinkSync(postPath(oldSlug));
  }

  fs.writeFileSync(postPath(slug), stringifyPost(frontmatter, rawMarkdown), 'utf-8');
  return slug;
}

export function deletePost(slug) {
  const target = postPath(slug);
  if (!fs.existsSync(target)) return false;
  fs.unlinkSync(target);
  return true;
}
