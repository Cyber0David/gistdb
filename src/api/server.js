const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function authHeaders(token) {
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// Thrown when the server itself couldn't be reached (network failure, Railway
// down, DNS issue, etc) — as opposed to the server responding normally with
// an error (wrong password, invalid token, etc). Callers that need an offline
// fallback (e.g. admin login) check for this specific error type.
export class ServerUnreachableError extends Error {}

async function req(method, path, body, token) {
  let res;
  try {
    res = await fetch(`${SERVER}${path}`, {
      method, headers: authHeaders(token),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ServerUnreachableError('Сервер недоступен');
  }
  let data;
  try {
    data = await res.json();
  } catch {
    // Server responded but not with valid JSON (e.g. a 502 HTML error page
    // from Railway's proxy when the upstream process isn't listening) —
    // treat this the same as fully unreachable.
    throw new ServerUnreachableError('Сервер недоступен');
  }
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

// ── ADMIN ─────────────────────────────────────────────────────────────────────
export async function verifyAdmin(pat) {
  return req('POST', '/api/admin/verify', { pat });
}

export async function getRegisteredGistIds(adminToken) {
  return req('GET', '/api/gists/registered-ids', null, adminToken);
}
