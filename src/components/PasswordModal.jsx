import { useState } from 'react';
import { checkPassword, isHashed } from '../api/password';

export default function PasswordModal({ correctPassword, onUnlock, dbName }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  async function attempt() {
    if (!input || checking) return;
    setChecking(true);
    // Support both legacy plain-text passwords and new SHA-256 hashes
    let ok;
    if (isHashed(correctPassword)) {
      ok = await checkPassword(input, correctPassword);
    } else {
      // Legacy: plain text comparison (for old DBs)
      ok = input === correctPassword;
    }
    setChecking(false);
    if (ok) {
      onUnlock();
    } else {
      setError(true);
      setInput('');
      setTimeout(() => setError(false), 1500);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-lock">🔒</div>
        <h2 className="modal-title">{dbName}</h2>
        <p className="modal-sub">Эта база защищена паролем</p>
        <input
          autoFocus
          type="password"
          placeholder="Введи пароль..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          className={`modal-input ${error ? 'modal-input-error' : ''}`}
          disabled={checking}
        />
        {error && <p className="modal-error">Неверный пароль</p>}
        <button className="btn-primary modal-btn" onClick={attempt} disabled={checking}>
          {checking ? 'Проверяем...' : 'Открыть'}
        </button>
      </div>
    </div>
  );
}
