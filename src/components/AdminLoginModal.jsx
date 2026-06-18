import { useState } from 'react';
import { verifyAdmin, ServerUnreachableError } from '../api/server';

const ADMIN_GITHUB_USERNAME = import.meta.env.VITE_ADMIN_GITHUB_USERNAME || '';

// Fallback check used only when the server itself can't be reached at all
// (Railway down, network issue). Same identity check as the server performs
// (PAT must belong to the configured admin GitHub account), just done
// directly against GitHub's API instead of through our backend.
async function verifyAdminOffline(pat) {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' }
  });
  if (!res.ok) throw new Error('Неверный или просроченный токен');
  const ghUser = await res.json();
  if (!ADMIN_GITHUB_USERNAME) throw new Error('Администратор не настроен (VITE_ADMIN_GITHUB_USERNAME)');
  if (ghUser.login?.toLowerCase() !== ADMIN_GITHUB_USERNAME.toLowerCase()) {
    throw new Error('Этот токен не принадлежит администратору сайта');
  }
}

export default function AdminLoginModal({ onClose, onLogin }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  async function handleLogin() {
    if (!token.trim()) return;
    setLoading(true); setError(''); setOfflineMode(false);
    const pat = token.trim();
    try {
      // Primary path: server verifies the PAT belongs to the site owner.
      await verifyAdmin(pat);
      onLogin(pat);
    } catch (e) {
      if (e instanceof ServerUnreachableError) {
        // Server is completely down — fall back to a direct, offline check
        // against GitHub so the admin isn't locked out by a Railway outage.
        try {
          await verifyAdminOffline(pat);
          setOfflineMode(true);
          onLogin(pat);
        } catch (offlineErr) {
          setError(offlineErr.message);
        }
      } else {
        setError(e.message || 'Ошибка проверки токена');
      }
    }
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box admin-login-box">
        <div className="modal-header">
          <h2>🔑 Вход администратора</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <p className="section-hint">
          Только GitHub-аккаунт владельца сайта может войти как администратор.{' '}
          <a href="https://github.com/settings/tokens/new?scopes=gist&description=GistDB" target="_blank" rel="noreferrer">Создать токен →</a>
        </p>
        <div className="pass-row">
          <input type="password" placeholder="ghp_xxxxxxxxxxxx" value={token}
            onChange={e => setToken(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="settings-input" autoFocus />
        </div>
        {error && <p className="field-error">{error}</p>}
        {offlineMode && <p className="admin-offline-note">⚠ Сервер недоступен — вход выполнен в офлайн-режиме. Список баз может временно не обновляться через сервер.</p>}
        <div className="settings-actions">
          <button className="btn-primary" onClick={handleLogin} disabled={loading}>{loading ? '...' : 'Войти'}</button>
          <button className="btn-ghost" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
