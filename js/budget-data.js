/**
 * budget-data.js - Budget data layer
 * Manages budget hotels, room contracts, and cost items in localStorage.
 */
const BudgetData = (() => {
  const KEY = 'hotelBudgetApp_v1';
  let db = null;

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch(e) {}
    if (!db || !Array.isArray(db.hotels)) {
      db = { version: '1.0', hotels: [] };
      _save();
    }
  }

  function _save() { localStorage.setItem(KEY, JSON.stringify(db)); }

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
      masterHotelId: '',   // optional link to master hotel
      userGroups: [],      // 選手団|技術役員|ファミリー|スポンサー|メディア|WF
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
  // Each entry represents one room type contracted with the hotel.
  function addRoomContract(hotelId, fields) {
    const h = getHotel(hotelId);
    if (!h) return null;
    const rc = {
      id: _id('rc'),
      roomType: '',       // 客室タイプ名 e.g. シングル/ツイン/スイート
      plannedRooms: 0,    // 計画室数
      contractRooms: 0,   // 契約室数
      budgetRate: 0,      // 予算単価（円/室/泊）
      contractRate: 0,    // 契約単価（円/室/泊）
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
  // One row per cost item; each has budget / contract / actual amounts.
  function addCost(hotelId, fields) {
    const h = getHotel(hotelId);
    if (!h) return null;
    const c = {
      id: _id('c'),
      category: 'other',    // room|function|meal|compensation|other
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

  // ── Aggregations ──────────────────────────────────────────────────────────
  function hotelTotals(id) {
    const h = getHotel(id);
    if (!h) return { budget: 0, contract: 0, actual: 0 };
    return h.costs.reduce((acc, c) => ({
      budget:   acc.budget   + (+c.budgetAmount   || 0),
      contract: acc.contract + (+c.contractAmount || 0),
      actual:   acc.actual   + (+c.actualAmount   || 0),
    }), { budget: 0, contract: 0, actual: 0 });
  }

  function grandTotals() {
    return db.hotels.reduce((acc, h) => {
      const t = hotelTotals(h.id);
      return {
        budget:   acc.budget   + t.budget,
        contract: acc.contract + t.contract,
        actual:   acc.actual   + t.actual,
      };
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
    // Each hotel can serve multiple groups; attribute costs equally to each group
    const r = {};
    db.hotels.forEach(h => {
      const groups = h.userGroups || [];
      if (groups.length === 0) return;
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

  // ── Room Contract Helpers ─────────────────────────────────────────────────
  function calcNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    return Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000));
  }

  function roomContractTotals(hotelId) {
    const h = getHotel(hotelId);
    if (!h) return { budget: 0, contract: 0 };
    return h.roomContracts.reduce((acc, rc) => {
      const n = calcNights(rc.checkIn, rc.checkOut);
      return {
        budget:   acc.budget   + (+rc.plannedRooms  || 0) * n * (+rc.budgetRate   || 0),
        contract: acc.contract + (+rc.contractRooms || 0) * n * (+rc.contractRate || 0),
      };
    }, { budget: 0, contract: 0 });
  }

  // ── Export / Import ───────────────────────────────────────────────────────
  function exportJSON() { return JSON.stringify(db, null, 2); }

  function importJSON(text) {
    const p = JSON.parse(text);
    if (!Array.isArray(p.hotels)) throw new Error('不正なデータ形式です');
    db = p;
    _save();
  }

  return {
    init,
    getHotels, getHotel, addHotel, updateHotel, deleteHotel,
    addRoomContract, updateRoomContract, deleteRoomContract,
    addCost, updateCost, deleteCost,
    hotelTotals, grandTotals, categoryTotals, userGroupTotals,
    calcNights, roomContractTotals,
    exportJSON, importJSON,
  };
})();
