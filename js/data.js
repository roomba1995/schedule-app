/**
 * data.js - Data management module
 * Handles loading, saving, importing, and exporting all application data.
 */
const DataManager = (() => {
  const STORAGE_KEY = 'hotelScheduleApp_v1';
  const SCHEDULE_KEY = 'hotelScheduleApp_schedules_v1';
  const TEMPLATE_KEY = 'hotelScheduleApp_templates_v1';

  let master = null;   // Master data: sports, hotels, venues, etc.
  let schedules = {};  // { "sportId|date": [ eventObj, ... ] }
  let templates = [];  // [ { id, name, events, createdAt } ]

  // EMBEDDED_MASTER は js/master-data.js で定義（先に読み込まれる）

  // ── Initialise ─────────────────────────────────────────────────────────
  async function init() {
    // Try loading master from localStorage first
    const savedMaster = localStorage.getItem(STORAGE_KEY);
    if (savedMaster) {
      try { master = JSON.parse(savedMaster); } catch(e) { master = null; }
    }

    // If no saved master, use the embedded default data
    if (!master) {
      master = JSON.parse(JSON.stringify(EMBEDDED_MASTER));
      _saveMaster();
    }

    // Load schedules
    const savedSched = localStorage.getItem(SCHEDULE_KEY);
    if (savedSched) {
      try { schedules = JSON.parse(savedSched); } catch(e) { schedules = {}; }
    }

    // Load templates
    const savedTmpl = localStorage.getItem(TEMPLATE_KEY);
    if (savedTmpl) {
      try { templates = JSON.parse(savedTmpl); } catch(e) { templates = []; }
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────
  function _saveMaster() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(master));
  }

  function _saveSchedules() {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedules));
  }

  function _saveTemplates() {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
  }

  function _schedKey(sportId, date) {
    return `${sportId}|${date}`;
  }

  function _genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ── Master data accessors ──────────────────────────────────────────────
  function getMaster() { return master; }

  function getSports() { return master.sports || []; }
  function getSport(id) { return (master.sports || []).find(s => s.id === id); }

  function getHotels() { return master.hotels || []; }
  function getHotel(id) { return (master.hotels || []).find(h => h.id === id); }

  function getVenues() { return master.venues || []; }
  function getVenue(id) { return (master.venues || []).find(v => v.id === id); }

  function getCategories() { return master.eventCategories || []; }
  function getCategory(id) { return getCategories().find(c => c.id === id); }

  function getDateRange() {
    return master.dateRange || { start: '2026-09-10', end: '2026-10-07' };
  }

  // Hotels that serve a specific sport
  function getHotelsForSport(sportId) {
    const sport = getSport(sportId);
    if (!sport) return [];
    if (sport.isSoccer) {
      // For soccer, hotels come from venue assignments
      const venueHotelIds = (sport.venueIds || [])
        .map(vid => getVenue(vid))
        .filter(Boolean)
        .map(v => v.hotelId)
        .filter(Boolean);
      const unique = [...new Set(venueHotelIds)];
      return unique.map(hid => getHotel(hid)).filter(Boolean);
    }
    return (sport.hotelIds || []).map(hid => getHotel(hid)).filter(Boolean);
  }

  // Sports assigned to a hotel
  function getSportsForHotel(hotelId) {
    return (master.sports || []).filter(s => {
      if (s.isSoccer) {
        return (s.venueIds || []).some(vid => {
          const v = getVenue(vid);
          return v && v.hotelId === hotelId;
        });
      }
      return (s.hotelIds || []).includes(hotelId);
    });
  }

  // ── Master data mutators ───────────────────────────────────────────────
  function updateSport(sportId, fields) {
    const idx = (master.sports || []).findIndex(s => s.id === sportId);
    if (idx < 0) return false;
    master.sports[idx] = { ...master.sports[idx], ...fields };
    _saveMaster();
    return true;
  }

  function updateHotel(hotelId, fields) {
    const idx = (master.hotels || []).findIndex(h => h.id === hotelId);
    if (idx < 0) return false;
    master.hotels[idx] = { ...master.hotels[idx], ...fields };
    _saveMaster();
    return true;
  }

  function updateVenue(venueId, fields) {
    const idx = (master.venues || []).findIndex(v => v.id === venueId);
    if (idx < 0) return false;
    master.venues[idx] = { ...master.venues[idx], ...fields };
    _saveMaster();
    return true;
  }

  // Soccer groups & matches
  function getSoccerGroups() { return master.soccerGroups || []; }
  function getSoccerMatches() { return master.soccerMatches || []; }

  function saveSoccerGroups(groups) {
    master.soccerGroups = groups;
    _saveMaster();
  }

  function saveSoccerMatches(matches) {
    master.soccerMatches = matches;
    _saveMaster();
  }

  // ── Schedule data ──────────────────────────────────────────────────────
  function getEvents(sportId, date) {
    return schedules[_schedKey(sportId, date)] || [];
  }

  function getAllEventsForSport(sportId) {
    const result = {};
    for (const key of Object.keys(schedules)) {
      if (key.startsWith(sportId + '|')) {
        const date = key.split('|')[1];
        result[date] = schedules[key];
      }
    }
    return result;
  }

  function saveEvent(sportId, date, event) {
    const key = _schedKey(sportId, date);
    if (!schedules[key]) schedules[key] = [];

    if (!event.id) {
      // New event
      event.id = _genId();
      schedules[key].push(event);
    } else {
      // Update existing
      const idx = schedules[key].findIndex(e => e.id === event.id);
      if (idx >= 0) schedules[key][idx] = event;
      else schedules[key].push(event);
    }

    // Sort by startTime
    schedules[key].sort((a, b) => a.startTime.localeCompare(b.startTime));
    _saveSchedules();
    return event;
  }

  function deleteEvent(sportId, date, eventId) {
    const key = _schedKey(sportId, date);
    if (!schedules[key]) return false;
    const idx = schedules[key].findIndex(e => e.id === eventId);
    if (idx < 0) return false;
    schedules[key].splice(idx, 1);
    _saveSchedules();
    return true;
  }

  function copyDayEvents(sportId, fromDate, toDate) {
    const src = getEvents(sportId, fromDate);
    const key = _schedKey(sportId, toDate);
    schedules[key] = src.map(e => ({ ...e, id: _genId() }));
    _saveSchedules();
  }

  function clearDayEvents(sportId, date) {
    const key = _schedKey(sportId, date);
    schedules[key] = [];
    _saveSchedules();
  }

  // ── Templates ──────────────────────────────────────────────────────────
  function getTemplates() { return templates; }

  function saveTemplate(name, events) {
    const tmpl = {
      id: _genId(),
      name,
      events: events.map(e => {
        const { id, ...rest } = e;
        return rest;
      }),
      createdAt: new Date().toISOString()
    };
    templates.push(tmpl);
    _saveTemplates();
    return tmpl;
  }

  function applyTemplate(templateId, sportId, date) {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return false;
    const key = _schedKey(sportId, date);
    const newEvents = tmpl.events.map(e => ({ ...e, id: _genId() }));
    schedules[key] = [...(schedules[key] || []), ...newEvents];
    schedules[key].sort((a, b) => a.startTime.localeCompare(b.startTime));
    _saveSchedules();
    return true;
  }

  function deleteTemplate(templateId) {
    const idx = templates.findIndex(t => t.id === templateId);
    if (idx < 0) return false;
    templates.splice(idx, 1);
    _saveTemplates();
    return true;
  }

  function renameTemplate(templateId, newName) {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return false;
    tmpl.name = newName;
    _saveTemplates();
    return true;
  }

  // ── Import / Export ────────────────────────────────────────────────────
  function importMasterJSON(jsonText) {
    const parsed = JSON.parse(jsonText);
    // Basic validation
    if (!parsed.sports && !parsed.hotels && !parsed.venues) {
      throw new Error('無効なマスターデータです');
    }
    master = { ...master, ...parsed };
    _saveMaster();
    return master;
  }

  function exportMasterJSON() {
    return JSON.stringify(master, null, 2);
  }

  function importSchedulesJSON(jsonText) {
    const parsed = JSON.parse(jsonText);
    if (typeof parsed !== 'object') throw new Error('無効なスケジュールデータです');
    schedules = parsed;
    _saveSchedules();
    return schedules;
  }

  function exportSchedulesJSON() {
    return JSON.stringify(schedules, null, 2);
  }

  function exportFullJSON() {
    return JSON.stringify({ master, schedules, templates }, null, 2);
  }

  function importFullJSON(jsonText) {
    const parsed = JSON.parse(jsonText);
    if (parsed.master) { master = parsed.master; _saveMaster(); }
    if (parsed.schedules) { schedules = parsed.schedules; _saveSchedules(); }
    if (parsed.templates) { templates = parsed.templates; _saveTemplates(); }
    return true;
  }

  // ── XLSX / CSV Import ──────────────────────────────────────────────────
  function _excelDateToString(v) {
    if (typeof v !== 'number') return String(v || '');
    // Excelのシリアル日付をYYYY-MM-DD文字列に変換
    // ExcelエポックはUNIXエポック(1970-01-01)より25569日前
    const date = new Date((v - 25569) * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }

  function importMasterXLSX(workbook) {
    const readSheet = (name) => {
      const ws = workbook.Sheets[name];
      if (!ws) return [];
      return XLSX.utils.sheet_to_json(ws, { defval: '' });
    };

    const sports = readSheet('競技').map(r => ({
      id: String(r.id),
      name: r.name,
      shortName: r.shortName || '',
      color: r.color || '',
      startDate: _excelDateToString(r.startDate),
      endDate: _excelDateToString(r.endDate),
      hotelIds: r.hotelIds ? String(r.hotelIds).split(';').filter(Boolean) : [],
      venueIds: r.venueIds ? String(r.venueIds).split(';').filter(Boolean) : [],
      isSoccer: Number(r.isSoccer) === 1,
    }));

    const hotels = readSheet('ホテル').map(r => ({
      id: String(r.id), name: r.name, shortName: r.shortName || '',
      color: r.color || '', address: r.address || '',
    }));

    const venues = readSheet('会場').map(r => ({
      id: String(r.id), name: r.name, hotelId: String(r.hotelId || ''), city: r.city || '',
    }));

    const eventCategories = readSheet('イベント種別').map(r => ({
      id: String(r.id), name: r.name, color: r.color || '',
    }));

    if (sports.length === 0 && hotels.length === 0 && venues.length === 0) {
      throw new Error('有効なマスターデータが見つかりません（シート名: 競技・ホテル・会場）');
    }

    master = {
      ...master,
      sports: sports.length ? sports : master.sports,
      hotels: hotels.length ? hotels : master.hotels,
      venues: venues.length ? venues : master.venues,
      eventCategories: eventCategories.length ? eventCategories : master.eventCategories,
    };
    _saveMaster();
    return master;
  }

  function _importScheduleRows(rows) {
    const newSchedules = {};
    for (const r of rows) {
      if (!r.sportId || !r.date) continue;
      const key = `${r.sportId}|${r.date}`;
      if (!newSchedules[key]) newSchedules[key] = [];
      newSchedules[key].push({
        id: r.id || _genId(),
        title: r.title || '',
        startTime: r.startTime || '09:00',
        endTime: r.endTime || '10:00',
        category: r.category || '',
        note: r.note || '',
        color: r.color || '',
      });
    }
    for (const key of Object.keys(newSchedules)) {
      newSchedules[key].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    schedules = newSchedules;
    _saveSchedules();
    return schedules;
  }

  function importSchedulesXLSX(workbook) {
    const ws = workbook.Sheets['スケジュール'];
    if (!ws) throw new Error('"スケジュール"シートが見つかりません');
    return _importScheduleRows(XLSX.utils.sheet_to_json(ws, { defval: '' }));
  }

  function importSchedulesCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) throw new Error('データが空です');
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    const rows = lines.slice(1).map(line => {
      const vals = [];
      let inQuote = false, cur = '';
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuote = !inQuote; }
        else if (ch === ',' && !inQuote) { vals.push(cur); cur = ''; }
        else { cur += ch; }
      }
      vals.push(cur);
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
    });
    return _importScheduleRows(rows);
  }

  function importFullXLSX(workbook) {
    try { importMasterXLSX(workbook); } catch(e) { /* no master sheets – skip */ }
    if (workbook.Sheets['スケジュール']) importSchedulesXLSX(workbook);
    const ws = workbook.Sheets['テンプレート'];
    if (ws) {
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      templates = rows.map(r => ({
        id: r.id || _genId(),
        name: r.name || '',
        createdAt: r.createdAt || new Date().toISOString(),
        events: (() => { try { return JSON.parse(r.events || '[]'); } catch(e) { return []; } })(),
      }));
      _saveTemplates();
    }
    return true;
  }

  function clearAllData() {
    schedules = {};
    templates = [];
    _saveSchedules();
    _saveTemplates();
  }

  // ── Date utilities ─────────────────────────────────────────────────────
  function getDatesInRange(startDate, endDate) {
    const dates = [];
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '未設定';
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const wd = weekdays[d.getDay()];
    return `${month}/${day}(${wd})`;
  }

  function formatDateFull(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
  }

  function getWeekday(dateStr) {
    const d = new Date(dateStr);
    return d.getDay(); // 0=Sun,6=Sat
  }

  return {
    init,
    getMaster, getSports, getSport, getHotels, getHotel,
    getVenues, getVenue, getCategories, getCategory,
    getDateRange, getHotelsForSport, getSportsForHotel,
    updateSport, updateHotel, updateVenue,
    getSoccerGroups, getSoccerMatches, saveSoccerGroups, saveSoccerMatches,
    getEvents, getAllEventsForSport,
    saveEvent, deleteEvent, copyDayEvents, clearDayEvents,
    getTemplates, saveTemplate, applyTemplate, deleteTemplate, renameTemplate,
    importMasterJSON, exportMasterJSON,
    importSchedulesJSON, exportSchedulesJSON,
    exportFullJSON, importFullJSON,
    importMasterXLSX, importSchedulesXLSX, importSchedulesCSV, importFullXLSX,
    clearAllData,
    getDatesInRange, formatDate, formatDateFull, getWeekday,
  };
})();
