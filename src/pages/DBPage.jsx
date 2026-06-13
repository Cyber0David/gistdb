import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGist, updateGist } from '../api/gist';
import { useAuth } from '../hooks/useAuth';
import Sheet from '../components/Sheet';
import SheetTabs from '../components/SheetTabs';
import ExportMenu from '../components/ExportMenu';
import PasswordModal from '../components/PasswordModal';
import DBSettings from '../components/DBSettings';

export default function DBPage() {
  const { id } = useParams();
  const { token, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [db, setDb] = useState(null);
  const [activeSheetId, setActiveSheetId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [dbNameVal, setDbNameVal] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getGist(id)
      .then(data => {
        setDb(data);
        setActiveSheetId(data.sheets[0]?.id);
        setDbNameVal(data.name);
        // Auto-unlock if no password or if admin
        if (!data.password || isAdmin) setUnlocked(true);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isAdmin]);

  function triggerSave(newDb) {
    if (!isAdmin || !token) return;
    clearTimeout(saveTimer.current);
    setSaved(false);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateGist(token, id, newDb);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        alert('Ошибка сохранения: ' + e.message);
      }
      setSaving(false);
    }, 800);
  }

  function updateSheet(updatedSheet) {
    const newDb = { ...db, sheets: db.sheets.map(s => s.id === updatedSheet.id ? updatedSheet : s) };
    setDb(newDb);
    triggerSave(newDb);
  }

  function addSheet() {
    const sheet = {
      id: crypto.randomUUID(),
      name: `Лист ${db.sheets.length + 1}`,
      cols: ['Колонка 1', 'Колонка 2', 'Колонка 3'],
      rows: [['', '', '']],
      rowLabels: ['1'],
    };
    const newDb = { ...db, sheets: [...db.sheets, sheet] };
    setDb(newDb);
    setActiveSheetId(sheet.id);
    triggerSave(newDb);
  }

  function renameSheet(sheetId, name) {
    const newDb = { ...db, sheets: db.sheets.map(s => s.id === sheetId ? { ...s, name } : s) };
    setDb(newDb);
    triggerSave(newDb);
  }

  function deleteSheet(sheetId) {
    if (db.sheets.length <= 1) return;
    const sheets = db.sheets.filter(s => s.id !== sheetId);
    const newDb = { ...db, sheets };
    setDb(newDb);
    if (activeSheetId === sheetId) setActiveSheetId(sheets[0].id);
    triggerSave(newDb);
  }

  function renameDB(name) {
    const newDb = { ...db, name };
    setDb(newDb);
    setDbNameVal(name);
    setEditingName(false);
    triggerSave(newDb);
  }

  function saveSettings(updates) {
    const newDb = { ...db, ...updates };
    setDb(newDb);
    setShowSettings(false);
    triggerSave(newDb);
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="page-center"><div className="spinner" /><span>Загружаем базу...</span></div>;
  if (error) return <div className="page-center error-box"><span>⚠ {error}</span><button onClick={() => navigate('/')}>На главную</button></div>;
  if (!db) return null;

  // Password gate for viewers
  if (!unlocked) {
    return <PasswordModal correctPassword={db.password} onUnlock={() => setUnlocked(true)} dbName={db.name} />;
  }

  const activeSheet = db.sheets.find(s => s.id === activeSheetId);

  return (
    <div className="db-page">
      <header className="db-header">
        <div className="db-header-left">
          <button className="back-btn" onClick={() => navigate('/')} title="На главную">←</button>
          {isAdmin && editingName
            ? <input autoFocus className="db-name-input" value={dbNameVal}
                onChange={e => setDbNameVal(e.target.value)}
                onBlur={() => renameDB(dbNameVal)}
                onKeyDown={e => { if (e.key === 'Enter') renameDB(dbNameVal); if (e.key === 'Escape') setEditingName(false); }} />
            : <h1 className="db-name" onDoubleClick={isAdmin ? () => setEditingName(true) : undefined}
                title={isAdmin ? 'Двойной клик — переименовать' : ''}>
                {db.name}
                {db.password && <span className="lock-icon" title="Защищено паролем">🔒</span>}
              </h1>
          }
        </div>
        <div className="db-header-right">
          {isAdmin && <span className={`save-status ${saving ? 'saving' : saved ? 'saved' : ''}`}>{saving ? 'Сохраняем...' : saved ? '✓ Сохранено' : ''}</span>}
          {activeSheet && <ExportMenu sheet={activeSheet} dbName={db.name} />}
          {isAdmin && <button className="btn-secondary" onClick={() => setShowSettings(true)} title="Настройки базы">⚙ Настройки</button>}
          <button className="btn-secondary" onClick={copyLink}>{copied ? '✓ Скопировано!' : '🔗 Поделиться'}</button>
          {!isAdmin && <span className="readonly-badge">Просмотр</span>}
        </div>
      </header>

      <SheetTabs
        sheets={db.sheets}
        activeId={activeSheetId}
        isAdmin={isAdmin}
        onSelect={setActiveSheetId}
        onAdd={addSheet}
        onRename={renameSheet}
        onDelete={deleteSheet}
      />

      {activeSheet && (
        <Sheet sheet={activeSheet} isAdmin={isAdmin} onChange={updateSheet} />
      )}

      {showSettings && (
        <DBSettings db={db} onSave={saveSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
