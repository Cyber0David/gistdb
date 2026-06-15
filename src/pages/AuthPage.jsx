import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, login } from '../api/server';
import { useAuth } from '../hooks/useAuth';

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [pat, setPat] = useState('');
  const [showPat, setShowPat] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUserSession } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit() {
    setError('');
    if (!username.trim() || !password.trim()) { setError('Заполни все поля'); return; }
    if (mode === 'register') {
      if (password !== password2) { setError('Пароли не совпадают'); return; }
      if (!pat.trim()) { setError('Введи GitHub PAT-токен'); return; }
    }
    setLoading(true);
    try {
      let result;
      if (mode === 'register') {
        result = await register(username.trim(), password, pat.trim());
        // After register, login to get PAT back
        result = await login(username.trim(), password);
      } else {
        result = await login(username.trim(), password);
      }
      setUserSession({ jwt: result.token, username: result.username, pat: result.pat, threshold: result.threshold, password });
      navigate('/');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">⬡</div>
        <h1 className="auth-title">GistDB</h1>

        <div className="auth-tabs">
          <button className={mode === 'login' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setMode('login'); setError(''); }}>Войти</button>
          <button className={mode === 'register' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setMode('register'); setError(''); }}>Регистрация</button>
        </div>

        <div className="auth-fields">
          <div className="auth-field">
            <label>Логин</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="minимум 3 символа" autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>

          <div className="auth-field">
            <label>Пароль</label>
            <div className="pass-row">
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="минимум 6 символов" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
              <button className="show-pass-btn" onClick={() => setShowPass(v => !v)}>{showPass ? '🙈' : '👁'}</button>
            </div>
          </div>

          {mode === 'register' && <>
            <div className="auth-field">
              <label>Повтори пароль</label>
              <input type={showPass ? 'text' : 'password'} value={password2} onChange={e => setPassword2(e.target.value)}
                placeholder="ещё раз" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>

            <div className="auth-field">
              <label>
                GitHub PAT-токен
                <a href="https://github.com/settings/tokens/new?scopes=gist&description=GistDB" target="_blank" rel="noreferrer" className="auth-hint-link"> Получить →</a>
              </label>
              <div className="pass-row">
                <input type={showPat ? 'text' : 'password'} value={pat} onChange={e => setPat(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                <button className="show-pass-btn" onClick={() => setShowPat(v => !v)}>{showPat ? '🙈' : '👁'}</button>
              </div>
              <p className="auth-hint">Токен шифруется твоим паролем — никто кроме тебя его не видит</p>
            </div>
          </>}
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button className="btn-primary auth-submit" onClick={handleSubmit} disabled={loading}>
          {loading ? '...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
        </button>

        <button className="auth-back" onClick={() => navigate('/')}>← На главную</button>
      </div>
    </div>
  );
}
