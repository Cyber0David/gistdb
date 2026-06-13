import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function ExportMenu({ sheet, dbName, alwaysOpen = false }) {
  const [open, setOpen] = useState(alwaysOpen);
  const ref = useRef(null);

  useEffect(() => {
    if (alwaysOpen) return;
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [alwaysOpen]);

  function exportCSV() {
    const rowLabels = sheet.rowLabels || sheet.rows.map((_, i) => `${i + 1}`);
    const header = ['', ...sheet.cols].join(',');
    const rows = sheet.rows.map((row, i) =>
      [rowLabels[i], ...row].map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header, ...rows].join('\n');
    download(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), `${dbName} — ${sheet.name}.csv`);
    if (!alwaysOpen) setOpen(false);
  }

  function exportExcel() {
    const rowLabels = sheet.rowLabels || sheet.rows.map((_, i) => `${i + 1}`);
    const data = [['', ...sheet.cols], ...sheet.rows.map((row, i) => [rowLabels[i], ...row])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    XLSX.writeFile(wb, `${dbName} — ${sheet.name}.xlsx`);
    if (!alwaysOpen) setOpen(false);
  }

  function exportJSON() {
    download(new Blob([JSON.stringify(sheet, null, 2)], { type: 'application/json' }), `${dbName} — ${sheet.name}.json`);
    if (!alwaysOpen) setOpen(false);
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  if (alwaysOpen) {
    return (
      <div className="export-inline">
        <button className="export-inline-btn" onClick={exportCSV}>📄 CSV</button>
        <button className="export-inline-btn" onClick={exportExcel}>📊 Excel (.xlsx)</button>
        <button className="export-inline-btn" onClick={exportJSON}>🗂 JSON</button>
      </div>
    );
  }

  return (
    <div className="export-wrap" ref={ref}>
      <button className="btn-secondary" onClick={() => setOpen(v => !v)}>⬇ Экспорт</button>
      {open && (
        <div className="export-menu">
          <button onClick={exportCSV}>📄 CSV</button>
          <button onClick={exportExcel}>📊 Excel (.xlsx)</button>
          <button onClick={exportJSON}>🗂 JSON</button>
        </div>
      )}
    </div>
  );
}
