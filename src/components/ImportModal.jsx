import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

export default function ImportModal({ onImport, onClose }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);

  function handleFile(file) {
    setError('');
    setPreview(null);
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls', 'json'].includes(ext)) {
      setError('Поддерживаются только CSV, Excel (.xlsx/.xls) и JSON');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let db;
        if (ext === 'json') db = parseJSON(e.target.result, file.name);
        else if (ext === 'csv') db = parseCSV(e.target.result, file.name);
        else db = parseExcel(e.target.result, file.name);
        setPreview(db);
      } catch (err) {
        setError('Ошибка разбора файла: ' + err.message);
      }
    };
    if (ext === 'csv' || ext === 'json') reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  }

  function cellToString(val) {
    if (val === null || val === undefined) return '';
    // XLSX date object (when cellDates: true)
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return '';
      const d = String(val.getDate()).padStart(2, '0');
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const y = val.getFullYear();
      // If time is non-zero — include it
      const h = val.getHours(), mi = val.getMinutes(), s = val.getSeconds();
      if (h || mi || s) {
        return `${d}.${m}.${y} ${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      }
      return `${d}.${m}.${y}`;
    }
    return String(val);
  }

  function parseJSON(text, filename) {
    const data = JSON.parse(text);
    if (data.sheets && Array.isArray(data.sheets)) {
      return {
        name: data.name || baseName(filename),
        sheets: data.sheets.map(s => ({
          id: crypto.randomUUID(),
          name: s.name || 'Лист',
          cols: s.cols || [],
          rows: s.rows || [],
          rowLabels: s.rowLabels || s.rows?.map((_, i) => `${i + 1}`) || [],
        })),
        password: '',
      };
    }
    if (Array.isArray(data) && data.length > 0) {
      const cols = Object.keys(data[0]);
      const rows = data.map(obj => cols.map(k => cellToString(obj[k])));
      const rowLabels = data.map((_, i) => `${i + 1}`);
      return { name: baseName(filename), sheets: [{ id: crypto.randomUUID(), name: 'Лист 1', cols, rows, rowLabels }], password: '' };
    }
    throw new Error('Неизвестный формат JSON');
  }

  function parseCSV(text, filename) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
    if (lines.length < 1) throw new Error('Файл пустой');
    const parse = line => {
      const result = []; let cur = ''; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
        else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
        else cur += c;
      }
      result.push(cur);
      return result;
    };
    const header = parse(lines[0]);
    const hasRowLabel = header[0] === '' || header[0] === undefined;
    const cols = hasRowLabel ? header.slice(1) : header;
    const rows = []; const rowLabels = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cells = parse(lines[i]);
      if (hasRowLabel) { rowLabels.push(cells[0] || `${i}`); rows.push(cells.slice(1)); }
      else { rowLabels.push(`${i}`); rows.push(cells); }
    }
    return { name: baseName(filename), sheets: [{ id: crypto.randomUUID(), name: 'Лист 1', cols, rows, rowLabels }], password: '' };
  }

  function parseExcel(buffer, filename) {
    // cellDates:true → даты приходят как Date-объекты, не числа
    // dateNF задаёт формат для sheet_to_json когда raw:false, но мы используем raw:true + cellDates
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: true });

    const sheets = wb.SheetNames.map(sheetName => {
      const ws = wb.Sheets[sheetName];

      // raw:false — XLSX форматирует числа/даты сам, но теряет точность у дат без формата
      // Поэтому берём raw:true + cellDates:true и форматируем сами через cellToString
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

      if (data.length === 0) return { id: crypto.randomUUID(), name: sheetName, cols: [], rows: [], rowLabels: [] };

      const header = data[0].map(cellToString);
      const hasRowLabel = header[0] === '';
      const cols = hasRowLabel ? header.slice(1) : header;
      const rows = []; const rowLabels = [];

      for (let i = 1; i < data.length; i++) {
        const cells = data[i].map(cellToString);
        // Skip fully empty rows
        if (cells.every(c => c === '')) continue;
        if (hasRowLabel) { rowLabels.push(cells[0] || `${i}`); rows.push(cells.slice(1)); }
        else { rowLabels.push(`${i}`); rows.push(cells); }
      }
      return { id: crypto.randomUUID(), name: sheetName, cols, rows, rowLabels };
    });
    return { name: baseName(filename), sheets, password: '' };
  }

  function baseName(filename) {
    return filename.replace(/\.[^.]+$/, '');
  }

  function handleDrop(e) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box import-box">
        <div className="modal-header">
          <h2>⬆ Импорт базы данных</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {!preview ? (
          <>
            <div
              className={`drop-zone ${dragging ? 'drop-zone-active' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current.click()}
            >
              <div className="drop-icon">📂</div>
              <div className="drop-text">Перетащи файл сюда или нажми для выбора</div>
              <div className="drop-hint">CSV, Excel (.xlsx / .xls), JSON</div>
              <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls,.json" style={{ display: 'none' }}
                onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
            </div>
            {error && <p className="field-error" style={{ marginTop: 12 }}>{error}</p>}
            <div className="import-hint-list">
              <p>Как будет импортировано:</p>
              <ul>
                <li><b>CSV</b> — один лист, первая строка = заголовки колонок</li>
                <li><b>Excel</b> — каждый лист файла = отдельный лист базы, даты сохраняются в формате ДД.ММ.ГГГГ</li>
                <li><b>JSON</b> — массив объектов или формат GistDB</li>
              </ul>
            </div>
          </>
        ) : (
          <div className="import-preview">
            <div className="preview-info">
              <div className="preview-name">📋 {preview.name}</div>
              <div className="preview-meta">
                {preview.sheets.length} {preview.sheets.length === 1 ? 'лист' : 'листов'} ·{' '}
                {preview.sheets.reduce((s, sh) => s + sh.rows.length, 0)} строк ·{' '}
                {preview.sheets[0]?.cols.length || 0} колонок
              </div>
              <div className="preview-sheets">
                {preview.sheets.map(s => (
                  <span key={s.id} className="preview-sheet-tag">{s.name}</span>
                ))}
              </div>
            </div>
            <p className="preview-confirm-text">Создать новую базу с этими данными?</p>
            <div className="settings-actions">
              <button className="btn-primary" onClick={() => onImport(preview)}>Создать базу</button>
              <button className="btn-ghost" onClick={() => setPreview(null)}>← Назад</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
