/**
 * data.js - Budget data layer
 *
 * Data model:
 *   Hotel {
 *     id, name, userGroups[], contractStart, contractEnd, note,
 *     roomContracts[]: { id, roomType, plannedRooms, contractRooms,
 *                        budgetRate, contractRate, checkIn, checkOut },
 *     costs[]: { id, category, description,
 *                budgetAmount, contractAmount, actualAmount, note }
 *   }
 *
 * User groups : athletes | technical | family | sponsor | media | wf
 * Cost categories: room | function | meal | compensation | other
 */
const BudgetData = (() => {

  const STORAGE_KEY = 'hotelBudgetApp_v1';
  let db = null;

  // ── Constants ─────────────────────────────────────────────────────────────
  const USER_GROUPS = {
    athletes:  '選手団',
    technical: '技術役員',
    family:    'ファミリー',
    sponsor:   'スポンサー',
    media:     'メディア',
    wf:        'WF',
  };

  const COST_CATEGORIES = {
    room:         { label: '客室料金',            color: '#3498db' },
    function:     { label: 'ファンクションルーム', color: '#9b59b6' },
    meal:         { label: '食費',                color: '#f39c12' },
    compensation: { label: '営業補償費',           color: '#e74c3c' },
    other:        { label: 'その他',              color: '#7f8c8d' },
  };

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    try { db = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(e) {}
    if (!db || !Array.isArray(db.hotels)) {
      db = { version: '1.0', hotels: [] };
      _save();
    }
  }

  function _save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

  function _id(prefix) {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  }

  // ── Hotels ────────────────────────────────────────────────────────────────
  function getHotels() { return db.hotels; }
  function getHotel(id) { return db.hotels.find(h => h.id === id) || null; }

  function addHotel(fields) {
    const h = {
      id: _id('bh'),
      name: '',
      userGroups: [],
      contractStart: '',
      contractEnd: '',
      note: '',
      roomContracts: [],
      costs: [],
      ...fields,
    };
    db.hotels.push(h);
    _save();
    return h;
  }

  function updateHotel(id, fields) {
    const h = getHotel(id);
    if (!h) return;
    Object.assign(h, fields);
    _save();
  }

  function deleteHotel(id) {
    db.hotels = db.hotels.filter(h => h.id !== id);
    _save();
  }

  // ── Room Contracts ────────────────────────────────────────────────────────
  function addRoomContract(hotelId, fields) {
    const h = getHotel(hotelId);
    if (!h) return null;
    const rc = {
      id: _id('rc'),
      roomType: '',
      plannedRooms: 0,
      contractRooms: 0,
      budgetRate: 0,
      contractRate: 0,
      checkIn: '',
      checkOut: '',
      ...fields,
    };
    h.roomContracts.push(rc);
    _save();
    return rc;
  }

  function updateRoomContract(hotelId, rcId, fields) {
    const h = getHotel(hotelId);
    if (!h) return;
    const rc = h.roomContracts.find(r => r.id === rcId);
    if (rc) { Object.assign(rc, fields); _save(); }
  }

  function deleteRoomContract(hotelId, rcId) {
    const h = getHotel(hotelId);
    if (!h) return;
    h.roomContracts = h.roomContracts.filter(r => r.id !== rcId);
    _save();
  }

  // ── Cost Items ────────────────────────────────────────────────────────────
  function addCost(hotelId, fields) {
    const h = getHotel(hotelId);
    if (!h) return null;
    const c = {
      id: _id('c'),
      category: 'room',
      description: '',
      budgetAmount: 0,
      contractAmount: 0,
      actualAmount: 0,
      note: '',
      ...fields,
    };
    h.costs.push(c);
    _save();
    return c;
  }

  function updateCost(hotelId, costId, fields) {
    const h = getHotel(hotelId);
    if (!h) return;
    const c = h.costs.find(c => c.id === costId);
    if (c) { Object.assign(c, fields); _save(); }
  }

  function deleteCost(hotelId, costId) {
    const h = getHotel(hotelId);
    if (!h) return;
    h.costs = h.costs.filter(c => c.id !== costId);
    _save();
  }

  // ── Calculations ──────────────────────────────────────────────────────────
  function calcNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    return Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000));
  }

  function hotelTotals(id) {
    const h = getHotel(id);
    if (!h) return { budget: 0, contract: 0, actual: 0 };
    return h.costs.reduce((a, c) => ({
      budget:   a.budget   + (+c.budgetAmount   || 0),
      contract: a.contract + (+c.contractAmount || 0),
      actual:   a.actual   + (+c.actualAmount   || 0),
    }), { budget: 0, contract: 0, actual: 0 });
  }

  function grandTotals() {
    return db.hotels.reduce((a, h) => {
      const t = hotelTotals(h.id);
      return { budget: a.budget + t.budget, contract: a.contract + t.contract, actual: a.actual + t.actual };
    }, { budget: 0, contract: 0, actual: 0 });
  }

  function categoryTotals() {
    const r = {};
    db.hotels.forEach(h => h.costs.forEach(c => {
      if (!r[c.category]) r[c.category] = { budget: 0, contract: 0, actual: 0 };
      r[c.category].budget   += +c.budgetAmount   || 0;
      r[c.category].contract += +c.contractAmount || 0;
      r[c.category].actual   += +c.actualAmount   || 0;
    }));
    return r;
  }

  function userGroupTotals() {
    const r = {};
    db.hotels.forEach(h => {
      const groups = h.userGroups || [];
      if (!groups.length) return;
      const t = hotelTotals(h.id);
      const share = 1 / groups.length;
      groups.forEach(g => {
        if (!r[g]) r[g] = { budget: 0, contract: 0, actual: 0 };
        r[g].budget   += t.budget   * share;
        r[g].contract += t.contract * share;
        r[g].actual   += t.actual   * share;
      });
    });
    return r;
  }

  function roomContractTotals(hotelId) {
    const h = getHotel(hotelId);
    if (!h) return { budget: 0, contract: 0 };
    return h.roomContracts.reduce((a, rc) => {
      const n = calcNights(rc.checkIn, rc.checkOut);
      return {
        budget:   a.budget   + (+rc.plannedRooms  || 0) * n * (+rc.budgetRate   || 0),
        contract: a.contract + (+rc.contractRooms || 0) * n * (+rc.contractRate || 0),
      };
    }, { budget: 0, contract: 0 });
  }

  // ── Import / Export ───────────────────────────────────────────────────────
  function exportJSON() { return JSON.stringify(db, null, 2); }

  function importJSON(text) {
    const p = JSON.parse(text);
    if (!Array.isArray(p.hotels)) throw new Error('不正なデータ形式です');
    db = p;
    _save();
  }

  return {
    USER_GROUPS, COST_CATEGORIES,
    init,
    getHotels, getHotel, addHotel, updateHotel, deleteHotel,
    addRoomContract, updateRoomContract, deleteRoomContract,
    addCost, updateCost, deleteCost,
    calcNights,
    hotelTotals, grandTotals, categoryTotals, userGroupTotals, roomContractTotals,
    exportJSON, importJSON,
  };
})();
