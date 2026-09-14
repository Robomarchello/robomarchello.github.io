/** Tools overview: current content counts, plus the Build action. */

import { getContent, listPosts } from './api.js';
import { initShell, toast } from './shell.js';

function set(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

async function loadStats() {
  try {
    const [projects, badges, links, posts] = await Promise.all([
      getContent('projects'),
      getContent('badges'),
      getContent('links'),
      listPosts()
    ]);

    set('stat-projects', projects.length);
    set('stat-posts', posts.length);
    set('stat-badges', Object.keys(badges).length);
    set('stat-links', (links.sections || []).reduce((total, section) => total + (section.links?.length || 0), 0));
  } catch (err) {
    toast(err.message, 'error');
  }
}

initShell({ onSave: null });
loadStats();
