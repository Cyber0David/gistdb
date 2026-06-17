import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGist, updateGist } from '../api/gist';
import { useAuth } from '../hooks/useAuth';
import { useHistory } from '../hooks/useHistory';
import Sheet from '../components/Sheet';
import SheetTabs from '../components/SheetTabs';
import ExportMenu from '../components/ExportMenu';
import PasswordModal from '../components/PasswordModal';
import DBSettings from '../components/DBSettings';
import MobileMenu from '../components/MobileMenu';
import RateLimitBanner from '../components/RateLimitBanner';

export default function DBPage() {
  const { id } = useParams();
  const { activeGitHubToken: token, isAdmin, isUser, encryptPassword, userSession } = useAuth();
  const navigate = useNavigate();
  const canEdit = isAdmin || isUser;

  const { state: db, set: setDb, undo, redo, canUndo, canRedo } = useHistory(null);
  const [activeSheetId, setActiveSheetId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [dbNameVal, setDbNameVal] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [conflictWarning, setConflictWarning] = useState(false);

  const saveTimer = useRef(null);
  const lastSavedJson = useRef('');
  const dbRef = useRef(null);
  const SESSION_KEY = `gistdb_unlocked_${id}`;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getGist(id, token, encryptPassword)
      .then(data => {
        setDb(data);
        dbRef.current = data;
        lastSavedJson.current = JSON.stringify(data);
        setActiveSheetId(data.sheets[0]?.id);
        setDbNameVal(data.name);
        const alreadyUnlocked = sessionStorage.getItem(SESSION_KEY) === '1';
        if (!data.password || isAdmin || alreadyUnlocked) setUnlocked(true);
        if (data._plaintextLeak && encryptPassword) {
          // We had a password and found unencrypted content — a previous save likely
          // lost the encryption key. Mark dirty so the very next autosave re-encrypts it.
          setDirty(true);
          alert('Внимание: эта база была сохранена без шифрования (вероятно, из-за истёкшей сессии). Она будет зашифрована заново при следующем сохранении.');
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isAdmin, token, encryptPassword, SESSION_KEY]);

  // Warn on close with unsaved changes
  useEffect(() => {
    function onBeforeUnload(e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Conflict detection across tabs
  useEffect(() => {
    if (!canEdit) return;
    const channel = new BroadcastChannel(`gistdb_${id}`);
    channel.onmessage = (e) => { if (e.data === 'saved' && dirty) setConflictWarning(true); };
    return () => channel.close();
  }, [id, canEdit, dirty]);

  // Ctrl+S, Ctrl+Z, Ctrl+Y
  useEffect(() => {
    function onKey(e) {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (dirty) saveNow(); }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) { e.preventDefault(); handleRedo(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, db]);

  function handleUnlock() { sessionStorage.setItem(SESSION_KEY, '1'); setUnlocked(true); }

  function applyDb(newDb) {
    setDb(newDb);
    dbRef.current = newDb;
    scheduleSave(newDb);
  }

  function handleUndo() {
    const prev = undo();
    if (prev) { dbRef.current = prev; scheduleSave(prev); }
  }

  function handleRedo() {
    const next = redo();
    if (next) { dbRef.current = next; scheduleSave(next); }
  }

  async function saveNow(overrideDb) {
    const target = overrideDb || dbRef.current;
    if (!target || !canEdit || !token) return;
    // Safety: if this DB was created with encryption but we no longer have the password
    // in memory (e.g. page was reloaded or opened via direct link), refuse to silently
    // save in plaintext — that would strip encryption from an already-encrypted DB.
    if (isUser && !encryptPassword) {
      alert('Сессия истекла — пароль для шифрования недоступен. Перезайди в аккаунт, чтобы продолжить редактирование этой базы.');
      return;
    }
    const json = JSON.stringify(target);
    if (json === lastSavedJson.current) return;
    clearTimeout(saveTimer.current);
    setSaving(true); setSaved(false);
    try {
      await updateGist(token, id, target, encryptPassword);
      lastSavedJson.current = json;
      setDirty(false); setConflictWarning(false); setSaved(true);
      try { new BroadcastChannel(`gistdb_${id}`).postMessage('saved'); } catch { /* BroadcastChannel unsupported — ignore */ }
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { alert('Ошибка сохранения: ' + e.message); }
    setSaving(false);
  }

  function scheduleSave(newDb) {
    if (!canEdit || !token) return;
    clearTimeout(saveTimer.current);
    setDirty(true); setSaved(false);
    saveTimer.current = setTimeout(() => saveNow(newDb), 5000);
  }

  function updateSheet(updatedSheet) { applyDb({ ...dbRef.current, sheets: dbRef.current.sheets.map(s => s.id === updatedSheet.id ? updatedSheet : s) }); }
  function addSheet() {
    const sheet = { id: crypto.randomUUID(), name: `Лист ${dbRef.current.sheets.length + 1}`, cols: ['Колонка 1', 'Колонка 2', 'Колонка 3'], rows: [['', '', '']], rowLabels: ['1'] };
    const newDb = { ...dbRef.current, sheets: [...dbRef.current.sheets, sheet] };
    applyDb(newDb); setActiveSheetId(sheet.id);
  }
  function renameSheet(sheetId, name) { applyDb({ ...dbRef.current, sheets: dbRef.current.sheets.map(s => s.id === sheetId ? { ...s, name } : s) }); }
  function deleteSheet(sheetId) {
    if (dbRef.current.sheets.length <= 1) return;
    const sheets = dbRef.current.sheets.filter(s => s.id !== sheetId);
    applyDb({ ...dbRef.current, sheets });
    if (activeSheetId === sheetId) setActiveSheetId(sheets[0].id);
  }
  function duplicateSheet(sheetId) {
    const src = dbRef.current.sheets.find(s => s.id === sheetId);
    if (!src) return;
    const copy = { ...JSON.parse(JSON.stringify(src)), id: crypto.randomUUID(), name: src.name + ' (копия)' };
    const idx = dbRef.current.sheets.findIndex(s => s.id === sheetId);
    const sheets = [...dbRef.current.sheets];
    sheets.splice(idx + 1, 0, copy);
    applyDb({ ...dbRef.current, sheets });
    setActiveSheetId(copy.id);
  }
  function reorderSheets(newSheets) { applyDb({ ...dbRef.current, sheets: newSheets }); }
  function renameDB(name) { const newDb = { ...dbRef.current, name }; applyDb(newDb); setDbNameVal(name); setEditingName(false); }
  function saveSettings(updates) { const newDb = { ...dbRef.current, ...updates }; setDb(newDb); dbRef.current = newDb; setShowSettings(false); saveNow(newDb); }
  function copyLink() { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  if (loading) return <div className="page-center"><div className="spinner" /><span>Загружаем базу...</span></div>;
  if (error) return <div className="page-center error-box"><span>⚠ {error}</span><button onClick={() => navigate('/')}>На главную</button></div>;
  if (!db) return null;
  if (!unlocked) return <PasswordModal correctPassword={db.password} onUnlock={handleUnlock} dbName={db.name} />;

  const activeSheet = db.sheets.find(s => s.id === activeSheetId);

  const mobileMenuItems = [
    { icon: '🔗', label: copied ? '✓ Скопировано!' : 'Поделиться', onClick: copyLink },
    ...(activeSheet ? [{ icon: '⬇', label: 'Экспорт...', onClick: () => setShowExport(true) }] : []),
    ...(canEdit ? [
      'divider',
      { icon: '↩', label: 'Отменить (Ctrl+Z)', onClick: handleUndo },
      { icon: '↪', label: 'Повторить (Ctrl+Y)', onClick: handleRedo },
      'divider',
      { icon: '⚙', label: 'Настройки', onClick: () => setShowSettings(true) },
      ...(dirty ? [{ icon: '💾', label: 'Сохранить сейчас', onClick: () => saveNow() }] : []),
    ] : []),
  ];

  return (
    <div className="db-page">
      <RateLimitBanner threshold={isUser ? userSession?.threshold : null} />
      {conflictWarning && (
        <div className="conflict-banner">
          ⚠ Другая вкладка сохранила эту базу. Твои изменения могут перезаписать их.
          <button onClick={() => saveNow()}>Сохранить мои</button>
          <button onClick={() => { setConflictWarning(false); window.location.reload(); }}>Загрузить свежие</button>
          <button onClick={() => setConflictWarning(false)}>✕</button>
        </div>
      )}

      <header className="db-header">
        <div className="db-header-left">
          <button className="back-btn" onClick={() => navigate('/')} title="На главную">←</button>
          {canEdit && editingName
            ? <input autoFocus className="db-name-input" value={dbNameVal}
                onChange={e => setDbNameVal(e.target.value)}
                onBlur={() => renameDB(dbNameVal)}
                onKeyDown={e => { if (e.key === 'Enter') renameDB(dbNameVal); if (e.key === 'Escape') setEditingName(false); }} />
            : <h1 className="db-name" onDoubleClick={canEdit ? () => setEditingName(true) : undefined}>
                {db.name}{db.password && <span className="lock-icon">🔒</span>}
              </h1>
          }
        </div>

        <div className="db-header-right desktop-only">
          {canEdit && canUndo() && <button className="btn-icon" onClick={handleUndo} title="Отменить (Ctrl+Z)">↩</button>}
          {canEdit && canRedo() && <button className="btn-icon" onClick={handleRedo} title="Повторить (Ctrl+Y)">↪</button>}
          {canEdit && <span className={`save-status ${saving ? 'saving' : saved ? 'saved' : dirty ? 'dirty' : ''}`}>{saving ? 'Сохраняем...' : saved ? '✓ Сохранено' : dirty ? '● Есть изменения' : ''}</span>}
          {canEdit && dirty && !saving && <button className="btn-save-now" onClick={() => saveNow()} title="Ctrl+S">💾 Сохранить</button>}
          {activeSheet && <ExportMenu sheet={activeSheet} dbName={db.name} />}
          {canEdit && <button className="btn-secondary" onClick={() => setShowSettings(true)}>⚙ Настройки</button>}
          <button className="btn-secondary" onClick={copyLink}>{copied ? '✓ Скопировано!' : '🔗 Поделиться'}</button>
          {!canEdit && <span className="readonly-badge">Просмотр</span>}
        </div>

        <div className="db-header-right mobile-only">
          {canEdit && saving && <span className="save-status saving">Сохр...</span>}
          {canEdit && saved && <span className="save-status saved">✓</span>}
          {canEdit && dirty && !saving && <span className="save-status dirty">●</span>}
          {!canEdit && <span className="readonly-badge">Просмотр</span>}
          <MobileMenu items={mobileMenuItems} />
        </div>
      </header>

      <SheetTabs
        sheets={db.sheets} activeId={activeSheetId} isAdmin={canEdit}
        onSelect={setActiveSheetId} onAdd={addSheet} onRename={renameSheet}
        onDelete={deleteSheet} onDuplicate={duplicateSheet} onReorder={reorderSheets}
      />

      {activeSheet && <Sheet sheet={activeSheet} isAdmin={canEdit} onChange={updateSheet} />}

      {showSettings && <DBSettings db={db} onSave={saveSettings} onClose={() => setShowSettings(false)} />}

      {showExport && activeSheet && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowExport(false)}>
          <div className="modal-box mobile-export-box">
            <div className="modal-header">
              <h2>⬇ Экспорт листа</h2>
              <button className="modal-close" onClick={() => setShowExport(false)}>×</button>
            </div>
            <ExportMenu sheet={activeSheet} dbName={db.name} alwaysOpen />
          </div>
        </div>
      )}
    </div>
  );
}
