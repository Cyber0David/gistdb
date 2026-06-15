import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setThreshold, changePassword } from '../api/server';
import { useAuth } from '../hooks/useAuth';

export default function UserSettingsPage() {
  const { userSession, setUserSession, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [thresh, setThresh] = useState(userSession?.threshold || 500);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function saveThreshold() {
    setErr(''); setMsg('');
    try {
      await setThreshold(userSession.jwt, thresh);
      setUserSession({ ...userSession, threshold: thresh });
      setMsg('Порог сохранён');
    } catch (e) { setErr(e.message); }
  }

  async function savePassword() {
    setErr(''); setMsg('');
    if (newPass !== newPass2) { setErr('Новые пароли не совпадают'); return; }
    if (newPass.length < 6) { setErr('Минимум 6 символов'); return; }
    setLoading(true);
    try {
      await changePassword(userSession.jwt, oldPass, newPass);
      setUserSession({ ...userSession, password: newPass });
      setMsg('Пароль изменён');
      setOldPass(''); setNewPass(''); setNewPass2('');
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  function handleLogout() { logoutUser(); navigate('/'); }

  return (
    <div className="home-page">
      <div className="home-hero" style={{ marginBottom: '1.5rem' }}>
        <h1 className="hero-title" style={{ fontSize: '1.6rem' }}>⚙ Настройки аккаунта</h1>
        <p className="hero-sub">@{userSession?.username}</p>
      </div>

      <div className="home-content">
        <section className="home-section">
          <h2>Порог предупреждения API</h2>
          <p className="section-hint">Предупреждение появится когда останется меньше этого числа запросов (из 5000/час)</p>
          <div className="input-row">
            <input type="number" min="50" max="4900" value={thresh} onChange={e => setThresh(+e.target.value)} />
            <button className="btn-primary" onClick={saveThreshold}>Сохранить</button>
          </div>
        </section>

        <section className="home-section">
          <h2>Изменить пароль</h2>
          <p className="section-hint">Пароль используется для шифрования — все данные будут перешифрованы автоматически</p>
          <div className="auth-fields">
            <div className="auth-field">
              <label>Текущий пароль</label>
              <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)} placeholder="••••••" />
            </div>
            <div className="auth-field">
              <label>Новый пароль</label>
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="минимум 6 символов" />
            </div>
            <div className="auth-field">
              <label>Повтори новый пароль</label>
              <input type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)} placeholder="ещё раз" />
            </div>
          </div>
          {err && <p className="field-error">{err}</p>}
          {msg && <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 8 }}>{msg}</p>}
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={savePassword} disabled={loading}>
            {loading ? 'Меняем...' : 'Изменить пароль'}
          </button>
        </section>

        <section className="home-section">
          <h2>Сессия</h2>
          <p className="section-hint">Выход очистит сессию. PAT-токен и данные в GitHub останутся нетронутыми.</p>
          <button className="btn-ghost" onClick={handleLogout}>Выйти из аккаунта</button>
        </section>

        <button className="auth-back" onClick={() => navigate('/')}>← На главную</button>
      </div>
    </div>
  );
}
