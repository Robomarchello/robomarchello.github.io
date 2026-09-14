#!/usr/bin/env node

/**
 * Static site generator.
 *
 *   content/  +  templates/  ->  dist/
 *
 * Everything published is produced here, from scratch, every run. No HTML file
 * in the repository is ever rewritten in place, so a template is only ever a
 * template and content is only ever content.
 *
 *   node build.js            build into dist/
 *   BASE_PATH=/repo/ node build.js   build for a GitHub Pages project site
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  ROOT,
  ASSETS_DIR,
  DIST_DIR,
  SCRIPTS_DIR,
  STYLES_DIR,
  basePath,
  url
} from './lib/paths.js';
import { loadSite, loadBadges, loadProjects, loadLinks } from './lib/content.js';
import { loadPosts } from './lib/posts.js';
import { renderPage, clearTemplateCache } from './lib/template.js';
import { escapeHtml } from './lib/html.js';
import { renderNav, renderSocials, renderThemeBootstrap } from './lib/render/chrome.js';
import { renderProjectsFeed, renderFeaturedProject } from './lib/render/projects.js';
import { renderLinkSections } from './lib/render/links.js';
import { renderPostsFeed, renderTagPills, renderPostTagChips } from './lib/render/posts.js';
import { renderRssFeed } from './lib/render/rss.js';

const FONTS_LIGHT = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap';
const FONTS_DARK = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap';

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function writeFile(relativePath, contents) {
  const target = path.join(DIST_DIR, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, 'utf-8');
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

/**
 * Fields every page template needs. `scheme` picks the light page chrome or
 * the dark (blog) chrome.
 */
function baseContext(site, { scheme = 'light', activeHref = '', script, title, description, ogType = 'website' }) {
  return {
    site,
    pageTitle: title,
    pageDescription: description || site.description,
    ogType,
    nav: renderNav(site, activeHref),
    socials: renderSocials(site),
    themeBootstrap: renderThemeBootstrap(scheme),
    fontsUrl: scheme === 'dark' ? FONTS_DARK : FONTS_LIGHT,
    generalCss: url('/styles/general.css'),
    pageCss: url('/styles/page.css'),
    extraStyles: scheme === 'dark' ? `    <link rel="stylesheet" href="${url('/styles/posts.css')}" />` : '',
    scriptUrl: url(`/scripts/${script}`),
    homeUrl: url('/'),
    projectsUrl: url('/projects.html'),
    postsUrl: url('/posts.html'),
    linksUrl: url('/links.html'),
    subscribeUrl: url('/subscribe.html'),
    rssUrl: url('/rss.xml')
  };
}

function buildPages({ site, badges, projects, links, posts }) {
  writeFile(
    'index.html',
    renderPage('index', {
      ...baseContext(site, {
        activeHref: '/',
        script: 'home.js',
        title: `${site.title} - Developer Portfolio`
      }),
      featuredProject: renderFeaturedProject(projects)
    })
  );

  writeFile(
    'projects.html',
    renderPage('projects', {
      ...baseContext(site, {
        activeHref: '/projects.html',
        script: 'projects-page.js',
        title: `Projects - ${site.title}`,
        description: `Projects built by ${site.author}: games, physics simulations, and hardware.`
      }),
      projectsFeed: renderProjectsFeed(projects, badges)
    })
  );

  writeFile(
    'links.html',
    renderPage('links', {
      ...baseContext(site, {
        activeHref: '/links.html',
        script: 'links-page.js',
        title: `Links - ${site.title}`,
        description: `Profiles, projects, and contact details for ${site.author}.`
      }),
      linkSections: renderLinkSections(links)
    })
  );

  writeFile(
    'posts.html',
    renderPage('posts', {
      ...baseContext(site, {
        scheme: 'dark',
        activeHref: '/posts.html',
        script: 'posts-page.js',
        title: `Posts - ${site.title}`,
        description: site.blogDescription
      }),
      tagPills: renderTagPills(posts),
      postsFeed: renderPostsFeed(posts)
    })
  );

  writeFile(
    'subscribe.html',
    renderPage('subscribe', {
      ...baseContext(site, {
        scheme: 'dark',
        activeHref: '/posts.html',
        script: 'subscribe-page.js',
        title: `Subscribe - ${site.title}`,
        description: `Subscribe to the ${site.title} blog via RSS.`
      })
    })
  );

  writeFile(
    '404.html',
    renderPage('404', {
      ...baseContext(site, {
        scheme: 'dark',
        script: 'post-page.js',
        title: `Page Not Found - ${site.title}`
      })
    })
  );
}

/** One standalone page per markdown file, generated from scratch. */
function buildPostPages(site, posts) {
  for (const post of posts) {
    const lead = post.lead ? `          <p class="post-detail-lead">${escapeHtml(post.lead)}</p>` : '';

    writeFile(
      `posts/${post.slug}.html`,
      renderPage('post', {
        ...baseContext(site, {
          scheme: 'dark',
          activeHref: '/posts.html',
          script: 'post-page.js',
          title: `${post.title} - ${site.title}`,
          description: post.description || post.title,
          ogType: 'article'
        }),
        post,
        lead,
        tagChips: renderPostTagChips(post)
      })
    );
  }
}

export function build({ quiet = false } = {}) {
  const started = Date.now();
  clearTemplateCache();

  const site = loadSite();
  const badges = loadBadges();
  const projects = loadProjects();
  const links = loadLinks();
  const posts = loadPosts();

  rmrf(DIST_DIR);
  fs.mkdirSync(DIST_DIR, { recursive: true });

  buildPages({ site, badges, projects, links, posts });
  buildPostPages(site, posts);

  writeFile('rss.xml', renderRssFeed(posts, site));

  // Browser-native ES modules and plain CSS: nothing to bundle or transpile.
  copyDir(SCRIPTS_DIR, path.join(DIST_DIR, 'scripts'));
  copyDir(STYLES_DIR, path.join(DIST_DIR, 'styles'));
  copyDir(ASSETS_DIR, path.join(DIST_DIR, 'assets'));

  // Stops GitHub Pages from running the output through Jekyll
  writeFile('.nojekyll', '');

  // Copy custom domain CNAME if present
  if (fs.existsSync(path.join(ROOT, 'CNAME'))) {
    fs.copyFileSync(path.join(ROOT, 'CNAME'), path.join(DIST_DIR, 'CNAME'));
  } else if (fs.existsSync(path.join(ASSETS_DIR, 'CNAME'))) {
    fs.copyFileSync(path.join(ASSETS_DIR, 'CNAME'), path.join(DIST_DIR, 'CNAME'));
  }

  const summary = {
    pages: 6,
    posts: posts.length,
    projects: projects.length,
    badges: Object.keys(badges).length,
    base: basePath(),
    ms: Date.now() - started
  };

  if (!quiet) {
    console.log(
      `[build] ${summary.pages} pages, ${summary.posts} post page(s), ` +
        `${summary.projects} project(s), ${summary.badges} badge(s) -> dist/ ` +
        `(base ${summary.base}, ${summary.ms}ms)`
    );
  }

  return summary;
}

// Only build when executed directly, so the tools server can import build().
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  build();
}
