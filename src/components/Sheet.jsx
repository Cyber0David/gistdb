import { useRef, useState } from 'react';

export default function Sheet({ sheet, isAdmin, onChange }) {
  const [colWidths, setColWidths] = useState({});
  const resizing = useRef(null);

  function updateCell(ri, ci, val) {
    const rows = sheet.rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : r);
    onChange({ ...sheet, rows });
  }

  function updateColName(ci, val) {
    const cols = sheet.cols.map((c, i) => i === ci ? val : c);
    onChange({ ...sheet, cols });
  }

  function updateRowLabel(ri, val) {
    const rowLabels = [...(sheet.rowLabels || sheet.rows.map((_, i) => `${i + 1}`))];
    rowLabels[ri] = val;
    onChange({ ...sheet, rowLabels });
  }

  function addCol() {
    const cols = [...sheet.cols, `Колонка ${sheet.cols.length + 1}`];
    const rows = sheet.rows.map(r => [...r, '']);
    onChange({ ...sheet, cols, rows });
  }

  function addRow() {
    const rows = [...sheet.rows, new Array(sheet.cols.length).fill('')];
    const rowLabels = [...(sheet.rowLabels || sheet.rows.map((_, i) => `${i + 1}`)), `${sheet.rows.length + 1}`];
    onChange({ ...sheet, rows, rowLabels });
  }

  function deleteCol(ci) {
    if (sheet.cols.length <= 1) return;
    const cols = sheet.cols.filter((_, i) => i !== ci);
    const rows = sheet.rows.map(r => r.filter((_, i) => i !== ci));
    onChange({ ...sheet, cols, rows });
  }

  function deleteRow(ri) {
    if (sheet.rows.length <= 1) return;
    const rows = sheet.rows.filter((_, i) => i !== ri);
    const rowLabels = (sheet.rowLabels || sheet.rows.map((_, i) => `${i + 1}`)).filter((_, i) => i !== ri);
    onChange({ ...sheet, rows, rowLabels });
  }

  function startResize(e, ci) {
    resizing.current = { ci, startX: e.clientX, startW: colWidths[ci] || 140 };
    const onMove = (e) => {
      const diff = e.clientX - resizing.current.startX;
      setColWidths(w => ({ ...w, [resizing.current.ci]: Math.max(60, resizing.current.startW + diff) }));
    };
    const onUp = () => { resizing.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const rowLabels = sheet.rowLabels || sheet.rows.map((_, i) => `${i + 1}`);

  return (
    <div className="sheet-wrap">
      <div className="sheet-scroll">
        <table className="sheet-table">
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
                    {isAdmin && (
                      <>
                        <button className="col-del-btn" onClick={() => deleteCol(ci)} title="Удалить колонку">×</button>
                        <div className="resize-handle" onMouseDown={e => startResize(e, ci)} />
                      </>
                    )}
                  </div>
                </th>
              ))}
              {isAdmin && <th className="add-col-th"><button className="add-btn" onClick={addCol} title="Добавить колонку">+</button></th>}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, ri) => (
              <tr key={ri}>
                <td className="row-header">
                  <div className="row-header-inner">
                    {isAdmin
                      ? <input value={rowLabels[ri]} onChange={e => updateRowLabel(ri, e.target.value)} className="row-label-input" />
                      : <span className="row-label">{rowLabels[ri]}</span>
                    }
                    {isAdmin && <button className="row-del-btn" onClick={() => deleteRow(ri)} title="Удалить строку">×</button>}
                  </div>
                </td>
                {row.map((cell, ci) => (
                  <td key={ci} className="data-cell">
                    {isAdmin
                      ? <input value={cell} onChange={e => updateCell(ri, ci, e.target.value)} className="cell-input" />
                      : <span className="cell-text">{cell}</span>
                    }
                  </td>
                ))}
                {isAdmin && <td />}
              </tr>
            ))}
            {isAdmin && (
              <tr>
                <td className="add-row-td" colSpan={sheet.cols.length + 2}>
                  <button className="add-row-btn" onClick={addRow}>+ Добавить строку</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
