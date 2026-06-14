import { useRef, useState, useMemo, useCallback, useEffect } from 'react';

export default function Sheet({ sheet, isAdmin, onChange }) {
  const [colWidths, setColWidths] = useState({});
  const [sortConfig, setSortConfig] = useState(null);
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState(null); // {r1,c1,r2,c2}
  const [activeCell, setActiveCell] = useState(null); // {r,c}
  const [isSelecting, setIsSelecting] = useState(false);
  const resizing = useRef(null);
  const tableRef = useRef(null);
  const inputRefs = useRef({}); // key: "r-c"

  const rowLabels = sheet.rowLabels || sheet.rows.map((_, i) => `${i + 1}`);

  // ── SORT / FILTER ──────────────────────────────────────────────
  const indexedRows = sheet.rows.map((row, i) => ({ row, label: rowLabels[i], origIdx: i }));

  const filtered = useMemo(() => {
    if (!search.trim()) return indexedRows;
    const q = search.trim().toLowerCase();
    return indexedRows.filter(({ row, label }) =>
      row.some(c => c.toLowerCase().includes(q)) || label.toLowerCase().includes(q)
    );
  }, [search, sheet.rows, sheet.rowLabels]);

  const sorted = useMemo(() => {
    if (!sortConfig) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a.row[sortConfig.col] || '', bv = b.row[sortConfig.col] || '';
      const an = parseFloat(av), bn = parseFloat(bv);
      let cmp = (!isNaN(an) && !isNaN(bn)) ? an - bn : av.localeCompare(bv, 'ru');
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortConfig]);

  // ── SELECTION HELPERS ──────────────────────────────────────────
  function normSel(s) {
    if (!s) return null;
    return { r1: Math.min(s.r1, s.r2), r2: Math.max(s.r1, s.r2), c1: Math.min(s.c1, s.c2), c2: Math.max(s.c1, s.c2) };
  }

  function inSel(r, c) {
    const s = normSel(selection);
    return s && r >= s.r1 && r <= s.r2 && c >= s.c1 && c <= s.c2;
  }

  function isActive(r, c) { return activeCell?.r === r && activeCell?.c === c; }

  // ── KEYBOARD NAVIGATION ────────────────────────────────────────
  function handleCellKeyDown(e, r, c) {
    const rows = sorted.length;
    const cols = sheet.cols.length;

    if (e.key === 'Tab') {
      e.preventDefault();
      const nextC = e.shiftKey ? c - 1 : c + 1;
      if (nextC >= 0 && nextC < cols) focusCell(r, nextC);
      else if (!e.shiftKey && r + 1 < rows) focusCell(r + 1, 0);
      else if (e.shiftKey && r - 1 >= 0) focusCell(r - 1, cols - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (r + 1 < rows) focusCell(r + 1, c);
    } else if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) {
      if (c + 1 < cols) { e.preventDefault(); focusCell(r, c + 1); }
    } else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
      if (c - 1 >= 0) { e.preventDefault(); focusCell(r, c - 1); }
    } else if (e.key === 'ArrowDown') {
      if (r + 1 < rows) { e.preventDefault(); focusCell(r + 1, c); }
    } else if (e.key === 'ArrowUp') {
      if (r - 1 >= 0) { e.preventDefault(); focusCell(r - 1, c); }
    } else if (e.key === 'Escape') {
      setSelection(null); setActiveCell(null);
      inputRefs.current[`${r}-${c}`]?.blur();
    }
  }

  function focusCell(r, c) {
    setActiveCell({ r, c });
    setSelection({ r1: r, c1: c, r2: r, c2: c });
    setTimeout(() => inputRefs.current[`${r}-${c}`]?.focus(), 0);
  }

  // ── COPY / PASTE ───────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    function handleCopy(e) {
      if (!selection) return;
      const s = normSel(selection);
      const lines = [];
      for (let r = s.r1; r <= s.r2; r++) {
        const ri = sorted[r]?.origIdx;
        if (ri === undefined) continue;
        const row = [];
        for (let c = s.c1; c <= s.c2; c++) row.push(sheet.rows[ri]?.[c] ?? '');
        lines.push(row.join('\t'));
      }
      e.clipboardData.setData('text/plain', lines.join('\n'));
      e.preventDefault();
    }

    function handlePaste(e) {
      if (!activeCell) return;
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      const pasteRows = text.split('\n').map(r => r.split('\t'));
      const newRows = sheet.rows.map(r => [...r]);
      const startSorted = sorted.findIndex(x => x.origIdx === sorted[activeCell.r]?.origIdx);
      const startR = sorted[activeCell.r]?.origIdx ?? 0;
      const startC = activeCell.c;
      for (let pr = 0; pr < pasteRows.length; pr++) {
        const origIdx = sorted[activeCell.r + pr]?.origIdx;
        if (origIdx === undefined) break;
        for (let pc = 0; pc < pasteRows[pr].length; pc++) {
          const ci = startC + pc;
          if (ci < newRows[origIdx].length) newRows[origIdx][ci] = pasteRows[pr][pc];
        }
      }
      onChange({ ...sheet, rows: newRows });
    }

    window.addEventListener('copy', handleCopy);
    window.addEventListener('paste', handlePaste);
    return () => { window.removeEventListener('copy', handleCopy); window.removeEventListener('paste', handlePaste); };
  }, [selection, activeCell, sheet, sorted, isAdmin]);

  // Ctrl+A to select all
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && tableRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        setSelection({ r1: 0, c1: 0, r2: sorted.length - 1, c2: sheet.cols.length - 1 });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sorted.length, sheet.cols.length]);

  // ── FORMULA EVALUATION ────────────────────────────────────────
  function evalCell(val, ri) {
    if (!val || !val.startsWith('=')) return val;
    const expr = val.slice(1).toUpperCase().trim();
    try {
      // SUM(A1:B3) style — columns by index, rows by index
      const rangeMatch = expr.match(/^(SUM|AVERAGE|AVG|COUNT|MIN|MAX)\((\d+):(\d+),(\d+):(\d+)\)$/);
      if (rangeMatch) {
        const [, fn, r1, r2, c1, c2] = rangeMatch;
        const vals = [];
        for (let r = +r1; r <= +r2; r++)
          for (let c = +c1; c <= +c2; c++) {
            const v = parseFloat(sheet.rows[r]?.[c]);
            if (!isNaN(v)) vals.push(v);
          }
        if (fn === 'SUM') return String(vals.reduce((a, b) => a + b, 0));
        if (fn === 'AVERAGE' || fn === 'AVG') return vals.length ? String(vals.reduce((a, b) => a + b, 0) / vals.length) : '0';
        if (fn === 'COUNT') return String(vals.length);
        if (fn === 'MIN') return vals.length ? String(Math.min(...vals)) : '';
        if (fn === 'MAX') return vals.length ? String(Math.max(...vals)) : '';
      }
      // Simple math: =2+2, =A*B etc
      const mathResult = Function('"use strict"; return (' + expr.replace(/[A-Z]+/g, '0') + ')')();
      if (typeof mathResult === 'number') return String(mathResult);
    } catch {}
    return val; // return as-is if can't eval
  }

  // ── CELL MUTATIONS ────────────────────────────────────────────
  function updateCell(ri, ci, val) {
    const rows = sheet.rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : r);
    onChange({ ...sheet, rows });
  }

  function updateColName(ci, val) {
    onChange({ ...sheet, cols: sheet.cols.map((c, i) => i === ci ? val : c) });
  }

  function updateRowLabel(ri, val) {
    const labels = [...rowLabels]; labels[ri] = val;
    onChange({ ...sheet, rowLabels: labels });
  }

  function addCol() {
    onChange({ ...sheet, cols: [...sheet.cols, `Колонка ${sheet.cols.length + 1}`], rows: sheet.rows.map(r => [...r, '']) });
  }

  function addRow() {
    onChange({ ...sheet, rows: [...sheet.rows, new Array(sheet.cols.length).fill('')], rowLabels: [...rowLabels, `${sheet.rows.length + 1}`] });
  }

  function deleteCol(ci) {
    if (sheet.cols.length <= 1) return;
    onChange({ ...sheet, cols: sheet.cols.filter((_, i) => i !== ci), rows: sheet.rows.map(r => r.filter((_, i) => i !== ci)) });
  }

  function deleteRow(ri) {
    if (sheet.rows.length <= 1) return;
    onChange({ ...sheet, rows: sheet.rows.filter((_, i) => i !== ri), rowLabels: rowLabels.filter((_, i) => i !== ri) });
  }

  // ── SORT ──────────────────────────────────────────────────────
  function toggleSort(ci) {
    setSortConfig(prev => {
      if (prev?.col === ci) { if (prev.dir === 'asc') return { col: ci, dir: 'desc' }; return null; }
      return { col: ci, dir: 'asc' };
    });
  }

  function sortIcon(ci) {
    if (sortConfig?.col !== ci) return <span className="sort-icon sort-none">⇅</span>;
    return <span className="sort-icon sort-active">{sortConfig.dir === 'asc' ? '↑' : '↓'}</span>;
  }

  // ── COLUMN RESIZE ─────────────────────────────────────────────
  function startResize(e, ci) {
    e.preventDefault();
    resizing.current = { ci, startX: e.clientX, startW: colWidths[ci] || 140 };
    const onMove = (e) => setColWidths(w => ({ ...w, [resizing.current.ci]: Math.max(60, resizing.current.startW + e.clientX - resizing.current.startX) }));
    const onUp = () => { resizing.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // ── MOUSE SELECTION ───────────────────────────────────────────
  function onCellMouseDown(e, r, c) {
    if (e.shiftKey && selection) {
      setSelection(s => ({ ...s, r2: r, c2: c }));
    } else {
      setSelection({ r1: r, c1: c, r2: r, c2: c });
      setActiveCell({ r, c });
      setIsSelecting(true);
    }
  }

  function onCellMouseEnter(r, c) {
    if (isSelecting) setSelection(s => s ? { ...s, r2: r, c2: c } : s);
  }

  useEffect(() => {
    function onUp() { setIsSelecting(false); }
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  // ── STATISTICS BAR ────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!selection) return null;
    const s = normSel(selection);
    const vals = [];
    for (let r = s.r1; r <= s.r2; r++) {
      const ri = sorted[r]?.origIdx;
      if (ri === undefined) continue;
      for (let c = s.c1; c <= s.c2; c++) {
        const v = parseFloat(sheet.rows[ri]?.[c]);
        if (!isNaN(v)) vals.push(v);
      }
    }
    const total = (s.r2 - s.r1 + 1) * (s.c2 - s.c1 + 1);
    if (vals.length === 0) return { count: total };
    const sum = vals.reduce((a, b) => a + b, 0);
    return { count: total, sum: +sum.toFixed(6), avg: +(sum / vals.length).toFixed(6), min: Math.min(...vals), max: Math.max(...vals), numCount: vals.length };
  }, [selection, sheet.rows, sorted]);

  return (
    <div className="sheet-wrap">
      {/* Toolbar */}
      <div className="sheet-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input placeholder="Поиск по таблице..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
          {search && <button className="search-clear" onClick={() => setSearch('')}>×</button>}
        </div>
        {(search || sortConfig) && (
          <span className="filter-hint">{sorted.length} из {sheet.rows.length} строк{sortConfig && ` · сортировка по «${sheet.cols[sortConfig.col]}»`}</span>
        )}
      </div>

      {/* Table */}
      <div className="sheet-scroll" ref={tableRef}>
        <table className="sheet-table" onMouseLeave={() => setIsSelecting(false)}>
          <thead>
            <tr>
              <th className="corner-cell" />
              {sheet.cols.map((col, ci) => (
                <th key={ci} style={{ width: colWidths[ci] || 140, minWidth: colWidths[ci] || 140 }} className="col-header">
                  <div className="col-header-inner">
                    {isAdmin
                      ? <input value={col} onChange={e => updateColName(ci, e.target.value)} className="header-input" />
                      : <span className="header-label">{col}</span>
                    }
                    <button className="sort-btn" onClick={() => toggleSort(ci)}>{sortIcon(ci)}</button>
                    {isAdmin && <>
                      <button className="col-del-btn" onClick={() => deleteCol(ci)} title="Удалить колонку">×</button>
                      <div className="resize-handle" onMouseDown={e => startResize(e, ci)} />
                    </>}
                  </div>
                </th>
              ))}
              {isAdmin && <th className="add-col-th"><button className="add-btn" onClick={addCol}>+</button></th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ row, label, origIdx }, vi) => (
              <tr key={origIdx}>
                <td className="row-header">
                  <div className="row-header-inner">
                    {isAdmin
                      ? <input value={label} onChange={e => updateRowLabel(origIdx, e.target.value)} className="row-label-input" />
                      : <span className="row-label">{label}</span>
                    }
                    {isAdmin && <button className="row-del-btn" onClick={() => deleteRow(origIdx)}>×</button>}
                  </div>
                </td>
                {row.map((cell, ci) => {
                  const selected = inSel(vi, ci);
                  const active = isActive(vi, ci);
                  const highlighted = search && cell.toLowerCase().includes(search.toLowerCase()) && search;
                  const displayed = evalCell(cell, origIdx);
                  return (
                    <td key={ci}
                      className={`data-cell ${selected ? 'cell-selected' : ''} ${highlighted ? 'cell-highlight' : ''}`}
                      onMouseDown={e => onCellMouseDown(e, vi, ci)}
                      onMouseEnter={() => onCellMouseEnter(vi, ci)}
                    >
                      {isAdmin
                        ? <input
                            ref={el => inputRefs.current[`${vi}-${ci}`] = el}
                            value={cell}
                            onChange={e => updateCell(origIdx, ci, e.target.value)}
                            onKeyDown={e => handleCellKeyDown(e, vi, ci)}
                            onFocus={() => { setActiveCell({ r: vi, c: ci }); setSelection({ r1: vi, c1: ci, r2: vi, c2: ci }); }}
                            className="cell-input"
                            title={cell.startsWith('=') ? `= ${displayed}` : ''}
                          />
                        : <span className="cell-text">{displayed}</span>
                      }
                    </td>
                  );
                })}
                {isAdmin && <td />}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={sheet.cols.length + 2} className="empty-search">Ничего не найдено</td></tr>
            )}
            {isAdmin && !search && (
              <tr>
                <td className="add-row-td" colSpan={sheet.cols.length + 2}>
                  <button className="add-row-btn" onClick={addRow}>+ Добавить строку</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="stats-bar">
          {stats.numCount > 0 ? <>
            <span>Выделено: <b>{stats.count}</b></span>
            <span className="stats-sep">·</span>
            <span>Сумма: <b>{stats.sum}</b></span>
            <span className="stats-sep">·</span>
            <span>Среднее: <b>{stats.avg}</b></span>
            <span className="stats-sep">·</span>
            <span>Мин: <b>{stats.min}</b></span>
            <span className="stats-sep">·</span>
            <span>Макс: <b>{stats.max}</b></span>
            <span className="stats-sep">·</span>
            <span>Чисел: <b>{stats.numCount}</b></span>
          </> : <span>Выделено: <b>{stats.count}</b></span>}
          <button className="stats-close" onClick={() => setSelection(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
