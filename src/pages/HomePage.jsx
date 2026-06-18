import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listGists, createGist, deleteGist, emptyDB } from '../api/gist';
import { listUserGists, registerGist, unregisterGist, getRegisteredGistIds } from '../api/server';
import { useAuth } from '../hooks/useAuth';
import ImportModal from '../components/ImportModal';
import AdminLoginModal from '../components/AdminLoginModal';
import RateLimitBanner from '../components/RateLimitBanner';

export default function HomePage() {
  const { adminToken, setAdminToken, isAdmin, logoutAdmin, isUser, userSession, logoutUser, activeGitHubToken, encryptPassword } = useAuth();
  const navigate = useNavigate();

  const [gists, setGists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [openIdInput, setOpenIdInput] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState('');

  async function loadGists() {
    setLoading(true);
    try {
      if (isUser) {
        // User: load from server registry (server knows which gists belong to this user)
        const rows = await listUserGists(userSession.jwt);
        setGists(rows.map(r => ({ id: r.gist_id, description: `GistDB: ${r.name}`, updatedAt: r.created_at })));
      } else {
        const list = await listGists(adminToken);
        // Exclude any gist that's registered as belonging to a regular user —
        // the admin panel should only ever show the admin's own databases.
        // Bounded by a timeout so a slow/unreachable server can't hang the
        // entire admin gist list; on any failure we fall back to showing
        // everything rather than blocking the admin.
        let excludeIds = [];
        try {
          excludeIds = await Promise.race([
            getRegisteredGistIds(adminToken),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
          ]);
        } catch { /* server unavailable or slow — show everything instead of blocking admin */ }
        const excludeSet = new Set(excludeIds);
        setGists(list.filter(g => !excludeSet.has(g.id)));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin || isUser) loadGists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isUser]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const db = emptyDB(newName.trim());
      const id = await createGist(activeGitHubToken, db, encryptPassword);
      if (isUser) await registerGist(userSession.jwt, id, newName.trim());
      navigate(`/db/${id}`);
    } catch (e) { alert('Ошибка: ' + e.message); }
    setCreating(false);
  }

  async function handleImport(db) {
    setShowImport(false); setCreating(true);
    try {
      const id = await createGist(activeGitHubToken, db, encryptPassword);
      if (isUser) await registerGist(userSession.jwt, id, db.name);
      navigate(`/db/${id}`);
    } catch (e) { alert('Ошибка импорта: ' + e.message); }
    setCreating(false);
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm('Удалить эту базу данных?')) return;
    setDeletingId(id);
    try {
      await deleteGist(activeGitHubToken, id);
      if (isUser) await unregisterGist(userSession.jwt, id);
      setGists(g => g.filter(x => x.id !== id));
    } catch (e) { alert('Ошибка: ' + e.message); }
    setDeletingId(null);
  }

  function openById() {
    const raw = openIdInput.trim();
    if (!raw) return;
    const match = raw.match(/([a-f0-9]{20,})/i);
    if (match) navigate(`/db/${match[1]}`);
    else alert('Неверный ID или ссылка');
  }

  const filteredGists = gists.filter(g => (g.description || '').toLowerCase().includes(search.toLowerCase()));
  const isLoggedIn = isAdmin || isUser;
  const displayName = isAdmin ? 'Администратор' : userSession?.username;

  return (
    <div className="home-page">
      <RateLimitBanner threshold={userSession?.threshold} />

      <div className="home-hero">
        <div className="hero-logo">⬡</div>
        <h1 className="hero-title">GistDB</h1>
        <p className="hero-sub">Таблицы в GitHub Gists — редактируй и делись ссылкой</p>
      </div>

      <div className="home-content">
        {/* Open by link */}
        <section className="home-section">
          <h2>Открыть по ссылке или ID</h2>
          <div className="input-row">
            <input placeholder="https://gistdb.vercel.app/db/abc123  или  abc123"
              value={openIdInput} onChange={e => setOpenIdInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && openById()} />
            <button className="btn-primary" onClick={openById}>Открыть</button>
          </div>
        </section>

        {/* Not logged in */}
        {!isLoggedIn && (
          <section className="home-section">
            <h2>Войти или зарегистрироваться</h2>
            <p className="section-hint">Создай аккаунт чтобы хранить свои базы данных. Или войди как администратор с GitHub PAT-токеном.</p>
            <div className="login-buttons">
              <button className="btn-primary" onClick={() => navigate('/auth')}>Войти / Регистрация</button>
              <button className="btn-ghost" onClick={() => setShowAdminLogin(true)}>🔑 Войти как админ</button>
            </div>
          </section>
        )}

        {/* Logged in panel */}
        {isLoggedIn && (
          <section className={`home-section ${isUser ? 'user-section' : 'admin-section'}`}>
            <div className="section-head">
              <div>
                <h2>Мои базы данных</h2>
                <span className="section-user-badge">{isUser ? '👤' : '🔑'} {displayName}</span>
              </div>
              <div className="section-head-right">
                <button className="btn-primary" onClick={() => setShowCreate(v => !v)}>+ Создать</button>
                <button className="btn-secondary" onClick={() => setShowImport(true)}>⬆ Импорт</button>
                {isUser && <button className="btn-ghost" onClick={() => navigate('/settings')}>⚙</button>}
                <button className="btn-ghost" onClick={isAdmin ? logoutAdmin : logoutUser}>Выйти</button>
              </div>
            </div>

            {showCreate && (
              <div className="create-box">
                <input autoFocus placeholder="Название новой базы" value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                <button className="btn-primary" onClick={handleCreate} disabled={creating}>{creating ? 'Создаём...' : 'Создать'}</button>
                <button className="btn-ghost" onClick={() => setShowCreate(false)}>Отмена</button>
              </div>
            )}

            {gists.length > 3 && (
              <div className="gist-search-wrap">
                <input className="gist-search" placeholder="Поиск по базам..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            )}

            {loading
              ? <div className="gist-loading">Загружаем список...</div>
              : filteredGists.length === 0
                ? <div className="gist-empty">{search ? 'Ничего не найдено' : 'Нет баз данных. Создайте первую!'}</div>
                : <div className="gist-list">
                    {filteredGists.map(g => (
                      <div key={g.id} className="gist-card" onClick={() => navigate(`/db/${g.id}`)}>
                        <div className="gist-card-body">
                          <div className="gist-card-name">{g.description?.replace('GistDB: ', '') || 'Без названия'}{isUser && <span className="encrypted-badge">🔒 зашифровано</span>}</div>
                          <div className="gist-card-meta">Изменено: {new Date(g.updatedAt).toLocaleString('ru')}</div>
                          <div className="gist-card-id">{g.id.slice(0, 20)}…</div>
                        </div>
                        <button className="gist-delete-btn" onClick={e => handleDelete(e, g.id)} disabled={deletingId === g.id}>
                          {deletingId === g.id ? '...' : '🗑'}
                        </button>
                      </div>
                    ))}
                  </div>
            }
          </section>
        )}
      </div>

      {showImport && <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />}
      {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onLogin={token => { setAdminToken(token); setShowAdminLogin(false); }} />}
    </div>
  );
}
