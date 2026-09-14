/**
 * Floating "Tools" button. Injected by the dev server into the pages it
 * serves, so it exists only while developing and never lands in dist/.
 *
 * Styles are inlined and scoped to this one element — pulling in tools.css
 * here would restyle the site page it is sitting on.
 */

const WRENCH = '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px;height:14px;fill:#38bdf8"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>';

const link = document.createElement('a');
link.href = window.location.pathname.includes('/posts') ? '/tools/posts.html' : '/tools/';
link.title = 'Open the admin tools';
link.innerHTML = `${WRENCH}<span>Tools</span><span style="padding:.1rem .35rem;background:rgba(56,189,248,.16);color:#38bdf8;border-radius:4px;font-size:.66rem;letter-spacing:.05em">DEV</span>`;

link.style.cssText = [
  'position:fixed',
  'left:1rem',
  'bottom:1rem',
  'z-index:9999',
  'display:inline-flex',
  'align-items:center',
  'gap:.45rem',
  'padding:.55rem .9rem',
  'background:#161b23',
  'color:#e6edf3',
  'border:1px solid #2a3240',
  'border-radius:999px',
  'box-shadow:0 8px 24px rgba(0,0,0,.4)',
  'font:600 .82rem/1 "Plus Jakarta Sans",sans-serif',
  'text-decoration:none'
].join(';');

document.body.appendChild(link);
