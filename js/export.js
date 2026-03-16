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

    const bodyHtml = buildWordHTML(sport, dates);
    const fullHtml = wrapWordHTML(`${sport.name} スケジュール`, bodyHtml);
    downloadFile(fullHtml, `schedule_${sport.shortName || sportId}_${start}_${end}.doc`, 'application/msword');
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

  const DAY_TYPE_LABELS = {
    checkin:     'チェックイン日',
    practice:    '練習日',
    competition: '競技日',
    stay:        '滞在日',
    checkout:    'チェックアウト日',
  };

  function buildWordHTML(sport, dates, pageBreak = false) {
    const TH = 'background:#2c3e50;color:white;padding:5px 7px;font-size:10pt;border:1pt solid #1a252f;text-align:center;';

    // Data cells: visible left/right column separators, white top/bottom (invisible on white bg)
    const SIDE  = '1pt solid #c0c0c0';
    const INVIS = '1pt solid white';   // "invisible" border – overridden by separator row's 3pt border
    const TD_DATA = `border-top:${INVIS};border-bottom:${INVIS};border-left:${SIDE};border-right:${SIDE};padding:4px 7px;font-size:9pt;vertical-align:top;line-height:1.5;background:white;`;
    const TD_TIME = `border-top:${INVIS};border-bottom:${INVIS};border-left:${SIDE};border-right:${SIDE};padding:3px 5px;font-size:8pt;text-align:center;vertical-align:middle;line-height:1.5;background:white;`;
    const TD_DATE = `border-top:${INVIS};border-bottom:${INVIS};border-left:${SIDE};border-right:${SIDE};padding:4px 7px;font-size:9pt;vertical-align:top;white-space:nowrap;line-height:1.5;background:white;`;

    // Day separator row: thin 2pt strip, Word-exact height
    const DAY_SEP = `<tr style="mso-row-height-rule:exactly;height:.5pt;"><td colspan="3" style="height:.5pt;padding:0;background:#999999;border-top:.5pt solid #999999;border-bottom:.5pt solid #999999;border-left:1pt solid #c0c0c0;border-right:1pt solid #c0c0c0;font-size:.5pt;line-height:.5pt;mso-line-height-alt:.5pt;"></td></tr>`;

    // Category color map
    const cats = DataManager.getCategories();
    const catMap = {};
    cats.forEach(c => { catMap[c.id] = c; });

    // Resolve hotel name
    const hotels = DataManager.getHotelsForSport(sport.id);
    const hotelName = hotels.length > 0 ? hotels.map(h => h.name).join('、') : '';

    // Build rows per day
    let tableRows = '';

    for (let di = 0; di < dates.length; di++) {
      const date   = dates[di];
      const events = DataManager.getEvents(sport.id, date);
      const [y, mo, d] = date.split('-');
      const dow = ['日','月','火','水','木','金','土'][new Date(date).getDay()];
      const dateLabel = `${y}/${Number(mo)}/${Number(d)}（${dow}）`;

      const dayType      = DataManager.getDayType(sport.id, date);
      const dayTypeLabel = dayType ? (DAY_TYPE_LABELS[dayType] || '') : '';
      const dateCellText = dayTypeLabel
        ? `${dateLabel}<br><span style="font-size:8pt;color:#555;">${dayTypeLabel}</span>`
        : dateLabel;

      // Dark separator row between days (not before the first day)
      if (di > 0) tableRows += DAY_SEP;

      if (events.length === 0) {
        tableRows += `
          <tr>
            <td style="${TD_DATE}">${dateCellText}</td>
            <td style="${TD_TIME}"></td>
            <td style="${TD_DATA}"></td>
          </tr>`;
        continue;
      }

      events.forEach((ev, i) => {
        const cat     = catMap[ev.category];
        const evColor = ev.color || (cat ? cat.color : null);

        const titleSpan = evColor
          ? `<span style="color:${evColor};font-weight:bold;">${ev.title}</span>`
          : `<span style="font-weight:bold;">${ev.title}</span>`;
        const timeStr   = `${ev.startTime}<br>～<br>${ev.endTime}`;

        // Title + location on the same line
        let titleLine = titleSpan;
        if (ev.floor || ev.location) {
          const locText = [ev.floor ? `${ev.floor}階` : '', ev.location || ''].filter(Boolean).join('　');
          titleLine += `<span style="color:#ccc;padding:0 6pt;">｜</span><span style="font-size:8.5pt;color:#555;">📍 ${locText}</span>`;
        }

        const parts = [titleLine];
        if (ev.note) {
          parts.push(`<div style="margin-top:2pt;font-size:8pt;color:#7f8c8d;font-style:italic;">📝 ${ev.note}</div>`);
        }
        const activity = parts.join('');

        if (i === 0) {
          tableRows += `
            <tr>
              <td rowspan="${events.length}" style="${TD_DATE}">${dateCellText}</td>
              <td style="${TD_TIME}">${timeStr}</td>
              <td style="${TD_DATA}">${activity}</td>
            </tr>`;
        } else {
          tableRows += `
            <tr>
              <td style="${TD_TIME}">${timeStr}</td>
              <td style="${TD_DATA}">${activity}</td>
            </tr>`;
        }
      });
    }

    // Hard page break (mso-break-type ensures Word respects it)
    const pb = pageBreak
      ? '<div style="page-break-before:always;mso-break-type:page-break;">&nbsp;</div>'
      : '';
    return `
      ${pb}
      <p style="text-align:center;font-size:15pt;font-weight:bold;margin:0 0 10pt;">行動計画表（ドラフト）</p>
      <p style="font-size:10pt;font-weight:bold;margin:0 0 3pt;">競技：${sport.name}</p>
      ${hotelName ? `<p style="font-size:10pt;font-weight:bold;margin:0 0 10pt;">宿泊施設：${hotelName}</p>` : '<p style="margin:0 0 10pt;"></p>'}
      <table cellspacing="0" style="border-collapse:collapse;width:100%;font-family:'Meiryo','Yu Gothic',sans-serif;border:2pt solid #2c3e50;">
        <thead>
          <tr>
            <th style="${TH}width:82pt;">年月日</th>
            <th style="${TH}width:56pt;">予定時間</th>
            <th style="${TH}">行動予定</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>`;
  }

  // ── Timetable XLSX export (time rows × date×sport columns) ──────────────
  function exportTimetableXLS(sportIds) {
    // Use XLSXStyle (xlsx-js-style) for full cell styling support
    const XS = (typeof XLSXStyle !== 'undefined') ? XLSXStyle
             : (typeof XLSX     !== 'undefined') ? XLSX : null;
    if (!XS) { alert('ExcelライブラリがロードされていないのでExcelエクスポートができません。'); return; }

    const sports = sportIds.map(id => DataManager.getSport(id)).filter(Boolean);
    if (sports.length === 0) { alert('競技を選択してください。'); return; }

    const cats = DataManager.getCategories();
    const catMap = {};
    cats.forEach(c => { catMap[c.id] = c; });

    const dr = DataManager.getDateRange();
    const allDatesSet = new Set();
    for (const sport of sports) {
      const start = sport.startDate || dr.start;
      const end   = sport.endDate   || dr.end;
      DataManager.getDatesInRange(start, end).forEach(d => allDatesSet.add(d));
    }
    const dates = [...allDatesSet].sort();

    const START_MIN = 6 * 60, END_MIN = 24 * 60, SLOT = 30;
    const slots = [];
    for (let m = START_MIN; m < END_MIN; m += SLOT) slots.push(m);

    const evCache = {};
    for (const sport of sports) {
      evCache[sport.id] = {};
      for (const date of dates) {
        evCache[sport.id][date] = DataManager.getEvents(sport.id, date);
      }
    }

    // Returns the event that starts in this 30-min slot
    function eventStartingAt(sportId, date, slotMin) {
      return (evCache[sportId][date] || []).find(ev => {
        const s = timeToMinutes(ev.startTime);
        return s >= slotMin && s < slotMin + SLOT;
      }) || null;
    }

    // Returns the event covering this slot (started at or before, ends after)
    function eventCovering(sportId, date, slotMin) {
      return (evCache[sportId][date] || []).find(ev => {
        const s = timeToMinutes(ev.startTime);
        const e = timeToMinutes(ev.endTime);
        return s <= slotMin && e > slotMin;
      }) || null;
    }

    // hex color → 6-char RRGGBB (uppercase)
    function toRGB(hex) {
      if (!hex) return null;
      const h = hex.replace('#', '');
      return (h.length === 3
        ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2]
        : h.substring(0, 6)).toUpperCase();
    }

    function fgForBg(hex) {
      try { return _lightOrDark(hex) === 'light' ? '1A1A1A' : 'FFFFFF'; }
      catch(e) { return 'FFFFFF'; }
    }

    const S = sports.length;

    // ── Build 2D array ──────────────────────────────────────────────────────
    const aoa = [];

    // Row 0: "時刻" + date labels (first cell of each date group, rest blank)
    const row0 = ['時刻'];
    for (const date of dates) {
      const [, mo, d] = date.split('-');
      const dow = ['日','月','火','水','木','金','土'][new Date(date).getDay()];
      row0.push(`${Number(mo)}/${Number(d)}（${dow}）`);
      for (let si = 1; si < S; si++) row0.push('');
    }
    aoa.push(row0);

    // Row 1: blank + sport sub-headers
    const row1 = [''];
    for (const date of dates) {
      for (const sport of sports) row1.push(sport.shortName || sport.name);
    }
    aoa.push(row1);

    // Rows 2+: time slots
    for (const slotMin of slots) {
      const hh = String(Math.floor(slotMin / 60)).padStart(2, '0');
      const mm = String(slotMin % 60).padStart(2, '0');
      const row = [`${hh}:${mm}`];
      for (let di = 0; di < dates.length; di++) {
        const date = dates[di];
        for (let si = 0; si < S; si++) {
          const sport = sports[si];
          const startEv = eventStartingAt(sport.id, date, slotMin);
          if (startEv) {
            const locParts = [startEv.floor ? `${startEv.floor}F` : '', startEv.location || ''].filter(Boolean);
            const loc = locParts.length ? `\n${locParts.join(' ')}` : '';
            row.push(`${startEv.startTime}–${startEv.endTime}\n${startEv.title}${loc}`);
          } else {
            row.push('');
          }
        }
      }
      aoa.push(row);
    }

    const ws = XS.utils.aoa_to_sheet(aoa);

    // ── Apply styles ────────────────────────────────────────────────────────
    function mkBorder(left, top, right, bottom) {
      const B = (style, rgb) => ({ style, color: { rgb } });
      return {
        left:   B(...left),
        top:    B(...top),
        right:  B(...right),
        bottom: B(...bottom),
      };
    }
    const THIN   = ['thin',   'CCCCCC'];
    const MED    = ['medium', '000000'];
    const HOUR   = ['medium', 'AAAAAA'];

    // Row 0: date header row
    const r0TimeStyle = {
      fill: { fgColor: { rgb: '2C3E50' } },
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Meiryo' },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: mkBorder(MED, MED, MED, MED),
    };
    const r0Cell = XS.utils.encode_cell({ r: 0, c: 0 });
    if (!ws[r0Cell]) ws[r0Cell] = { t: 's', v: '時刻' };
    ws[r0Cell].s = r0TimeStyle;

    for (let di = 0; di < dates.length; di++) {
      for (let si = 0; si < S; si++) {
        const c = 1 + di * S + si;
        const addr = XS.utils.encode_cell({ r: 0, c });
        if (!ws[addr]) ws[addr] = { t: 's', v: '' };
        const leftB  = (si === 0) ? MED : THIN;
        const rightB = (si === S - 1) ? MED : THIN;
        ws[addr].s = {
          fill: { fgColor: { rgb: '2C3E50' } },
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Meiryo' },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: mkBorder(leftB, MED, rightB, MED),
        };
      }
    }

    // Row 1: sport sub-header row
    const r1TimeAddr = XS.utils.encode_cell({ r: 1, c: 0 });
    if (!ws[r1TimeAddr]) ws[r1TimeAddr] = { t: 's', v: '' };
    ws[r1TimeAddr].s = r0TimeStyle;

    for (let di = 0; di < dates.length; di++) {
      for (let si = 0; si < S; si++) {
        const c = 1 + di * S + si;
        const addr = XS.utils.encode_cell({ r: 1, c });
        if (!ws[addr]) ws[addr] = { t: 's', v: '' };
        const sport  = sports[si];
        const bg     = toRGB(sport.color) || '7F8C8D';
        const leftB  = (si === 0) ? MED : THIN;
        const rightB = (si === S - 1) ? MED : THIN;
        ws[addr].s = {
          fill: { fgColor: { rgb: bg } },
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9, name: 'Meiryo' },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: mkBorder(leftB, THIN, rightB, MED),
        };
      }
    }

    // Rows 2+: data rows
    for (let ri = 0; ri < slots.length; ri++) {
      const slotMin  = slots[ri];
      const r        = ri + 2;
      const isHour   = slotMin % 60 === 0;
      const isLast   = ri === slots.length - 1;
      const topB     = isHour ? HOUR : THIN;
      const botB     = isLast ? MED  : THIN;

      // Time column
      const timeAddr = XS.utils.encode_cell({ r, c: 0 });
      if (!ws[timeAddr]) ws[timeAddr] = { t: 's', v: '' };
      ws[timeAddr].s = {
        fill: { fgColor: { rgb: isHour ? 'D5DCE4' : 'F4F6F7' } },
        font: { bold: isHour, sz: isHour ? 9 : 8, color: { rgb: isHour ? '2C3E50' : '888888' }, name: 'Meiryo' },
        alignment: { horizontal: 'center', vertical: 'top' },
        border: mkBorder(MED, topB, MED, botB),
      };

      for (let di = 0; di < dates.length; di++) {
        const date   = dates[di];
        for (let si = 0; si < S; si++) {
          const sport  = sports[si];
          const c      = 1 + di * S + si;
          const addr   = XS.utils.encode_cell({ r, c });
          if (!ws[addr]) ws[addr] = { t: 's', v: '' };

          const leftB  = (si === 0) ? MED  : THIN;
          const rightB = (si === S - 1) ? MED : THIN;

          const covEv  = eventCovering(sport.id, date, slotMin);
          if (covEv) {
            const cat    = catMap[covEv.category];
            const bgHex  = covEv.color || (cat ? cat.color : '#95a5a6');
            const bgRGB  = toRGB(bgHex) || '95A5A6';
            const fgRGB  = fgForBg(bgHex);
            ws[addr].s = {
              fill: { fgColor: { rgb: bgRGB } },
              font: { sz: 8, color: { rgb: fgRGB }, name: 'Meiryo', bold: true },
              alignment: { wrapText: true, vertical: 'top' },
              border: mkBorder(leftB, topB, rightB, botB),
            };
          } else {
            ws[addr].s = {
              fill: { fgColor: { rgb: 'FFFFFF' } },
              font: { sz: 8, color: { rgb: '000000' }, name: 'Meiryo' },
              alignment: { wrapText: false, vertical: 'top' },
              border: mkBorder(leftB, topB, rightB, botB),
            };
          }
        }
      }
    }

    // No merges
    ws['!merges'] = [];

    // Column widths & row heights
    ws['!cols'] = [{ wch: 6 }, ...Array(dates.length * S).fill(null).map(() => ({ wch: 16 }))];
    ws['!rows'] = [
      { hpt: 22 },
      { hpt: 16 },
      ...slots.map(m => ({ hpt: m % 60 === 0 ? 20 : 14 })),
    ];

    const wb = XS.utils.book_new();
    XS.utils.book_append_sheet(wb, ws, 'タイムテーブル');
    XS.writeFile(wb, `timetable_${dr.start}_${dr.end}.xlsx`);
  }

  function exportSelectedSportsToWord(sportIds) {
    const sports = sportIds.map(id => DataManager.getSport(id)).filter(Boolean);
    if (sports.length === 0) { alert('競技を選択してください。'); return; }

    const dr = DataManager.getDateRange();
    let allHtml = '';
    sports.forEach((sport, i) => {
      const start = sport.startDate || dr.start;
      const end   = sport.endDate   || dr.end;
      allHtml += buildWordHTML(sport, DataManager.getDatesInRange(start, end), i > 0);
    });

    const title = sports.length === 1
      ? `${sports[0].name} スケジュール`
      : `スケジュール（${sports.map(s => s.shortName || s.name).join('・')}）`;
    downloadFile(wrapWordHTML(title, allHtml), `schedule_${dr.start}_${dr.end}.doc`, 'application/msword');
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
    <!--
    /* やや狭い: top/bottom=25.4mm(72pt), left/right=19.05mm(54pt) */
    @page Section1 {
      size:595.3pt 841.9pt;
      margin:72.0pt 54.0pt 72.0pt 54.0pt;
      mso-header-margin:36.0pt;
      mso-footer-margin:36.0pt;
      mso-paper-source:0;
    }
    div.Section1 { page:Section1; }
    -->
    body { font-family: 'Meiryo', 'Yu Gothic', sans-serif; font-size: 11pt; margin: 0; padding: 0; }
    table { border-collapse: collapse; width: 100%; }
    thead { display: table-header-group; }
    td, th { border: 1px solid #ccc; }
  </style>
</head>
<body>
<div class="Section1">
  ${bodyHtml}
</div>
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
    floor:     'フロア数(数字)',
    location:  '場所',
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
      [JA_HEADERS.floor]:     r.floor     != null ? r.floor : '',
      [JA_HEADERS.location]:  r.location  || '',
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
      { wch: 10 }, // フロア数
      { wch: 24 }, // 場所
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
      [JA_HEADERS.floor,     '省略可。フロア数（数字のみ）', '3'],
      [JA_HEADERS.location,  '省略可。場所の名称', 'ファンクションルーム「葵」'],
      [JA_HEADERS.note,      '印刷・Word出力に反映される詳細情報', '3階レストランにて。食後エレベーターで客室へ'],
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

  // ── Schedule template: existing events if available, placeholder otherwise ──
  function exportScheduleTemplate() {
    if (typeof XLSX === 'undefined') { alert('XLSXライブラリが必要です。'); return; }
    const wb   = XLSX.utils.book_new();
    const dr   = DataManager.getDateRange();
    const rows = [];

    for (const sport of DataManager.getSports()) {
      const start = sport.startDate || dr.start;
      const end   = sport.endDate   || dr.end;
      const dates = DataManager.getDatesInRange(start, end);

      // Count total existing events for this sport
      const totalEvents = dates.reduce((n, d) => n + DataManager.getEvents(sport.id, d).length, 0);

      if (totalEvents > 0) {
        // Use existing data
        for (const date of dates) {
          for (const ev of DataManager.getEvents(sport.id, date)) {
            rows.push({
              sportId: sport.id, sportName: sport.name, date,
              title: ev.title || '', startTime: ev.startTime || '',
              endTime: ev.endTime || '', category: ev.category || '',
              floor: ev.floor != null ? ev.floor : '',
              location: ev.location || '', note: ev.note || '', color: ev.color || '',
            });
          }
        }
      } else {
        // No data yet – generate placeholder rows
        dates.forEach((date, i) => {
          const isFirst = i === 0, isLast = i === dates.length - 1;
          if (isFirst) rows.push({ sportId: sport.id, sportName: sport.name, date,
            title: 'チェックイン', startTime: '15:00', endTime: '16:00',
            category: 'checkin', floor: '', location: '', note: '', color: '' });
          rows.push({ sportId: sport.id, sportName: sport.name, date,
            title: '朝食', startTime: '07:00', endTime: '08:30',
            category: 'meal', floor: '', location: '', note: '', color: '' });
          rows.push({ sportId: sport.id, sportName: sport.name, date,
            title: '夕食', startTime: '18:00', endTime: '20:00',
            category: 'meal', floor: '', location: '', note: '', color: '' });
          if (isLast) rows.push({ sportId: sport.id, sportName: sport.name, date,
            title: 'チェックアウト', startTime: '10:00', endTime: '11:00',
            category: 'checkin', floor: '', location: '', note: '', color: '' });
        });
      }
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
    const allSports = DataManager.getSports();

    // Determine preselected sports from context
    const preselected = new Set();
    if (sportId) {
      preselected.add(sportId);
    } else if (hotelId) {
      DataManager.getSportsForHotel(hotelId).forEach(s => preselected.add(s.id));
    } else {
      allSports.forEach(s => preselected.add(s.id));
    }

    const checkboxes = allSports.map(sport => {
      const bg      = sport.color ? sport.color + '22' : '#f8f9fa';
      const border  = sport.color || '#ddd';
      const checked = preselected.has(sport.id) ? 'checked' : '';
      return `
        <label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;background:${bg};border:1.5px solid ${border};margin-bottom:4px;">
          <input type="checkbox" name="export-sport" value="${sport.id}" ${checked}
                 style="width:15px;height:15px;cursor:pointer;accent-color:${sport.color || '#2c3e50'};">
          <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${sport.color || '#95a5a6'};flex-shrink:0;"></span>
          <span style="font-size:13px;font-weight:500;">${sport.name}</span>
        </label>`;
    }).join('');

    const html = `
      <div class="modal-overlay" id="export-modal" onclick="if(event.target===this)ExportManager.closeExportModal()">
        <div class="modal" style="max-width:500px;">
          <div class="modal-header">
            <h3>エクスポート</h3>
            <button class="modal-close" onclick="ExportManager.closeExportModal()">×</button>
          </div>
          <div class="modal-body">
            <p style="font-size:13px;font-weight:bold;color:#444;margin-bottom:10px;">① 競技を選択</p>
            <div style="max-height:280px;overflow-y:auto;padding:2px 4px;">
              ${checkboxes}
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button style="font-size:11px;padding:3px 10px;background:none;border:1px solid #bbb;border-radius:4px;cursor:pointer;"
                      onclick="document.querySelectorAll('[name=export-sport]').forEach(c=>c.checked=true)">全選択</button>
              <button style="font-size:11px;padding:3px 10px;background:none;border:1px solid #bbb;border-radius:4px;cursor:pointer;"
                      onclick="document.querySelectorAll('[name=export-sport]').forEach(c=>c.checked=false)">全解除</button>
            </div>
            <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
            <p style="font-size:13px;font-weight:bold;color:#444;margin-bottom:10px;">② 形式を選択</p>
            <div style="display:grid;gap:10px;">
              <button class="btn btn-success" onclick="ExportManager._doExportXLS()" style="font-size:13px;padding:10px;">
                📊 Excelタイムテーブル (.xls)<br>
                <span style="font-size:11px;font-weight:normal;opacity:0.85;">時刻×日付グリッド・複数競技を横並び表示</span>
              </button>
              <button class="btn btn-outline" onclick="ExportManager._doExportWord()" style="font-size:13px;padding:10px;">
                📄 Word行動計画表 (.doc)<br>
                <span style="font-size:11px;font-weight:normal;opacity:0.75;">競技ごとの日程表形式</span>
              </button>
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

  function _getSelectedSportIds() {
    return [...document.querySelectorAll('[name=export-sport]:checked')].map(c => c.value);
  }

  function _doExportXLS() {
    const ids = _getSelectedSportIds();
    if (!ids.length) { alert('競技を選択してください。'); return; }
    closeExportModal();
    exportTimetableXLS(ids);
  }

  function _doExportWord() {
    const ids = _getSelectedSportIds();
    if (!ids.length) { alert('競技を選択してください。'); return; }
    closeExportModal();
    exportSelectedSportsToWord(ids);
  }

  // ── Hotel Rooms Export/Import ─────────────────────────────────────────────
  function _mkRoomId(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  function exportHotelRoomsXLSX(hotelId) {
    if (typeof XLSX === 'undefined') {
      alert('Excelライブラリがロードされていないためエクスポートできません。');
      return;
    }
    const hotel = DataManager.getHotel(hotelId);
    if (!hotel) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: 客室
    const guestRooms = DataManager.getGuestRooms(hotelId);
    const grAoa = [
      ['部屋タイプ', '室数', '平米', '最低階', '最高階', '表示色(#RRGGBB)', '備考'],
      ...guestRooms.map(r => [r.type||'', r.count||'', r.sqm||'', r.floorMin||'', r.floorMax||'', r.color||'', r.note||''])
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(grAoa);
    ws1['!cols'] = [{wch:22},{wch:6},{wch:6},{wch:6},{wch:6},{wch:16},{wch:30}];
    XLSX.utils.book_append_sheet(wb, ws1, '客室');

    // Sheet 2: ファンクションルーム
    const funcRooms = DataManager.getFunctionRooms(hotelId);
    const frAoa = [
      ['部屋名', '階数', '平米', '収容人数', '備考'],
      ...funcRooms.map(r => [r.name||'', r.floor||'', r.sqm||'', r.capacity||'', r.note||''])
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(frAoa);
    ws2['!cols'] = [{wch:22},{wch:6},{wch:6},{wch:10},{wch:30}];
    XLSX.utils.book_append_sheet(wb, ws2, 'ファンクションルーム');

    XLSX.writeFile(wb, `hotel_rooms_${hotel.name}.xlsx`);
  }

  function importHotelRoomsXLSX(hotelId, workbook) {
    const hotel = DataManager.getHotel(hotelId);
    if (!hotel) throw new Error('ホテルが見つかりません');

    const grSheet = workbook.Sheets['客室'];
    if (grSheet) {
      const rows = XLSX.utils.sheet_to_json(grSheet, { defval: '' });
      const rooms = rows
        .map(r => ({
          id: _mkRoomId('gr'),
          type: String(r['部屋タイプ'] || '').trim(),
          count: Number(r['室数']) || 0,
          sqm: Number(r['平米']) || 0,
          floorMin: Number(r['最低階']) || 1,
          floorMax: Number(r['最高階']) || 1,
          color: String(r['表示色(#RRGGBB)'] || r['表示色'] || '').trim(),
          note: String(r['備考'] || '').trim(),
        }))
        .filter(r => r.type);
      DataManager.updateHotel(hotelId, { guestRooms: rooms });
    }

    const frSheet = workbook.Sheets['ファンクションルーム'];
    if (frSheet) {
      const rows = XLSX.utils.sheet_to_json(frSheet, { defval: '' });
      const rooms = rows
        .map(r => ({
          id: _mkRoomId('fr'),
          name: String(r['部屋名'] || '').trim(),
          floor: Number(r['階数']) || 1,
          sqm: Number(r['平米']) || 0,
          capacity: Number(r['収容人数']) || 0,
          note: String(r['備考'] || '').trim(),
        }))
        .filter(r => r.name);
      DataManager.updateHotel(hotelId, { functionRooms: rooms });
    }
    return true;
  }

  return {
    exportSportToExcel, exportAllToExcel, exportHotelToExcel,
    exportSportToWord, exportHotelToWord,
    exportTimetableXLS, exportSelectedSportsToWord,
    downloadJSON,
    exportMasterXLSX, exportSchedulesXLSX, exportSchedulesCSV, exportFullXLSX,
    exportScheduleTemplate,
    exportHotelRoomsXLSX, importHotelRoomsXLSX,
    showExportModal, closeExportModal,
    _doExportXLS, _doExportWord,
  };
})();
