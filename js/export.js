/**
 * export.js - Export schedule to Excel (.xlsx) and Word-compatible HTML (.doc)
 * Uses SheetJS (XLSX) for Excel export.
 */
const ExportManager = (() => {

  // ── Excel Export ─────────────────────────────────────────────────────────
  /**
   * Export schedule for a sport to an Excel file.
   * Format: rows = time slots (30-min), columns = dates
   */
  function exportSportToExcel(sportId) {
    if (typeof XLSX === 'undefined') {
      alert('ExcelライブラリがロードされていないのでExcelエクスポートができません。');
      return;
    }

    const sport  = DataManager.getSport(sportId);
    if (!sport) return;
    const dr     = DataManager.getDateRange();
    const start  = sport.startDate || dr.start;
    const end    = sport.endDate   || dr.end;
    const dates  = DataManager.getDatesInRange(start, end);
    const wb     = XLSX.utils.book_new();

    // Build sheet data
    const aoa = buildSheetData(sportId, dates);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths
    ws['!cols'] = [{ wch: 8 }, ...dates.map(() => ({ wch: 22 }))];

    // Apply styles (background colors) - SheetJS community edition doesn't support styles,
    // but we can set basic cell formats
    applyBasicStyles(ws, dates.length);

    XLSX.utils.book_append_sheet(wb, ws, sport.shortName || sport.name);

    const filename = `schedule_${sport.shortName || sportId}_${start}_${end}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  function buildSheetData(sportId, dates) {
    const START_HOUR = 6;
    const END_HOUR   = 24;

    // Header row: time label + date columns
    const headerRow = ['時刻', ...dates.map(d => DataManager.formatDate(d))];
    const rows = [headerRow];

    // For each 30-min slot, create a row
    for (let h = START_HOUR; h < END_HOUR; h++) {
      for (let m = 0; m < 60; m += 30) {
        const timeLabel = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        const row = [timeLabel];

        for (const date of dates) {
          const events = DataManager.getEvents(sportId, date);
          // Find events that cover this slot
          const matching = events.filter(ev => {
            const evStart = timeToMinutes(ev.startTime);
            const evEnd   = timeToMinutes(ev.endTime);
            const slotStart = h * 60 + m;
            const slotEnd   = slotStart + 30;
            return evStart < slotEnd && evEnd > slotStart;
          });

          if (matching.length === 0) {
            row.push('');
          } else {
            // Show events starting in this slot prominently
            const starting = matching.filter(ev => ev.startTime === timeLabel);
            const continuing = matching.filter(ev => ev.startTime !== timeLabel);
            let cellText = '';
            if (starting.length > 0) {
              cellText = starting.map(ev => {
                const note = ev.note ? `\n　📝 ${ev.note}` : '';
                return `▶${ev.title}(${ev.startTime}–${ev.endTime})${note}`;
              }).join('\n');
            } else if (continuing.length > 0) {
              cellText = continuing.map(ev => `　${ev.title}`).join('\n');
            }
            row.push(cellText);
          }
        }
        rows.push(row);
      }
    }

    return rows;
  }

  function applyBasicStyles(ws, numDateCols) {
    // Set row heights and basic cell alignment
    const rowCount = (24 - 6) * 2 + 1; // slots + header
    ws['!rows'] = Array.from({length: rowCount}, (_, i) => ({ hpt: i === 0 ? 30 : 20 }));
  }

  function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  // ── Export all sports to one Excel workbook ───────────────────────────────
  function exportAllToExcel() {
    if (typeof XLSX === 'undefined') {
      alert('ExcelライブラリがロードされていないのでExcelエクスポートができません。');
      return;
    }

    const wb     = XLSX.utils.book_new();
    const sports = DataManager.getSports();
    const dr     = DataManager.getDateRange();

    sports.forEach(sport => {
      const start  = sport.startDate || dr.start;
      const end    = sport.endDate   || dr.end;
      const dates  = DataManager.getDatesInRange(start, end);
      const aoa    = buildSheetData(sport.id, dates);
      const ws     = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols']  = [{ wch: 8 }, ...dates.map(() => ({ wch: 22 }))];
      // Sheet names must be ≤31 chars
      const sheetName = (sport.shortName || sport.name).slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `schedule_all_${dr.start}_${dr.end}.xlsx`);
  }

  // ── Export hotel schedule to Excel ────────────────────────────────────────
  function exportHotelToExcel(hotelId) {
    if (typeof XLSX === 'undefined') {
      alert('ExcelライブラリがロードされていないのでExcelエクスポートができません。');
      return;
    }

    const hotel  = DataManager.getHotel(hotelId);
    if (!hotel) return;
    const sports = DataManager.getSportsForHotel(hotelId);
    const dr     = DataManager.getDateRange();
    const wb     = XLSX.utils.book_new();

    sports.forEach(sport => {
      const start  = sport.startDate || dr.start;
      const end    = sport.endDate   || dr.end;
      const dates  = DataManager.getDatesInRange(start, end);
      const aoa    = buildSheetData(sport.id, dates);
      const ws     = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols']  = [{ wch: 8 }, ...dates.map(() => ({ wch: 22 }))];
      const sheetName = (sport.shortName || sport.name).slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const filename = `schedule_${hotel.name}_${dr.start}_${dr.end}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  // ── Word-compatible HTML export ───────────────────────────────────────────
  /**
   * Generates an HTML file that can be opened in Microsoft Word.
   * The file contains a styled table with time × date layout.
   */
  function exportSportToWord(sportId) {
    const sport  = DataManager.getSport(sportId);
    if (!sport) return;
    const dr     = DataManager.getDateRange();
    const start  = sport.startDate || dr.start;
    const end    = sport.endDate   || dr.end;
    const dates  = DataManager.getDatesInRange(start, end);

    const html = buildWordHTML(sport, dates);
    downloadFile(html, `schedule_${sport.shortName || sportId}_${start}_${end}.doc`, 'application/msword');
  }

  function exportHotelToWord(hotelId) {
    const hotel  = DataManager.getHotel(hotelId);
    if (!hotel) return;
    const sports = DataManager.getSportsForHotel(hotelId);
    const dr     = DataManager.getDateRange();

    let allHtml = '';
    sports.forEach((sport, i) => {
      const start = sport.startDate || dr.start;
      const end   = sport.endDate   || dr.end;
      const dates = DataManager.getDatesInRange(start, end);
      allHtml += buildWordHTML(sport, dates, i > 0);
    });

    const fullHtml = wrapWordHTML(`${hotel.name} スケジュール`, allHtml);
    downloadFile(fullHtml, `schedule_${hotel.name}_${dr.start}_${dr.end}.doc`, 'application/msword');
  }

  function buildWordHTML(sport, dates, pageBreak = false) {
    const START_HOUR = 6;
    const END_HOUR   = 24;

    // Build table rows
    let tableRows = '';

    // Header row
    const dateHeaders = dates.map(d => `
      <th style="background:#2c3e50;color:white;padding:4px 6px;font-size:11px;white-space:nowrap;border:1px solid #ccc;min-width:90px;">
        ${DataManager.formatDate(d)}
      </th>`).join('');

    tableRows += `
      <tr>
        <th style="background:#2c3e50;color:white;padding:4px 6px;font-size:11px;width:50px;border:1px solid #ccc;">時刻</th>
        ${dateHeaders}
      </tr>`;

    // Precompute: for each date, collect events and their slot spans
    const dateEventMaps = {};
    for (const date of dates) {
      const events = DataManager.getEvents(sport.id, date);
      const map = {}; // slotKey → event
      events.forEach(ev => {
        const sMin = timeToMinutes(ev.startTime);
        const eMin = timeToMinutes(ev.endTime);
        for (let m = sMin; m < eMin; m += 30) {
          if (m >= START_HOUR * 60 && m < END_HOUR * 60) {
            map[m] = ev;
          }
        }
      });
      dateEventMaps[date] = map;
    }

    // Track which cells have been rendered (for rowspan)
    const rendered = {}; // `${date}|${slotMins}` → true

    for (let h = START_HOUR; h < END_HOUR; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slotMins  = h * 60 + m;
        const timeLabel = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        const isHour    = m === 0;

        let rowHtml = `
          <tr>
            <td style="padding:2px 4px;font-size:10px;font-weight:${isHour?'bold':'normal'};background:${isHour?'#f8f9fa':'white'};border:1px solid #ddd;white-space:nowrap;vertical-align:top;">
              ${isHour ? timeLabel : ''}
            </td>`;

        for (const date of dates) {
          const key = `${date}|${slotMins}`;
          if (rendered[key]) continue;

          const ev = dateEventMaps[date][slotMins];
          if (!ev) {
            rowHtml += `<td style="padding:2px;border:1px solid #eee;min-height:16px;">&nbsp;</td>`;
          } else {
            // Only render if this is the start slot of the event
            const evStartMins = timeToMinutes(ev.startTime);
            if (evStartMins === slotMins) {
              const evEndMins  = timeToMinutes(ev.endTime);
              const rowspan    = Math.ceil((evEndMins - evStartMins) / 30);
              const cat        = DataManager.getCategory(ev.category) || { color: '#7f8c8d' };
              const bgColor    = ev.color || cat.color;
              const textColor  = _lightOrDark(bgColor) === 'light' ? '#333' : '#fff';

              // Mark all covered slots as rendered
              for (let ms = evStartMins; ms < evEndMins; ms += 30) {
                rendered[`${date}|${ms}`] = true;
              }

              rowHtml += `
                <td rowspan="${rowspan}" style="
                  background:${bgColor};color:${textColor};
                  padding:3px 5px;font-size:10px;border:1px solid #ccc;
                  vertical-align:top;">
                  <strong>${ev.title}</strong><br>
                  <span style="font-size:9px;">${ev.startTime}–${ev.endTime}</span>
                  ${ev.note ? `<br><span style="font-size:9px;">${ev.note}</span>` : ''}
                </td>`;
            } else {
              // This slot is part of an event but not its start - skip (rowspan handles it)
              // But we need to not add a cell here
            }
          }
        }

        rowHtml += '</tr>';
        tableRows += rowHtml;
      }
    }

    const pb = pageBreak ? '<div style="page-break-before:always;"></div>' : '';
    return `
      ${pb}
      <h2 style="font-size:16px;margin:16px 0 8px;color:#2c3e50;">${sport.name} スケジュール</h2>
      <p style="font-size:12px;color:#7f8c8d;margin-bottom:8px;">
        滞在期間: ${DataManager.formatDateFull(dates[0])} ～ ${DataManager.formatDateFull(dates[dates.length-1])}
      </p>
      <table style="border-collapse:collapse;width:100%;font-family:'Meiryo','Yu Gothic',sans-serif;">
        ${tableRows}
      </table>`;
  }

  function wrapWordHTML(title, bodyHtml) {
    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <!--[if gte mso 9]>
  <xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom></w:WordDocument></xml>
  <![endif]-->
  <style>
    body { font-family: 'Meiryo', 'Yu Gothic', sans-serif; font-size: 11pt; margin: 20mm; }
    table { border-collapse: collapse; }
    td, th { border: 1px solid #ccc; }
  </style>
</head>
<body>
  <h1 style="font-size:18pt;color:#2c3e50;margin-bottom:12pt;">${title}</h1>
  ${bodyHtml}
</body>
</html>`;
  }

  // ── Helper: determine if color is light or dark ───────────────────────────
  function _lightOrDark(hex) {
    const c = hex.replace('#','');
    const r = parseInt(c.substr(0,2),16);
    const g = parseInt(c.substr(2,2),16);
    const b = parseInt(c.substr(4,2),16);
    const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
    return luminance > 0.5 ? 'light' : 'dark';
  }

  // ── File download helper ──────────────────────────────────────────────────
  function downloadFile(content, filename, mimeType) {
    const blob = new Blob(['\ufeff' + content], { type: mimeType + ';charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadJSON(content, filename) {
    downloadFile(content, filename, 'application/json');
  }

  // ── Data Management: xlsx/csv export ─────────────────────────────────────
  function _schedulesToRows() {
    const rows = [];
    for (const sport of DataManager.getSports()) {
      const eventsMap = DataManager.getAllEventsForSport(sport.id);
      for (const [date, events] of Object.entries(eventsMap)) {
        for (const ev of events) {
          rows.push({
            sportId: sport.id,
            sportName: sport.name,
            date,
            id: ev.id || '',
            title: ev.title || '',
            startTime: ev.startTime || '',
            endTime: ev.endTime || '',
            category: ev.category || '',
            note: ev.note || '',
            color: ev.color || '',
          });
        }
      }
    }
    return rows;
  }

  function _forceTextCols(ws, colNames) {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const colMap = {};
    for (let C = range.s.c; C <= range.e.c; C++) {
      const h = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
      if (h && colNames.includes(h.v)) colMap[C] = true;
    }
    for (let R = range.s.r + 1; R <= range.e.r; R++) {
      Object.keys(colMap).forEach(C => {
        const addr = XLSX.utils.encode_cell({ r: R, c: +C });
        if (!ws[addr]) return;
        ws[addr] = { t: 's', v: String(ws[addr].v || ''), z: '@' };
      });
    }
  }

  function _masterSheets(wb) {
    const m = DataManager.getMaster();
    const sports = (m.sports || []).map(s => ({
      id: s.id, name: s.name, shortName: s.shortName || '', color: s.color || '',
      startDate: s.startDate || '', endDate: s.endDate || '',
      hotelIds: (s.hotelIds || []).join(';'), venueIds: (s.venueIds || []).join(';'),
      isSoccer: s.isSoccer ? 1 : 0,
    }));
    const hotels = (m.hotels || []).map(h => ({
      id: h.id, name: h.name, shortName: h.shortName || '', color: h.color || '', address: h.address || '',
    }));
    const venues = (m.venues || []).map(v => ({
      id: v.id, name: v.name, hotelId: v.hotelId || '', city: v.city || '',
    }));
    const cats = (m.eventCategories || []).map(c => ({
      id: c.id, name: c.name, color: c.color || '',
    }));
    const toSheet = arr => XLSX.utils.json_to_sheet(arr.length ? arr : [{}]);
    const sportsSheet = toSheet(sports);
    _forceTextCols(sportsSheet, ['startDate', 'endDate']);
    XLSX.utils.book_append_sheet(wb, sportsSheet, '競技');
    XLSX.utils.book_append_sheet(wb, toSheet(hotels), 'ホテル');
    XLSX.utils.book_append_sheet(wb, toSheet(venues), '会場');
    XLSX.utils.book_append_sheet(wb, toSheet(cats), 'イベント種別');
  }

  function exportMasterXLSX() {
    if (typeof XLSX === 'undefined') { alert('XLSXライブラリが必要です。'); return; }
    const wb = XLSX.utils.book_new();
    _masterSheets(wb);
    XLSX.writeFile(wb, 'master.xlsx');
  }

  // ── Japanese key mapping ─────────────────────────────────────────────────
  const JA_HEADERS = {
    sportId:   '競技ID',
    sportName: '競技名',
    date:      '日付(YYYY-MM-DD)',
    title:     'タイトル',
    startTime: '開始時刻(HH:MM)',
    endTime:   '終了時刻(HH:MM)',
    category:  'カテゴリID',
    note:      '詳細コメント',
    color:     'カラー(省略可)',
  };

  function _toJaRow(r) {
    return {
      [JA_HEADERS.sportId]:   r.sportId   || '',
      [JA_HEADERS.sportName]: r.sportName || '',
      [JA_HEADERS.date]:      r.date      || '',
      [JA_HEADERS.title]:     r.title     || '',
      [JA_HEADERS.startTime]: r.startTime || '',
      [JA_HEADERS.endTime]:   r.endTime   || '',
      [JA_HEADERS.category]:  r.category  || '',
      [JA_HEADERS.note]:      r.note      || '',
      [JA_HEADERS.color]:     r.color     || '',
    };
  }

  // Force time columns (colStart=4, colEnd=5) to text format so Excel won't auto-convert
  function _forceTimeCols(ws) {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      for (const c of [4, 5]) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]) {
          ws[addr].t = 's';
          ws[addr].z = '@';
        }
      }
    }
  }

  function _schedColWidths() {
    return [
      { wch: 16 }, // 競技ID
      { wch: 22 }, // 競技名
      { wch: 16 }, // 日付
      { wch: 22 }, // タイトル
      { wch: 14 }, // 開始時刻
      { wch: 14 }, // 終了時刻
      { wch: 18 }, // カテゴリID
      { wch: 45 }, // 詳細コメント
      { wch: 14 }, // カラー
    ];
  }

  function _appendRefSheets(wb) {
    // ── Category reference ────────────────────────────────────────────────
    const cats = DataManager.getCategories();
    const catRows = cats.map(c => ({
      'カテゴリID (このIDをスケジュールに入力)': c.id,
      'カテゴリ名': c.name,
      'カラー': c.color,
    }));
    const catWs = XLSX.utils.json_to_sheet(catRows.length ? catRows : [{}]);
    catWs['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, catWs, 'カテゴリ一覧');

    // ── Sport reference ───────────────────────────────────────────────────
    const sports = DataManager.getSports();
    const dr     = DataManager.getDateRange();
    const sportRows = sports.map(s => ({
      '競技ID (このIDをスケジュールに入力)': s.id,
      '競技名': s.name,
      '滞在開始日': s.startDate || dr.start,
      '滞在終了日': s.endDate   || dr.end,
    }));
    const sportWs = XLSX.utils.json_to_sheet(sportRows.length ? sportRows : [{}]);
    sportWs['!cols'] = [{ wch: 35 }, { wch: 28 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, sportWs, '競技一覧');

    // ── How-to sheet ──────────────────────────────────────────────────────
    const howto = [
      ['■ スケジュールの入力方法'],
      [''],
      ['列名', '説明', '入力例'],
      [JA_HEADERS.sportId,   '「競技一覧」シートのIDをコピー', 'athletics'],
      [JA_HEADERS.sportName, '自動参照用（入力不要）', '陸上（TF）'],
      [JA_HEADERS.date,      '日付をYYYY-MM-DD形式で入力', '2026-09-16'],
      [JA_HEADERS.title,     'スケジュールの短いタイトル', '朝食'],
      [JA_HEADERS.startTime, 'HH:MM形式で入力', '07:00'],
      [JA_HEADERS.endTime,   'HH:MM形式で入力', '08:30'],
      [JA_HEADERS.category,  '「カテゴリ一覧」シートのIDをコピー', 'meal'],
      [JA_HEADERS.note,      '印刷・PDF出力に反映される詳細情報', '3階レストランにて。食後エレベーターで客室へ'],
      [JA_HEADERS.color,     '省略可。#rrggbb形式またはそのまま空白', '#f39c12'],
      [''],
      ['■ よく使うカテゴリID'],
      ['checkin', 'チェックイン/アウト', ''],
      ['meal', '食事', ''],
      ['training', '練習・トレーニング', ''],
      ['competition', '競技', ''],
      ['transport', '移動・交通', ''],
      ['meeting', 'ミーティング', ''],
      ['rest', '休息・自由時間', ''],
      [''],
      ['■ 注意事項'],
      ['・「スケジュール」シートのみアップロード対象です。他シートは変更不要です。'],
      ['・日付はYYYY-MM-DD形式（例：2026-09-16）で入力してください。'],
      ['・開始・終了時刻はHH:MM形式（例：07:00）で入力してください。'],
      ['・アップロード後、既存のスケジュールデータは上書きされます。'],
    ];
    const howtoWs = XLSX.utils.aoa_to_sheet(howto);
    howtoWs['!cols'] = [{ wch: 28 }, { wch: 45 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, howtoWs, '使い方・注意事項');
  }

  function exportSchedulesXLSX() {
    if (typeof XLSX === 'undefined') { alert('XLSXライブラリが必要です。'); return; }
    const rows = _schedulesToRows();
    const wb = XLSX.utils.book_new();
    const empty = _toJaRow({ sportId:'', sportName:'', date:'', title:'', startTime:'', endTime:'', category:'', note:'', color:'' });
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows.map(_toJaRow) : [empty]);
    ws['!cols'] = _schedColWidths();
    _forceTimeCols(ws);
    XLSX.utils.book_append_sheet(wb, ws, 'スケジュール');
    _appendRefSheets(wb);
    XLSX.writeFile(wb, 'schedules.xlsx');
  }

  // ── Schedule template (pre-populated with check-in / meals / check-out) ──
  function exportScheduleTemplate() {
    if (typeof XLSX === 'undefined') { alert('XLSXライブラリが必要です。'); return; }
    const wb   = XLSX.utils.book_new();
    const dr   = DataManager.getDateRange();
    const rows = [];

    for (const sport of DataManager.getSports()) {
      const start = sport.startDate || dr.start;
      const end   = sport.endDate   || dr.end;
      const dates = DataManager.getDatesInRange(start, end);

      dates.forEach((date, i) => {
        const isFirst = i === 0;
        const isLast  = i === dates.length - 1;

        if (isFirst) {
          rows.push({ sportId: sport.id, sportName: sport.name, date,
            title: 'チェックイン', startTime: '15:00', endTime: '16:00',
            category: 'checkin', note: '', color: '' });
        }

        rows.push({ sportId: sport.id, sportName: sport.name, date,
          title: '朝食', startTime: '07:00', endTime: '08:30',
          category: 'meal', note: '', color: '' });

        rows.push({ sportId: sport.id, sportName: sport.name, date,
          title: '夕食', startTime: '18:00', endTime: '20:00',
          category: 'meal', note: '', color: '' });

        if (isLast) {
          rows.push({ sportId: sport.id, sportName: sport.name, date,
            title: 'チェックアウト', startTime: '10:00', endTime: '11:00',
            category: 'checkin', note: '', color: '' });
        }
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows.length ? rows.map(_toJaRow) : [_toJaRow({})]);
    ws['!cols'] = _schedColWidths();
    _forceTimeCols(ws);
    XLSX.utils.book_append_sheet(wb, ws, 'スケジュール');
    _appendRefSheets(wb);
    XLSX.writeFile(wb, 'schedules_template.xlsx');
  }

  function exportSchedulesCSV() {
    const rows = _schedulesToRows();
    const headers = ['sportId','sportName','date','id','title','startTime','endTime','category','note','color'];
    const escape = v => `"${String(v).replace(/"/g,'""')}"`;
    const lines = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h] ?? '')).join(','))];
    downloadFile(lines.join('\n'), 'schedules.csv', 'text/csv');
  }

  function exportFullXLSX() {
    if (typeof XLSX === 'undefined') { alert('XLSXライブラリが必要です。'); return; }
    const wb = XLSX.utils.book_new();
    _masterSheets(wb);
    const rows = _schedulesToRows();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), 'スケジュール');
    const tmpls = DataManager.getTemplates().map(t => ({
      id: t.id, name: t.name, createdAt: t.createdAt || '',
      events: JSON.stringify(t.events || []),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tmpls.length ? tmpls : [{}]), 'テンプレート');
    XLSX.writeFile(wb, `backup_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  // ── Export modal ──────────────────────────────────────────────────────────
  function showExportModal(sportId, hotelId) {
    const sport = sportId ? DataManager.getSport(sportId) : null;
    const hotel = hotelId ? DataManager.getHotel(hotelId) : null;
    const name  = sport ? sport.name : hotel ? hotel.name : '全競技';

    const html = `
      <div class="modal-overlay" id="export-modal" onclick="if(event.target===this)ExportManager.closeExportModal()">
        <div class="modal">
          <div class="modal-header">
            <h3>エクスポート: ${name}</h3>
            <button class="modal-close" onclick="ExportManager.closeExportModal()">×</button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom:16px;color:#7f8c8d;font-size:13px;">出力形式を選択してください</p>
            <div style="display:grid;gap:10px;">
              ${sport ? `
                <button class="btn btn-success" onclick="ExportManager.exportSportToExcel('${sportId}');ExportManager.closeExportModal()">
                  📊 Excelファイル (.xlsx) でダウンロード
                </button>
                <button class="btn btn-outline" onclick="ExportManager.exportSportToWord('${sportId}');ExportManager.closeExportModal()">
                  📄 Wordファイル (.doc) でダウンロード
                </button>
              ` : ''}
              ${hotel ? `
                <button class="btn btn-success" onclick="ExportManager.exportHotelToExcel('${hotelId}');ExportManager.closeExportModal()">
                  📊 Excelファイル (.xlsx) でダウンロード
                </button>
                <button class="btn btn-outline" onclick="ExportManager.exportHotelToWord('${hotelId}');ExportManager.closeExportModal()">
                  📄 Wordファイル (.doc) でダウンロード
                </button>
              ` : ''}
              ${!sport && !hotel ? `
                <button class="btn btn-success" onclick="ExportManager.exportAllToExcel();ExportManager.closeExportModal()">
                  📊 全競技をExcel (.xlsx) でダウンロード
                </button>
              ` : ''}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="ExportManager.closeExportModal()">キャンセル</button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  function closeExportModal() {
    const m = document.getElementById('export-modal');
    if (m) m.remove();
  }

  return {
    exportSportToExcel, exportAllToExcel, exportHotelToExcel,
    exportSportToWord, exportHotelToWord,
    downloadJSON,
    exportMasterXLSX, exportSchedulesXLSX, exportSchedulesCSV, exportFullXLSX,
    exportScheduleTemplate,
    showExportModal, closeExportModal,
  };
})();
