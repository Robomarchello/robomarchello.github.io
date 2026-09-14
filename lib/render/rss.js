/** RSS 2.0 feed. Written once, to dist/rss.xml. */

import { escapeXml } from '../html.js';

export function renderRssFeed(posts, site) {
  const siteUrl = String(site.url || '').replace(/\/+$/, '');
  const buildDate = new Date().toUTCString();

  const items = posts
    .map(post => {
      const postUrl = `${siteUrl}/posts/${post.slug}.html`;
      const pubDate = post.date ? new Date(post.date).toUTCString() : buildDate;
      const description = post.description || post.lead || post.title;
      const categories = (post.tags || [])
        .map(tag => `      <category>${escapeXml(tag)}</category>`)
        .join('\n');

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>
${categories ? `${categories}\n` : ''}    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(site.title)} - Posts</title>
    <link>${escapeXml(`${siteUrl}/posts.html`)}</link>
    <description>${escapeXml(site.blogDescription || site.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${escapeXml(`${siteUrl}/rss.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}
