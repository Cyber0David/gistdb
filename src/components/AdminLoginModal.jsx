import { useState } from 'react';

export default function AdminLoginModal({ onClose, onLogin }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!token.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token.trim()}`, Accept: 'application/vnd.github+json' }
      });
      if (!res.ok) { setError('Неверный токен. Нужны права: gist'); setLoading(false); return; }
      onLogin(token.trim());
    } catch { setError('Ошибка подключения'); }
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2>🔑 Вход администратора</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <p className="section-hint" style={{ marginBottom: 12 }}>
          GitHub Personal Access Token с правами <code>gist</code>.{' '}
          <a href="https://github.com/settings/tokens/new?scopes=gist&description=GistDB" target="_blank" rel="noreferrer">Создать →</a>
        </p>
        <div className="pass-row">
          <input type="password" placeholder="ghp_xxxxxxxxxxxx" value={token}
            onChange={e => setToken(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="settings-input" autoFocus />
        </div>
        {error && <p className="field-error" style={{ marginTop: 8 }}>{error}</p>}
        <div className="settings-actions" style={{ marginTop: 16 }}>
          <button className="btn-primary" onClick={handleLogin} disabled={loading}>{loading ? '...' : 'Войти'}</button>
          <button className="btn-ghost" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
