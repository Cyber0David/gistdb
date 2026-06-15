const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function authHeaders(token) {
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function req(method, path, body, token) {
  const res = await fetch(`${SERVER}${path}`, {
    method, headers: authHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data;
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
export async function register(username, password, pat) {
  return req('POST', '/api/auth/register', { username, password, pat });
}

export async function login(username, password) {
  return req('POST', '/api/auth/login', { username, password });
}

export async function getMe(token) {
  return req('GET', '/api/auth/me', null, token);
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
export async function setThreshold(token, threshold) {
  return req('PATCH', '/api/settings/threshold', { threshold }, token);
}

export async function changePassword(token, oldPassword, newPassword) {
  return req('PATCH', '/api/settings/password', { oldPassword, newPassword }, token);
}

// ── GIST REGISTRY ─────────────────────────────────────────────────────────────
export async function listUserGists(token) {
  return req('GET', '/api/gists', null, token);
}

export async function registerGist(token, gist_id, name) {
  return req('POST', '/api/gists/register', { gist_id, name }, token);
}

export async function unregisterGist(token, gist_id) {
  return req('DELETE', `/api/gists/${gist_id}`, null, token);
}

export async function updateGistName(token, gist_id, name) {
  return req('PATCH', `/api/gists/${gist_id}/name`, { name }, token);
}
