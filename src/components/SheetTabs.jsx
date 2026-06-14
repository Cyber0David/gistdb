import { useState, useRef } from 'react';

export default function SheetTabs({ sheets, activeId, isAdmin, onSelect, onAdd, onRename, onDelete, onDuplicate, onReorder }) {
  const [editingId, setEditingId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // {id, x, y}
  const dragIdx = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  function handleRename(id, val) { onRename(id, val); setEditingId(null); }

  function handleContextMenu(e, id) {
    if (!isAdmin) return;
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  }

  function closeContext() { setContextMenu(null); }

  // Drag and drop
  function onDragStart(e, idx) { dragIdx.current = idx; e.dataTransfer.effectAllowed = 'move'; }
  function onDragOver(e, idx) { e.preventDefault(); setDragOver(idx); }
  function onDrop(e, idx) {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) { setDragOver(null); return; }
    const newSheets = [...sheets];
    const [moved] = newSheets.splice(dragIdx.current, 1);
    newSheets.splice(idx, 0, moved);
    onReorder(newSheets);
    dragIdx.current = null; setDragOver(null);
  }
  function onDragEnd() { dragIdx.current = null; setDragOver(null); }

  return (
    <>
      <div className="tabs-bar" onClick={closeContext}>
        {sheets.map((s, idx) => (
          <div
            key={s.id}
            className={`tab ${s.id === activeId ? 'tab-active' : ''} ${dragOver === idx ? 'tab-drag-over' : ''}`}
            onClick={() => onSelect(s.id)}
            onContextMenu={e => handleContextMenu(e, s.id)}
            draggable={isAdmin}
            onDragStart={e => onDragStart(e, idx)}
            onDragOver={e => onDragOver(e, idx)}
            onDrop={e => onDrop(e, idx)}
            onDragEnd={onDragEnd}
          >
            {isAdmin && editingId === s.id
              ? <input autoFocus defaultValue={s.name} className="tab-input"
                  onBlur={e => handleRename(s.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(s.id, e.target.value); if (e.key === 'Escape') setEditingId(null); }}
                  onClick={e => e.stopPropagation()} />
              : <span onDoubleClick={isAdmin ? () => setEditingId(s.id) : undefined}>{s.name}</span>
            }
            {isAdmin && sheets.length > 1 && (
              <button className="tab-del" onClick={e => { e.stopPropagation(); onDelete(s.id); }}>×</button>
            )}
          </div>
        ))}
        {isAdmin && <button className="tab-add" onClick={onAdd}>+ Лист</button>}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseLeave={closeContext}>
          <button onClick={() => { setEditingId(contextMenu.id); closeContext(); }}>✏ Переименовать</button>
          <button onClick={() => { onDuplicate(contextMenu.id); closeContext(); }}>⧉ Дублировать</button>
          {sheets.length > 1 && <button className="context-danger" onClick={() => { onDelete(contextMenu.id); closeContext(); }}>🗑 Удалить</button>}
        </div>
      )}
    </>
  );
}
