import { encryptData, decryptData } from './crypto.js';

const BASE = 'https://api.github.com';

function headers(token) {
  return { 'Content-Type': 'application/json', Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ── RATE LIMIT MONITOR ────────────────────────────────────────────────────────
let _rateLimitCallbacks = [];
export function onRateLimit(cb) { _rateLimitCallbacks.push(cb); return () => { _rateLimitCallbacks = _rateLimitCallbacks.filter(x => x !== cb); }; }
function notifyRateLimit(info) { _rateLimitCallbacks.forEach(cb => cb(info)); }

async function checkRateLimit(token) {
  try {
    const res = await fetch(`${BASE}/rate_limit`, { headers: headers(token) });
    const data = await res.json();
    const { remaining, limit, reset } = data.rate;
    notifyRateLimit({ remaining, limit, reset });
    return { remaining, limit, reset };
  } catch { return null; }
}

// Check rate limit after each mutating request
async function afterMutation(token) {
  const info = await checkRateLimit(token);
  return info;
}

// ── GIST CRUD ─────────────────────────────────────────────────────────────────
export async function getGist(id, token, decryptPassword = null) {
  const res = await fetch(`${BASE}/gists/${id}`, { headers: headers(token) });
  if (!res.ok) throw new Error(`Gist not found (${res.status})`);
  const data = await res.json();
  const content = data.files['db.json']?.content;
  if (!content) throw new Error('Invalid GistDB format');

  let parsed;
  if (decryptPassword) {
    try {
      const plaintext = await decryptData(content, decryptPassword);
      parsed = JSON.parse(plaintext);
    } catch {
      throw new Error('Не удалось расшифровать. Неверный пароль?');
    }
  } else {
    parsed = JSON.parse(content);
  }
  return { ...parsed, gistId: id, updatedAt: data.updated_at };
}

export async function createGist(token, db, encryptPassword = null) {
  let content = JSON.stringify(db, null, 2);
  if (encryptPassword) content = await encryptData(content, encryptPassword);
  const res = await fetch(`${BASE}/gists`, {
    method: 'POST', headers: headers(token),
    body: JSON.stringify({ description: `GistDB: ${db.name}`, public: false, files: { 'db.json': { content } } }),
  });
  if (!res.ok) throw new Error(`Failed to create gist (${res.status})`);
  const data = await res.json();
  afterMutation(token);
  return data.id;
}

export async function updateGist(token, id, db, encryptPassword = null) {
  let content = JSON.stringify(db, null, 2);
  if (encryptPassword) content = await encryptData(content, encryptPassword);
  const res = await fetch(`${BASE}/gists/${id}`, {
    method: 'PATCH', headers: headers(token),
    body: JSON.stringify({ files: { 'db.json': { content } } }),
  });
  if (!res.ok) throw new Error(`Failed to save (${res.status})`);
  afterMutation(token);
  return true;
}

export async function deleteGist(token, id) {
  const res = await fetch(`${BASE}/gists/${id}`, { method: 'DELETE', headers: headers(token) });
  if (!res.ok) throw new Error(`Failed to delete (${res.status})`);
  afterMutation(token);
  return true;
}

export async function listGists(token) {
  const res = await fetch(`${BASE}/gists?per_page=100`, { headers: headers(token) });
  if (!res.ok) throw new Error(`Failed to list gists (${res.status})`);
  const all = await res.json();
  return all.filter(g => g.files['db.json']).map(g => ({ id: g.id, description: g.description, updatedAt: g.updated_at }));
}

export async function getRateLimit(token) {
  return checkRateLimit(token);
}

export function emptyDB(name = 'Новая база') {
  return {
    name, password: '',
    sheets: [{ id: crypto.randomUUID(), name: 'Лист 1', cols: ['Колонка 1', 'Колонка 2', 'Колонка 3'], rows: [['', '', ''], ['', '', '']], rowLabels: ['1', '2'] }],
  };
}
