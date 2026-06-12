import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listGists, createGist, emptyDB } from '../api/gist';
import { useAuth } from '../hooks/useAuth';

export default function HomePage() {
  const { token, setToken, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tokenInput, setTokenInput] = useState('');
  const [gists, setGists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [openIdInput, setOpenIdInput] = useState('');
  const [tokenError, setTokenError] = useState('');

  useEffect(() => {
    if (isAdmin) loadGists();
  }, [isAdmin]);

  async function loadGists() {
    setLoading(true);
    try {
      const list = await listGists(token);
      setGists(list);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function loginWithToken() {
    if (!tokenInput.trim()) return;
    setTokenError('');
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokenInput.trim()}`, Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) { setTokenError('Неверный токен. Проверь права: Gists (read+write).'); return; }
      setToken(tokenInput.trim());
    } catch {
      setTokenError('Ошибка подключения к GitHub.');
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const db = emptyDB(newName.trim());
      const id = await createGist(token, db);
      navigate(`/db/${id}`);
    } catch (e) {
      alert('Ошибка: ' + e.message);
    }
    setCreating(false);
  }

  function openById() {
    const raw = openIdInput.trim();
    if (!raw) return;
    const match = raw.match(/([a-f0-9]{20,})/i);
    if (match) navigate(`/db/${match[1]}`);
    else alert('Неверный ID или ссылка');
  }

  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="hero-logo">⬡</div>
        <h1 className="hero-title">GistDB</h1>
        <p className="hero-sub">Таблицы в GitHub Gists — редактируй и делись ссылкой</p>
      </div>

      <div className="home-content">
        {/* OPEN BY LINK */}
        <section className="home-section">
          <h2>Открыть по ссылке или ID</h2>
          <div className="input-row">
            <input placeholder="https://yoursite.com/db/abc123  или  abc123" value={openIdInput} onChange={e => setOpenIdInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && openById()} />
            <button className="btn-primary" onClick={openById}>Открыть</button>
          </div>
        </section>

        {/* ADMIN LOGIN */}
        {!isAdmin && (
          <section className="home-section">
            <h2>Войти как администратор</h2>
            <p className="section-hint">Нужен GitHub Personal Access Token с правами <code>gist</code>. <a href="https://github.com/settings/tokens/new?scopes=gist&description=GistDB" target="_blank" rel="noreferrer">Создать токен →</a></p>
            <div className="input-row">
              <input type="password" placeholder="ghp_xxxxxxxxxxxx" value={tokenInput} onChange={e => setTokenInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loginWithToken()} />
              <button className="btn-primary" onClick={loginWithToken}>Войти</button>
            </div>
            {tokenError && <p className="field-error">{tokenError}</p>}
          </section>
        )}

        {/* ADMIN PANEL */}
        {isAdmin && (
          <section className="home-section admin-section">
            <div className="section-head">
              <h2>Мои базы данных</h2>
              <div className="section-head-right">
                <button className="btn-primary" onClick={() => setShowCreate(v => !v)}>+ Создать</button>
                <button className="btn-ghost" onClick={() => { setToken(''); setGists([]); }}>Выйти</button>
              </div>
            </div>

            {showCreate && (
              <div className="create-box">
                <input autoFocus placeholder="Название новой базы" value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                <button className="btn-primary" onClick={handleCreate} disabled={creating}>{creating ? 'Создаём...' : 'Создать'}</button>
                <button className="btn-ghost" onClick={() => setShowCreate(false)}>Отмена</button>
              </div>
            )}

            {loading
              ? <div className="gist-loading">Загружаем список...</div>
              : gists.length === 0
                ? <div className="gist-empty">Нет баз данных. Создайте первую!</div>
                : <div className="gist-list">
                    {gists.map(g => (
                      <div key={g.id} className="gist-card" onClick={() => navigate(`/db/${g.id}`)}>
                        <div className="gist-card-name">{g.description?.replace('GistDB: ', '') || 'Без названия'}</div>
                        <div className="gist-card-meta">Изменено: {new Date(g.updatedAt).toLocaleString('ru')}</div>
                        <div className="gist-card-id">{g.id.slice(0, 16)}…</div>
                      </div>
                    ))}
                  </div>
            }
          </section>
        )}
      </div>
    </div>
  );
}
