import { useRef, useState, useMemo, useEffect } from 'react';

// ── HELPERS ───────────────────────────────────────────────────────────────────
function detectType(val) {
  if (!val || !val.trim()) return 'empty';
  if (val.startsWith('=')) return 'formula';
  if (!isNaN(parseFloat(val)) && isFinite(val.replace(',', '.'))) return 'number';
  if (/^\d{2}[./-]\d{2}[./-]\d{2,4}$/.test(val.trim())) return 'date';
  return 'text';
}

function evalCell(val, rows) {
  if (!val || !val.startsWith('=')) return val;
  const expr = val.slice(1).toUpperCase().trim();
  try {
    const rangeMatch = expr.match(/^(SUM|AVERAGE|AVG|COUNT|MIN|MAX)\((\d+):(\d+),(\d+):(\d+)\)$/);
    if (rangeMatch) {
      const [, fn, r1, r2, c1, c2] = rangeMatch;
      const vals = [];
      for (let r = +r1; r <= +r2; r++)
        for (let c = +c1; c <= +c2; c++) {
          const v = parseFloat(rows[r]?.[c]);
          if (!isNaN(v)) vals.push(v);
        }
      if (!vals.length) return '0';
      if (fn === 'SUM') return String(vals.reduce((a, b) => a + b, 0));
      if (fn === 'AVERAGE' || fn === 'AVG') return String(+(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(6));
      if (fn === 'COUNT') return String(vals.length);
      if (fn === 'MIN') return String(Math.min(...vals));
      if (fn === 'MAX') return String(Math.max(...vals));
    }
  } catch { /* malformed formula — fall back to showing raw text */ }
  return val;
}

const COLORS = ['', '#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#ffffff','#94a3b8'];
const BG_COLORS = ['', '#2a0a0a','#2a1500','#2a2200','#0a2a0a','#0a1a2a','#1a0a2a','#2a0a1a','#1e1e1e','#2c2c32'];

export default function Sheet({ sheet, isAdmin, onChange }) {
  const [colWidths, setColWidths]   = useState({});
  const [rowHeights, setRowHeights] = useState({});
  const [sortConfig, setSortConfig] = useState(null);
  const [search, setSearch]         = useState('');
  const [selection, setSelection]   = useState(null);
  const [activeCell, setActiveCell] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [colorPicker, setColorPicker] = useState(null); // {r, c, x, y}
  const [colTypes, setColTypes]     = useState({}); // ci -> 'auto'|'text'|'number'|'date'
  const resizingCol = useRef(null);
  const resizingRow = useRef(null);
  const tableRef    = useRef(null);
  const inputRefs   = useRef({});

  const rowLabels = sheet.rowLabels || sheet.rows.map((_, i) => `${i + 1}`);
  const cellStyles = sheet.cellStyles || {}; // key "r-c" -> {bg, color}

  // ── SORT / FILTER ─────────────────────────────────────────────
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

  // ── SELECTION ─────────────────────────────────────────────────
  function normSel(s) {
    if (!s) return null;
    return { r1: Math.min(s.r1,s.r2), r2: Math.max(s.r1,s.r2), c1: Math.min(s.c1,s.c2), c2: Math.max(s.c1,s.c2) };
  }
  function inSel(r, c) { const s = normSel(selection); return s && r>=s.r1&&r<=s.r2&&c>=s.c1&&c<=s.c2; }

  // ── KEYBOARD NAV ──────────────────────────────────────────────
  function handleCellKeyDown(e, r, c) {
    const rows = sorted.length, cols = sheet.cols.length;
    if (e.key==='Tab') {
      e.preventDefault();
      const nc = e.shiftKey ? c-1 : c+1;
      if (nc>=0&&nc<cols) focusCell(r,nc);
      else if (!e.shiftKey&&r+1<rows) focusCell(r+1,0);
      else if (e.shiftKey&&r-1>=0) focusCell(r-1,cols-1);
    } else if (e.key==='Enter') {
      e.preventDefault(); if (r+1<rows) focusCell(r+1,c);
    } else if (e.key==='ArrowRight'&&e.target.selectionStart===e.target.value.length) {
      if (c+1<cols){e.preventDefault();focusCell(r,c+1);}
    } else if (e.key==='ArrowLeft'&&e.target.selectionStart===0) {
      if (c-1>=0){e.preventDefault();focusCell(r,c-1);}
    } else if (e.key==='ArrowDown') {
      if (r+1<rows){e.preventDefault();focusCell(r+1,c);}
    } else if (e.key==='ArrowUp') {
      if (r-1>=0){e.preventDefault();focusCell(r-1,c);}
    } else if (e.key==='Escape') {
      setSelection(null);setActiveCell(null);inputRefs.current[`${r}-${c}`]?.blur();
    }
  }
  function focusCell(r,c) {
    setActiveCell({r,c}); setSelection({r1:r,c1:c,r2:r,c2:c});
    setTimeout(()=>inputRefs.current[`${r}-${c}`]?.focus(),0);
  }

  // ── COPY/PASTE ────────────────────────────────────────────────
  useEffect(()=>{
    if(!isAdmin) return;
    function handleCopy(e) {
      if(!selection) return;
      const s=normSel(selection);
      const lines=[];
      for(let r=s.r1;r<=s.r2;r++){
        const ri=sorted[r]?.origIdx; if(ri===undefined) continue;
        const row=[];
        for(let c=s.c1;c<=s.c2;c++) row.push(sheet.rows[ri]?.[c]??'');
        lines.push(row.join('\t'));
      }
      e.clipboardData.setData('text/plain',lines.join('\n')); e.preventDefault();
    }
    function handlePaste(e) {
      if(!activeCell) return; e.preventDefault();
      const text=e.clipboardData.getData('text/plain');
      const pasteRows=text.split('\n').map(r=>r.split('\t'));
      const newRows=sheet.rows.map(r=>[...r]);
      for(let pr=0;pr<pasteRows.length;pr++){
        const origIdx=sorted[activeCell.r+pr]?.origIdx; if(origIdx===undefined) break;
        for(let pc=0;pc<pasteRows[pr].length;pc++){
          const ci=activeCell.c+pc;
          if(ci<newRows[origIdx].length) newRows[origIdx][ci]=pasteRows[pr][pc];
        }
      }
      onChange({...sheet,rows:newRows});
    }
    window.addEventListener('copy',handleCopy);
    window.addEventListener('paste',handlePaste);
    return()=>{window.removeEventListener('copy',handleCopy);window.removeEventListener('paste',handlePaste);};
  },[selection,activeCell,sheet,sorted,isAdmin]);

  // Ctrl+A
  useEffect(()=>{
    function h(e){
      if((e.ctrlKey||e.metaKey)&&e.key==='a'&&tableRef.current?.contains(document.activeElement)){
        e.preventDefault(); setSelection({r1:0,c1:0,r2:sorted.length-1,c2:sheet.cols.length-1});
      }
    }
    window.addEventListener('keydown',h); return()=>window.removeEventListener('keydown',h);
  },[sorted.length,sheet.cols.length]);

  // Close color picker on outside click
  useEffect(()=>{
    function h(e){ if(colorPicker&&!e.target.closest('.color-picker-popup')) setColorPicker(null); }
    document.addEventListener('mousedown',h); return()=>document.removeEventListener('mousedown',h);
  },[colorPicker]);

  // ── MUTATIONS ─────────────────────────────────────────────────
  function updateCell(ri,ci,val){ onChange({...sheet,rows:sheet.rows.map((r,i)=>i===ri?r.map((c,j)=>j===ci?val:c):r)}); }
  function updateColName(ci,val){ onChange({...sheet,cols:sheet.cols.map((c,i)=>i===ci?val:c)}); }
  function updateRowLabel(ri,val){ const l=[...rowLabels];l[ri]=val;onChange({...sheet,rowLabels:l}); }
  function addCol(){ onChange({...sheet,cols:[...sheet.cols,`Колонка ${sheet.cols.length+1}`],rows:sheet.rows.map(r=>[...r,''])}); }
  function addRow(){ onChange({...sheet,rows:[...sheet.rows,new Array(sheet.cols.length).fill('')],rowLabels:[...rowLabels,`${sheet.rows.length+1}`]}); }
  function deleteCol(ci){ if(sheet.cols.length<=1)return; onChange({...sheet,cols:sheet.cols.filter((_,i)=>i!==ci),rows:sheet.rows.map(r=>r.filter((_,i)=>i!==ci))}); }
  function deleteRow(ri){ if(sheet.rows.length<=1)return; onChange({...sheet,rows:sheet.rows.filter((_,i)=>i!==ri),rowLabels:rowLabels.filter((_,i)=>i!==ri)}); }

  // ── CELL STYLES ───────────────────────────────────────────────
  function setCellStyle(origIdx, ci, updates) {
    const key = `${origIdx}-${ci}`;
    const current = cellStyles[key] || {};
    const newStyles = { ...cellStyles, [key]: { ...current, ...updates } };
    // Clean up empty styles
    if (!newStyles[key].bg && !newStyles[key].color) delete newStyles[key];
    onChange({ ...sheet, cellStyles: newStyles });
  }

  function openColorPicker(e, origIdx, ci) {
    e.preventDefault(); e.stopPropagation();
    const rect = e.target.getBoundingClientRect();
    setColorPicker({ origIdx, ci, x: rect.left, y: rect.bottom + 4 });
  }

  // ── COL TYPE ──────────────────────────────────────────────────
  function cycleColType(ci) {
    const types = ['auto','text','number','date'];
    const cur = colTypes[ci] || 'auto';
    const next = types[(types.indexOf(cur)+1)%types.length];
    setColTypes(t=>({...t,[ci]:next}));
  }
  function typeIcon(ci) {
    const t = colTypes[ci]||'auto';
    return {auto:'⬡',text:'T',number:'#',date:'📅'}[t];
  }

  // Display value with type formatting
  function displayVal(val, ci, rows) {
    const evaluated = evalCell(val, rows);
    const type = colTypes[ci] || 'auto';
    if (type === 'auto' || type === 'text') return evaluated;
    if (type === 'number') {
      const n = parseFloat(evaluated);
      return isNaN(n) ? evaluated : n.toLocaleString('ru');
    }
    return evaluated;
  }

  function cellAlign(val, ci) {
    const type = colTypes[ci] || 'auto';
    if (type === 'number') return 'right';
    if (type === 'text') return 'left';
    const detected = detectType(val);
    return detected === 'number' ? 'right' : 'left';
  }

  // ── SORT ──────────────────────────────────────────────────────
  function toggleSort(ci){ setSortConfig(p=>p?.col===ci?(p.dir==='asc'?{col:ci,dir:'desc'}:null):{col:ci,dir:'asc'}); }
  function sortIcon(ci){
    if(sortConfig?.col!==ci) return <span className="sort-icon sort-none">⇅</span>;
    return <span className="sort-icon sort-active">{sortConfig.dir==='asc'?'↑':'↓'}</span>;
  }

  // ── COLUMN RESIZE ─────────────────────────────────────────────
  function startResizeCol(e,ci){
    e.preventDefault();
    resizingCol.current={ci,startX:e.clientX,startW:colWidths[ci]||140};
    const onMove=e=>setColWidths(w=>({...w,[resizingCol.current.ci]:Math.max(60,resizingCol.current.startW+e.clientX-resizingCol.current.startX)}));
    const onUp=()=>{resizingCol.current=null;window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);};
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
  }

  // ── ROW RESIZE ────────────────────────────────────────────────
  function startResizeRow(e, origIdx){
    e.preventDefault();
    resizingRow.current={origIdx,startY:e.clientY,startH:rowHeights[origIdx]||34};
    const onMove=e=>setRowHeights(h=>({...h,[resizingRow.current.origIdx]:Math.max(24,resizingRow.current.startH+e.clientY-resizingRow.current.startY)}));
    const onUp=()=>{resizingRow.current=null;window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);};
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
  }

  // ── MOUSE SELECTION ───────────────────────────────────────────
  function onCellMouseDown(e,r,c){
    if(e.button!==0) return;
    if(e.shiftKey&&selection){setSelection(s=>({...s,r2:r,c2:c}));return;}
    setSelection({r1:r,c1:c,r2:r,c2:c}); setActiveCell({r,c}); setIsSelecting(true);
  }
  function onCellMouseEnter(r,c){ if(isSelecting) setSelection(s=>s?{...s,r2:r,c2:c}:s); }
  useEffect(()=>{
    function onUp(){setIsSelecting(false);}
    window.addEventListener('mouseup',onUp); return()=>window.removeEventListener('mouseup',onUp);
  },[]);

  // ── STATISTICS ────────────────────────────────────────────────
  const stats = useMemo(()=>{
    if(!selection) return null;
    const s=normSel(selection);
    const vals=[];
    for(let r=s.r1;r<=s.r2;r++){
      const ri=sorted[r]?.origIdx; if(ri===undefined) continue;
      for(let c=s.c1;c<=s.c2;c++){const v=parseFloat(sheet.rows[ri]?.[c]);if(!isNaN(v))vals.push(v);}
    }
    const total=(s.r2-s.r1+1)*(s.c2-s.c1+1);
    if(!vals.length) return {count:total};
    const sum=vals.reduce((a,b)=>a+b,0);
    return{count:total,sum:+sum.toFixed(6),avg:+(sum/vals.length).toFixed(6),min:Math.min(...vals),max:Math.max(...vals),numCount:vals.length};
  },[selection,sheet.rows,sorted]);

  return (
    <div className="sheet-wrap">
      {/* Toolbar */}
      <div className="sheet-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input placeholder="Поиск по таблице..." value={search} onChange={e=>setSearch(e.target.value)} className="search-input"/>
          {search&&<button className="search-clear" onClick={()=>setSearch('')}>×</button>}
        </div>
        {(search||sortConfig)&&<span className="filter-hint">{sorted.length} из {sheet.rows.length} строк{sortConfig&&` · сортировка по «${sheet.cols[sortConfig.col]}»`}</span>}
      </div>

      {/* Table */}
      <div className="sheet-scroll" ref={tableRef}>
        <table className="sheet-table" onMouseLeave={()=>setIsSelecting(false)}>
          <thead>
            <tr>
              <th className="corner-cell"/>
              {sheet.cols.map((col,ci)=>(
                <th key={ci} style={{width:colWidths[ci]||140,minWidth:colWidths[ci]||140}} className="col-header">
                  <div className="col-header-inner">
                    {isAdmin&&<button className="col-type-btn" onClick={()=>cycleColType(ci)} title={`Тип: ${colTypes[ci]||'auto'}`}>{typeIcon(ci)}</button>}
                    {isAdmin
                      ?<input value={col} onChange={e=>updateColName(ci,e.target.value)} className="header-input"/>
                      :<span className="header-label">{col}</span>}
                    <button className="sort-btn" onClick={()=>toggleSort(ci)}>{sortIcon(ci)}</button>
                    {isAdmin&&<>
                      <button className="col-del-btn" onClick={()=>deleteCol(ci)} title="Удалить">×</button>
                      <div className="resize-handle" onMouseDown={e=>startResizeCol(e,ci)}/>
                    </>}
                  </div>
                </th>
              ))}
              {isAdmin&&<th className="add-col-th"><button className="add-btn" onClick={addCol}>+</button></th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({row,label,origIdx},vi)=>{
              const rowH = rowHeights[origIdx] || 34;
              return(
              <tr key={origIdx} style={{height:rowH}}>
                <td className="row-header" style={{height:rowH}}>
                  <div className="row-header-inner">
                    {isAdmin
                      ?<input value={label} onChange={e=>updateRowLabel(origIdx,e.target.value)} className="row-label-input"/>
                      :<span className="row-label">{label}</span>}
                    {isAdmin&&<button className="row-del-btn" onClick={()=>deleteRow(origIdx)}>×</button>}
                  </div>
                  {isAdmin&&<div className="row-resize-handle" onMouseDown={e=>startResizeRow(e,origIdx)}/>}
                </td>
                {row.map((cell,ci)=>{
                  const key=`${origIdx}-${ci}`;
                  const style=cellStyles[key]||{};
                  const selected=inSel(vi,ci);
                  const highlighted=search&&cell.toLowerCase().includes(search.toLowerCase())&&search;
                  const displayed=displayVal(cell,ci,sheet.rows);
                  const align=cellAlign(cell,ci);
                  return(
                    <td key={ci}
                      className={`data-cell ${selected?'cell-selected':''} ${highlighted?'cell-highlight':''}`}
                      style={{background:style.bg||undefined,height:rowH}}
                      onMouseDown={e=>onCellMouseDown(e,vi,ci)}
                      onMouseEnter={()=>onCellMouseEnter(vi,ci)}
                      onContextMenu={isAdmin?e=>openColorPicker(e,origIdx,ci):undefined}
                    >
                      {isAdmin
                        ?<input
                            ref={el=>inputRefs.current[`${vi}-${ci}`]=el}
                            value={cell}
                            onChange={e=>updateCell(origIdx,ci,e.target.value)}
                            onKeyDown={e=>handleCellKeyDown(e,vi,ci)}
                            onFocus={()=>{setActiveCell({r:vi,c:ci});setSelection({r1:vi,c1:ci,r2:vi,c2:ci});}}
                            className="cell-input"
                            style={{color:style.color||undefined,textAlign:align}}
                          />
                        :<span className="cell-text" style={{color:style.color||undefined,textAlign:align,display:'block'}}>{displayed}</span>
                      }
                    </td>
                  );
                })}
                {isAdmin&&<td/>}
              </tr>
            );})}
            {sorted.length===0&&<tr><td colSpan={sheet.cols.length+2} className="empty-search">Ничего не найдено</td></tr>}
            {isAdmin&&!search&&(
              <tr><td className="add-row-td" colSpan={sheet.cols.length+2}>
                <button className="add-row-btn" onClick={addRow}>+ Добавить строку</button>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Stats bar */}
      {stats&&(
        <div className="stats-bar">
          {stats.numCount>0?<>
            <span>Выделено: <b>{stats.count}</b></span><span className="stats-sep">·</span>
            <span>Сумма: <b>{stats.sum}</b></span><span className="stats-sep">·</span>
            <span>Среднее: <b>{stats.avg}</b></span><span className="stats-sep">·</span>
            <span>Мин: <b>{stats.min}</b></span><span className="stats-sep">·</span>
            <span>Макс: <b>{stats.max}</b></span><span className="stats-sep">·</span>
            <span>Чисел: <b>{stats.numCount}</b></span>
          </>:<span>Выделено: <b>{stats.count}</b></span>}
          <button className="stats-close" onClick={()=>setSelection(null)}>✕</button>
        </div>
      )}

      {/* Color picker popup */}
      {colorPicker&&(
        <div className="color-picker-popup" style={{left:Math.min(colorPicker.x,window.innerWidth-220),top:Math.min(colorPicker.y,window.innerHeight-140)}}>
          <div className="cp-label">Цвет текста</div>
          <div className="cp-swatches">
            {COLORS.map((c,i)=>(
              <button key={i} className="cp-swatch"
                style={{background:c||'transparent',border:c?`1px solid ${c}`:'1px dashed #555'}}
                onClick={()=>setCellStyle(colorPicker.origIdx,colorPicker.ci,{color:c||''})}
                title={c||'По умолчанию'}
              >{!c&&'×'}</button>
            ))}
          </div>
          <div className="cp-label">Фон ячейки</div>
          <div className="cp-swatches">
            {BG_COLORS.map((c,i)=>(
              <button key={i} className="cp-swatch"
                style={{background:c||'transparent',border:c?`1px solid ${c}`:'1px dashed #555'}}
                onClick={()=>setCellStyle(colorPicker.origIdx,colorPicker.ci,{bg:c||''})}
                title={c||'По умолчанию'}
              >{!c&&'×'}</button>
            ))}
          </div>
          <button className="cp-clear" onClick={()=>{setCellStyle(colorPicker.origIdx,colorPicker.ci,{bg:'',color:''});setColorPicker(null);}}>
            × Сбросить всё
          </button>
        </div>
      )}
    </div>
  );
}
