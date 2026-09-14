#!/usr/bin/env node

/**
 * Local development server for the admin tools. Never deployed.
 *
 *   /          the built site from dist/ (with a floating tools bar injected)
 *   /tools/    the admin tools
 *   /api/*     read and write content/ and assets/, and trigger a build
 *
 * The tools only ever write source files under content/ and assets/. Published
 * HTML comes from build.js and nowhere else.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { readContent, writeContent, loadProjects, badgeUsageCounts } from '../lib/content.js';
import { loadPosts, loadPost, savePost, deletePost } from '../lib/posts.js';
import { renderMarkdown } from '../lib/markdown.js';
import { DIST_DIR, TOOLS_DIR, ICONS_DIR, PROJECT_IMAGES_DIR, POST_ASSETS_DIR } from '../lib/paths.js';
import { build } from '../build.js';

const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY_BYTES = 32 * 1024 * 1024;

const CONTENT_NAMES = new Set(['site', 'badges', 'projects', 'links']);

const UPLOAD_TARGETS = {
  icons: { dir: ICONS_DIR, urlBase: '/assets/icons' },
  projects: { dir: PROJECT_IMAGES_DIR, urlBase: '/assets/projects' },
  posts: { dir: POST_ASSETS_DIR, urlBase: '/assets/posts' }
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

/** Floating "Tools" button, injected into dev pages only. */
const DEV_BAR = `<script type="module" src="/tools/js/dev-bar.js"></script>`;

// ---------------------------------------------------------------- helpers

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Request body is not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/** Resolves a URL path inside `root`, refusing anything that escapes it. */
function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath).replace(/^\/+/, '');
  const target = path.resolve(root, decoded);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  return target === root || target.startsWith(rootWithSep) ? target : null;
}

function serveStatic(res, root, urlPath, { injectDevBar = false } = {}) {
  let target = safeJoin(root, urlPath);
  if (!target) return sendJson(res, 403, { error: 'Forbidden' });

  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, 'index.html');
  }
  if (!fs.existsSync(target)) return false;

  const ext = path.extname(target).toLowerCase();
  const type = MIME_TYPES[ext] || 'application/octet-stream';

  if (injectDevBar && ext === '.html') {
    const html = fs.readFileSync(target, 'utf-8').replace('</body>', `    ${DEV_BAR}\n  </body>`);
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(html);
    return true;
  }

  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(target).pipe(res);
  return true;
}

function writeUpload(kind, filename, base64Data) {
  const target = UPLOAD_TARGETS[kind];
  if (!target) throw new Error(`Unknown upload target: ${kind}`);
  if (!base64Data) throw new Error('Missing file data');

  // Tolerate a full data: URL as well as bare base64
  const comma = base64Data.indexOf(',');
  const payload = comma === -1 ? base64Data : base64Data.slice(comma + 1);

  const ext = (path.extname(filename || '') || '.png').toLowerCase();
  const stem = path.basename(filename || 'file', ext).replace(/[^\w-]/g, '-').toLowerCase() || 'file';
  const safeName = `${stem}${ext}`;

  fs.mkdirSync(target.dir, { recursive: true });
  fs.writeFileSync(path.join(target.dir, safeName), Buffer.from(payload, 'base64'));

  return { filename: safeName, path: `${target.urlBase}/${safeName}` };
}

function listUploads(kind) {
  const target = UPLOAD_TARGETS[kind];
  if (!target || !fs.existsSync(target.dir)) return [];

  return fs
    .readdirSync(target.dir)
    .filter(name => !name.startsWith('.'))
    .map(name => {
      const stat = fs.statSync(path.join(target.dir, name));
      return { name, path: `${target.urlBase}/${name}`, size: stat.size, mtime: stat.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

// ------------------------------------------------------------------- api

async function handleApi(req, res, pathname) {
  const segments = pathname.split('/').filter(Boolean).slice(1); // drop "api"
  const [resource, param] = segments;
  const method = req.method;

  // --- content/<name> -------------------------------------------------
  if (resource === 'content' && CONTENT_NAMES.has(param)) {
    if (method === 'GET') {
      return sendJson(res, 200, readContent(param, param === 'links' ? { sections: [] } : param === 'projects' ? [] : {}));
    }
    if (method === 'PUT') {
      writeContent(param, await readBody(req));
      return sendJson(res, 200, { ok: true, saved: `content/${param}.json` });
    }
  }

  // --- badge usage counts ---------------------------------------------
  if (resource === 'badge-usage' && method === 'GET') {
    return sendJson(res, 200, badgeUsageCounts(loadProjects()));
  }

  // --- posts -----------------------------------------------------------
  if (resource === 'posts') {
    if (method === 'GET' && !param) {
      // Listing omits rendered HTML; the editor asks for a single post to edit.
      return sendJson(
        res,
        200,
        loadPosts().map(({ contentHtml, ...rest }) => rest)
      );
    }
    if (method === 'GET' && param) {
      const post = loadPost(param);
      return post ? sendJson(res, 200, post) : sendJson(res, 404, { error: 'Post not found' });
    }
    if (method === 'PUT' && param) {
      const body = await readBody(req);
      const slug = savePost({
        slug: body.slug || param,
        oldSlug: body.oldSlug,
        frontmatter: body.frontmatter,
        rawMarkdown: body.rawMarkdown
      });
      return sendJson(res, 200, { ok: true, slug, saved: `content/posts/${slug}.md` });
    }
    if (method === 'DELETE' && param) {
      return sendJson(res, 200, { ok: true, deleted: deletePost(param) });
    }
  }

  // --- live preview through the real markdown pipeline -----------------
  if (resource === 'preview' && method === 'POST') {
    const { markdown } = await readBody(req);
    return sendJson(res, 200, { html: renderMarkdown(markdown || '') });
  }

  // --- uploads ----------------------------------------------------------
  if (resource === 'uploads' && param) {
    if (method === 'GET') return sendJson(res, 200, listUploads(param));
    if (method === 'POST') {
      const { filename, data } = await readBody(req);
      return sendJson(res, 200, writeUpload(param, filename, data));
    }
  }

  // --- build ------------------------------------------------------------
  if (resource === 'build' && method === 'POST') {
    return sendJson(res, 200, { ok: true, ...build({ quiet: true }) });
  }

  return sendJson(res, 404, { error: `No API route for ${method} ${pathname}` });
}

// ---------------------------------------------------------------- server

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return await handleApi(req, res, pathname);
    }

    if (pathname === '/tools' || pathname.startsWith('/tools/')) {
      const rest = pathname.replace(/^\/tools\/?/, '') || 'index.html';
      if (serveStatic(res, TOOLS_DIR, rest)) return;
      return sendJson(res, 404, { error: 'Tool not found' });
    }

    if (!fs.existsSync(DIST_DIR)) {
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<p>No build yet. Run <code>npm run build</code>, or open <a href="/tools/">/tools/</a> and press Build.</p>');
    }

    if (serveStatic(res, DIST_DIR, pathname === '/' ? 'index.html' : pathname, { injectDevBar: true })) return;

    // Fall back to the generated 404 page
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    const notFound = path.join(DIST_DIR, '404.html');
    res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound, 'utf-8') : 'Not found');
  } catch (err) {
    console.error(`[server] ${req.method} ${pathname}:`, err.message);
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Site   http://localhost:${PORT}/`);
  console.log(`  Tools  http://localhost:${PORT}/tools/\n`);
});
