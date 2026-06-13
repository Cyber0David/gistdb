import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function ExportMenu({ sheet, dbName }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function exportCSV() {
    const rowLabels = sheet.rowLabels || sheet.rows.map((_, i) => `${i + 1}`);
    const header = ['', ...sheet.cols].join(',');
    const rows = sheet.rows.map((row, i) =>
      [rowLabels[i], ...row].map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    download(blob, `${dbName} — ${sheet.name}.csv`);
    setOpen(false);
  }

  function exportExcel() {
    const rowLabels = sheet.rowLabels || sheet.rows.map((_, i) => `${i + 1}`);
    const data = [
      ['', ...sheet.cols],
      ...sheet.rows.map((row, i) => [rowLabels[i], ...row]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    XLSX.writeFile(wb, `${dbName} — ${sheet.name}.xlsx`);
    setOpen(false);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(sheet, null, 2)], { type: 'application/json' });
    download(blob, `${dbName} — ${sheet.name}.json`);
    setOpen(false);
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="export-wrap" ref={ref}>
      <button className="btn-secondary" onClick={() => setOpen(v => !v)}>⬇ Экспорт</button>
      {open && (
        <div className="export-menu">
          <button onClick={exportCSV}>📄 CSV</button>
          <button onClick={exportExcel}>📊 Excel (.xlsx)</button>
          <button onClick={exportJSON}>{ }🗂 JSON</button>
        </div>
      )}
    </div>
  );
}
