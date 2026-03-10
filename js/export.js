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
              cellText = starting.map(ev => `▶${ev.title}(${ev.startTime}–${ev.endTime})`).join('\n');
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
    showExportModal, closeExportModal,
  };
})();
