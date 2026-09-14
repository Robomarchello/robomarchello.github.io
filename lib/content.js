/**
 * Content access layer.
 *
 * content/ is the single source of truth for the whole site. The build reads
 * from here; the admin tools write here. Nothing else may write these files.
 */

import fs from 'fs';
import path from 'path';
import { CONTENT_DIR } from './paths.js';

const FILES = {
  site: 'site.json',
  badges: 'badges.json',
  projects: 'projects.json',
  links: 'links.json'
};

function filePath(name) {
  const file = FILES[name];
  if (!file) throw new Error(`Unknown content file: ${name}`);
  return path.join(CONTENT_DIR, file);
}

export function readContent(name, fallback) {
  const target = filePath(name);
  if (!fs.existsSync(target)) return fallback;
  return JSON.parse(fs.readFileSync(target, 'utf-8'));
}

export function writeContent(name, data) {
  fs.writeFileSync(filePath(name), `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

export const loadSite = () => readContent('site', {});
export const loadBadges = () => readContent('badges', {});
export const loadProjects = () => readContent('projects', []);
export const loadLinks = () => readContent('links', { sections: [] });

/**
 * Counts how many projects use each badge key.
 * Powers the "used in N projects" figure in the badges tool.
 */
export function badgeUsageCounts(projects = loadProjects()) {
  const counts = {};
  for (const project of projects) {
    for (const key of project.tools || []) {
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return counts;
}
