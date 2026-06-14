import { useState } from 'react';
import { hashPassword, isHashed } from '../api/password';

export default function DBSettings({ db, onSave, onClose }) {
  const [name, setName] = useState(db.name);
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasExistingPassword = !!db.password;

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    let passwordHash = db.password; // keep existing hash by default

    if (newPassword === '') {
      // Field left empty = keep existing password unchanged
      passwordHash = db.password;
    } else if (newPassword === '__CLEAR__') {
      // User clicked "Remove password"
      passwordHash = '';
    } else {
      // New password entered — hash it
      passwordHash = await hashPassword(newPassword);
    }

    onSave({ name: name.trim(), password: passwordHash });
    setSaving(false);
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
            {hasExistingPassword ? 'Изменить пароль' : 'Установить пароль'}
            <span className="field-hint">
              {hasExistingPassword ? 'оставь пустым — пароль не изменится' : 'оставь пустым — без пароля'}
            </span>
          </label>
          <div className="pass-row">
            <input
              type={showPass ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder={hasExistingPassword ? '••••••••' : 'Новый пароль...'}
              className="settings-input"
            />
            <button className="show-pass-btn" onClick={() => setShowPass(v => !v)}>
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
          {hasExistingPassword && (
            <button className="clear-pass-btn" onClick={() => { setNewPassword('__CLEAR__'); }}>
              × Убрать пароль
            </button>
          )}
          {newPassword === '__CLEAR__' && (
            <p className="pass-clear-warning">⚠ Пароль будет удалён при сохранении</p>
          )}
          <p className="pass-security-note">🔒 Пароль хранится в зашифрованном виде (SHA-256)</p>
        </div>

        <div className="settings-field">
          <label>ID базы <span className="field-hint">для прямых ссылок</span></label>
          <div className="id-row">
            <code className="id-display">{db.gistId}</code>
            <button className="copy-id-btn" onClick={() => navigator.clipboard.writeText(db.gistId)}>Копировать</button>
          </div>
        </div>

        <div className="settings-actions">
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
          <button className="btn-ghost" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
