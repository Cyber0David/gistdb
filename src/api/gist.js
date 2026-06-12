const BASE = 'https://api.github.com';

function headers(token) {
  const h = { 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function serialize(db) {
  return JSON.stringify({ files: { 'db.json': { content: JSON.stringify(db, null, 2) } } });
}

export async function getGist(id) {
  const res = await fetch(`${BASE}/gists/${id}`, { headers: headers() });
  if (!res.ok) throw new Error(`Gist not found (${res.status})`);
  const data = await res.json();
  const content = data.files['db.json']?.content;
  if (!content) throw new Error('Invalid GistDB format');
  return { ...JSON.parse(content), gistId: id, updatedAt: data.updated_at };
}

export async function createGist(token, db) {
  const res = await fetch(`${BASE}/gists`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      description: `GistDB: ${db.name}`,
      public: false,
      files: { 'db.json': { content: JSON.stringify(db, null, 2) } },
    }),
  });
  if (!res.ok) throw new Error(`Failed to create gist (${res.status})`);
  const data = await res.json();
  return data.id;
}

export async function updateGist(token, id, db) {
  const res = await fetch(`${BASE}/gists/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: serialize(db),
  });
  if (!res.ok) throw new Error(`Failed to save (${res.status})`);
  return true;
}

export async function listGists(token) {
  const res = await fetch(`${BASE}/gists?per_page=100`, { headers: headers(token) });
  if (!res.ok) throw new Error(`Failed to list gists (${res.status})`);
  const all = await res.json();
  return all.filter(g => g.files['db.json']).map(g => ({
    id: g.id,
    description: g.description,
    updatedAt: g.updated_at,
  }));
}

export function emptyDB(name = 'Новая база') {
  return {
    name,
    sheets: [
      {
        id: crypto.randomUUID(),
        name: 'Лист 1',
        cols: ['Колонка 1', 'Колонка 2', 'Колонка 3'],
        rows: [['', '', ''], ['', '', '']],
      },
    ],
  };
}
