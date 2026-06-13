import { useState } from 'react';

export default function DBSettings({ db, onSave, onClose }) {
  const [name, setName] = useState(db.name);
  const [password, setPassword] = useState(db.password || '');
  const [showPass, setShowPass] = useState(false);

  function save() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), password });
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box settings-box">
        <div className="modal-header">
          <h2>⚙ Настройки базы</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-field">
          <label>Название базы</label>
          <input value={name} onChange={e => setName(e.target.value)} className="settings-input"
            onKeyDown={e => e.key === 'Enter' && save()} />
        </div>

        <div className="settings-field">
          <label>
            Пароль для просмотра
            <span className="field-hint">Оставь пустым — доступ без пароля</span>
          </label>
          <div className="pass-row">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Без пароля"
              className="settings-input"
            />
            <button className="show-pass-btn" onClick={() => setShowPass(v => !v)}>
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
          {password && (
            <button className="clear-pass-btn" onClick={() => setPassword('')}>
              × Убрать пароль
            </button>
          )}
        </div>

        <div className="settings-field">
          <label>ID базы <span className="field-hint">для прямых ссылок</span></label>
          <div className="id-row">
            <code className="id-display">{db.gistId}</code>
            <button className="copy-id-btn" onClick={() => navigator.clipboard.writeText(db.gistId)}>Копировать</button>
          </div>
        </div>

        <div className="settings-actions">
          <button className="btn-primary" onClick={save}>Сохранить</button>
          <button className="btn-ghost" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
