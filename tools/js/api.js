/** Thin client for the tools API. Every call talks to real files on disk. */

async function request(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `${method} ${url} failed (${response.status})`);
  return payload;
}

export const getContent = name => request('GET', `/api/content/${name}`);
export const saveContent = (name, data) => request('PUT', `/api/content/${name}`, data);

export const getBadgeUsage = () => request('GET', '/api/badge-usage');

export const listPosts = () => request('GET', '/api/posts');
export const getPost = slug => request('GET', `/api/posts/${encodeURIComponent(slug)}`);
export const savePost = (slug, data) => request('PUT', `/api/posts/${encodeURIComponent(slug)}`, data);
export const deletePost = slug => request('DELETE', `/api/posts/${encodeURIComponent(slug)}`);

export const renderPreview = markdown => request('POST', '/api/preview', { markdown });

export const listUploads = kind => request('GET', `/api/uploads/${kind}`);
export const upload = (kind, filename, data) => request('POST', `/api/uploads/${kind}`, { filename, data });

export const runBuild = () => request('POST', '/api/build');

/** Reads a File object as a bare base64 string. */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
