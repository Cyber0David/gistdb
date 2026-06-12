import { useState } from 'react';

export default function SheetTabs({ sheets, activeId, isAdmin, onSelect, onAdd, onRename, onDelete }) {
  const [editingId, setEditingId] = useState(null);

  function handleRename(id, val) {
    onRename(id, val);
    setEditingId(null);
  }

  return (
    <div className="tabs-bar">
      {sheets.map(s => (
        <div key={s.id} className={`tab ${s.id === activeId ? 'tab-active' : ''}`} onClick={() => onSelect(s.id)}>
          {isAdmin && editingId === s.id
            ? <input
                autoFocus
                defaultValue={s.name}
                className="tab-input"
                onBlur={e => handleRename(s.id, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(s.id, e.target.value); if (e.key === 'Escape') setEditingId(null); }}
                onClick={e => e.stopPropagation()}
              />
            : <span onDoubleClick={isAdmin ? () => setEditingId(s.id) : undefined}>{s.name}</span>
          }
          {isAdmin && sheets.length > 1 && (
            <button className="tab-del" onClick={e => { e.stopPropagation(); onDelete(s.id); }} title="Удалить лист">×</button>
          )}
        </div>
      ))}
      {isAdmin && (
        <button className="tab-add" onClick={onAdd} title="Новый лист">+ Лист</button>
      )}
    </div>
  );
}
