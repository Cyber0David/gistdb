import { useState } from 'react';

export default function PasswordModal({ correctPassword, onUnlock, dbName }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  function attempt() {
    if (input === correctPassword) {
      onUnlock();
    } else {
      setError(true);
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
        />
        {error && <p className="modal-error">Неверный пароль</p>}
        <button className="btn-primary modal-btn" onClick={attempt}>Открыть</button>
      </div>
    </div>
  );
}
