/**
 * combined-grid.js – Interactive multi-sport schedule grid for the hotel combined view.
 * Supports drag/drop (including cross-sport), resize, copy/paste, and full event CRUD.
 */
const CombinedGrid = (() => {
  // ── Constants ────────────────────────────────────────────────────────────
  const SLOT_HEIGHT = 40;
  const COL_W       = 120;
  const TIME_W      = 60;
  const START_HOUR  = 6;
  const END_HOUR    = 24;

  // ── State ─────────────────────────────────────────────────────────────────
  let _hotelId        = null;
  let _sports         = [];
  let _visibleIds     = [];
  let _container      = null;
  let _clipboard      = null;   // { events, fromSportId, fromDate }
  let _selectedEvents = [];     // [{ id, sportId, date }]
  let _targetSportId  = null;
  let _targetDate     = null;
  let _drag           = null;
  let _resize         = null;
  let _kbListenerAttached = false;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function tMin(t)      { const [h,m] = t.split(':').map(Number); return h*60+m; }
  function minToTime(m) { return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; }
  function evTop(s)     { return ((s - START_HOUR*60) / 30) * SLOT_HEIGHT; }
  function evHt(s, e)   { return Math.max(((e-s)/30)*SLOT_HEIGHT, 20); }
  function gridH()      { return (END_HOUR - START_HOUR) * 2 * SLOT_HEIGHT; }
  function getSport(id) { return _sports.find(s => s.id === id); }

  // ── Date groups ───────────────────────────────────────────────────────────
  function buildDateGroups() {
    const dr = DataManager.getDateRange();
    const allDates = DataManager.getDatesInRange(dr.start, dr.end);
    const vis = _sports.filter(s => _visibleIds.includes(s.id));
    return allDates.map(date => {
      const staying = vis.filter(s => {
        const s0 = s.startDate || dr.start;
        const s1 = s.endDate   || dr.end;
        return date >= s0 && date <= s1;
      });
      return { date, staying };
    }).filter(g => g.staying.length > 0);
  }

  // ── Public init ───────────────────────────────────────────────────────────
  function init(containerId, hotelId, sports, visibleIds) {
    _hotelId    = hotelId;
    _sports     = sports;
    _visibleIds = visibleIds || sports.map(s => s.id);
    _container  = document.getElementById(containerId);
    if (!_container) return;
    // Reset state when re-initializing for a different hotel
    _clipboard      = null;
    _selectedEvents = [];
    _targetSportId  = null;
    _targetDate     = null;
    render();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    if (!_container) return;

    const catMap = {};
    DataManager.getCategories().forEach(c => { catMap[c.id] = c; });

    const dateGroups = buildDateGroups();
    if (dateGroups.length === 0) {
      _container.innerHTML = '<p class="text-muted text-center" style="padding:20px">表示する競技を選択してください</p>';
      return;
    }

    const gh = gridH();
    const GROUP_BORDER = '2px solid #888';
    const THIN_BORDER  = '1px solid rgba(255,255,255,0.3)';

    // Toolbar (show clipboard banner if active)
    const sp = _clipboard ? getSport(_clipboard.fromSportId) : null;
    const toolbar = `
      <div class="schedule-toolbar">
        ${_clipboard ? `
          <div style="margin-left:auto;display:flex;align-items:center;gap:8px;background:#eaf4fb;border:1px solid #aed6f1;padding:4px 12px;border-radius:20px;font-size:12px;">
            <span>📋 ${DataManager.formatDate(_clipboard.fromDate)}
              ${sp ? `<span class="tag" style="background:${sp.color};font-size:10px;padding:1px 6px;margin-left:4px;">${sp.shortName||sp.name}</span>` : ''}
              のイベントをコピー中 (${_clipboard.events.length}件)
            </span>
            <button class="btn btn-xs btn-outline" onclick="CombinedGrid.clearClipboard()">クリア</button>
          </div>
        ` : ''}
      </div>`;

    const kbHint = `<div class="kb-hint">選択: クリック ／ 複数選択: Ctrl+クリック ／ コピー: Ctrl+C ／ 削除: Delete ／ 空白クリック: コピー中はペースト・それ以外はイベント追加 ／ ドラッグ: 移動 ／ Ctrl+Shift+ドラッグ: コピー ／ 選択解除: Esc</div>`;

    // Time labels
    let timeLabels = '';
    for (let h = START_HOUR; h < END_HOUR; h++) {
      timeLabels += `<div class="time-slot-label hour">${String(h).padStart(2,'0')}:00</div>`;
      timeLabels += `<div class="time-slot-label"></div>`;
    }

    let dateRow = '', sportRow = '', bodyGroups = '';
    let totalCols = 0;

    dateGroups.forEach(({ date, staying }) => {
      const wd    = DataManager.getWeekday(date);
      const lbl   = DataManager.formatDate(date);
      const wkCls = wd === 0 ? 'weekend' : wd === 6 ? 'saturday' : '';
      const spanW = staying.length * COL_W;
      totalCols  += staying.length;

      // Row 1: date spanning header
      dateRow += `<div class="combined-date-cell ${wkCls}" style="width:${spanW}px;min-width:${spanW}px;border-right:${GROUP_BORDER};">${lbl}</div>`;

      // Row 2: sport name cells
      staying.forEach((sport, si) => {
        const isLast = si === staying.length - 1;
        sportRow += `<div class="combined-sport-cell"
          style="width:${COL_W}px;min-width:${COL_W}px;background:${sport.color};border-right:${isLast ? GROUP_BORDER : THIN_BORDER};">${sport.shortName||sport.name}</div>`;
      });

      // Body: one column per sport
      let sportCols = staying.map((sport, si) => {
        const isLast     = si === staying.length - 1;
        const isPasteTarget = _clipboard && _targetSportId === sport.id && _targetDate === date;

        // Slot cells
        let cellSlots = '';
        for (let h = START_HOUR; h < END_HOUR; h++) {
          for (const mm of [0, 30]) {
            const t = minToTime(h*60+mm);
            const cls = mm === 0 ? 'hour-boundary' : '';
            cellSlots += `<div class="time-slot-cell ${cls}"
              onclick="CombinedGrid.handleSlotClick('${sport.id}','${date}','${t}')"
              data-sport="${sport.id}" data-date="${date}"></div>`;
          }
        }

        // Events
        const events = DataManager.getEvents(sport.id, date);
        const blocks = events.map(ev => renderEventBlock(ev, sport.id, date, catMap)).join('');

        return `<div class="date-column${isPasteTarget ? ' paste-target' : ''}"
          data-sport="${sport.id}" data-date="${date}"
          style="width:${COL_W}px;min-width:${COL_W}px;height:${gh}px;border-right:${isLast ? GROUP_BORDER : '1px solid var(--border)'};"
          >${cellSlots}${blocks}</div>`;
      }).join('');

      bodyGroups += `<div class="combined-date-group">${sportCols}</div>`;
    });

    const totalWidth = TIME_W + totalCols * COL_W;

    const savedScrollLeft = (() => {
      const w = _container.querySelector('.schedule-wrapper');
      return w ? w.scrollLeft : 0;
    })();

    _container.innerHTML = `
      ${toolbar}
      ${kbHint}
      <div class="scroll-mirror-top"><div style="width:${totalWidth}px;height:1px"></div></div>
      <div class="schedule-wrapper">
        <div class="schedule-container">
          <div class="combined-header-wrap">
            <div class="combined-header-row">
              <div style="width:${TIME_W}px;min-width:${TIME_W}px;flex-shrink:0;background:#f8f9fa;border-right:1px solid var(--border);"></div>
              ${dateRow}
            </div>
            <div class="combined-header-row">
              <div style="width:${TIME_W}px;min-width:${TIME_W}px;flex-shrink:0;background:#f8f9fa;border-right:1px solid var(--border);"></div>
              ${sportRow}
            </div>
          </div>
          <div class="schedule-body">
            <div class="time-col-body" style="width:${TIME_W}px;min-width:${TIME_W}px;">${timeLabels}</div>
            <div class="schedule-grid" id="cg-body-${_hotelId}">${bodyGroups}</div>
          </div>
        </div>
      </div>`;

    // Restore + sync scroll
    const wrapper = _container.querySelector('.schedule-wrapper');
    const mirror  = _container.querySelector('.scroll-mirror-top');
    if (wrapper && savedScrollLeft) wrapper.scrollLeft = savedScrollLeft;
    if (wrapper && mirror) {
      let syncing = false;
      mirror.addEventListener('scroll', () => { if (syncing) return; syncing=true; wrapper.scrollLeft=mirror.scrollLeft; syncing=false; });
      wrapper.addEventListener('scroll', () => { if (syncing) return; syncing=true; mirror.scrollLeft=wrapper.scrollLeft; syncing=false; });
    }

    _initInteraction();
    _attachKeyboardListener();
  }

  // ── Event block HTML ──────────────────────────────────────────────────────
  function renderEventBlock(ev, sportId, date, catMap) {
    const cat    = catMap[ev.category];
    const bg     = (cat && cat.color) ? cat.color : '#95a5a6';
    const sMin   = tMin(ev.startTime);
    const eMin   = tMin(ev.endTime);
    const isSel  = _selectedEvents.some(s => s.id === ev.id && s.sportId === sportId && s.date === date);
    const safe   = (ev.title||'').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    const sub    = [ev.floor ? `${ev.floor}F` : '', ev.location||''].filter(Boolean).join(' ');
    return `<div class="event-block${isSel ? ' event-selected' : ''}"
      style="top:${evTop(sMin)}px;height:${evHt(sMin,eMin)}px;background:${bg};cursor:grab;"
      data-event-id="${ev.id}" data-sport="${sportId}" data-date="${date}"
      ondblclick="event.stopPropagation();CombinedGrid.showEventModal('${ev.id}','${sportId}','${date}')"
      title="${safe}">
      <div class="event-time">${ev.startTime}–${ev.endTime}</div>
      <div class="event-title">${ev.title||''}${sub ? `<span style="opacity:.85;"> · ${sub}</span>` : ''}</div>
      <div class="event-resize-handle" data-resize="bottom"></div>
    </div>`;
  }

  // ── Slot click (paste or open add modal) ─────────────────────────────────
  function handleSlotClick(sportId, date, time) {
    if (_clipboard) {
      _targetSportId = sportId;
      _targetDate    = date;
      _pasteToTarget();
    } else {
      showEventModal(null, sportId, date, time);
    }
  }

  // ── Interaction setup ─────────────────────────────────────────────────────
  function _initInteraction() {
    const grid = _container && _container.querySelector(`#cg-body-${_hotelId}`);
    if (!grid) return;
    grid.addEventListener('mousedown', _onGridMouseDown);

    // Click on column background → set paste target, deselect
    _container.querySelectorAll('.date-column').forEach(col => {
      col.addEventListener('click', e => {
        if (e.target.closest('.event-block')) return;
        const si = col.dataset.sport, di = col.dataset.date;
        if (si && di) { _targetSportId = si; _targetDate = di; }
        if (!e.ctrlKey && !e.metaKey) { _selectedEvents = []; _updateHighlight(); }
      });
    });
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  function _onResizeMove(e) {
    if (!_resize) return;
    const grid = _container && _container.querySelector(`#cg-body-${_hotelId}`);
    const col  = grid && grid.querySelector(`.date-column[data-sport="${_resize.sportId}"][data-date="${_resize.date}"]`);
    if (!col) return;
    const relY    = e.clientY - col.getBoundingClientRect().top;
    const newEnd  = Math.max(_resize.startMins+15, Math.min(START_HOUR*60 + Math.round(relY/(SLOT_HEIGHT/2))*15, END_HOUR*60));
    _resize.targetEndMins = newEnd;
    _resize.moved = true;
    _resize.block.style.height = evHt(_resize.startMins, newEnd) + 'px';
    const te = _resize.block.querySelector('.event-time');
    if (te) te.textContent = `${_resize.ev.startTime}–${minToTime(newEnd)}`;
  }

  function _onResizeUp() {
    document.removeEventListener('mousemove', _onResizeMove);
    document.removeEventListener('mouseup',   _onResizeUp);
    if (!_resize) return;
    const { eventId, sportId, date, ev, moved, targetEndMins } = _resize;
    _resize = null;
    if (!moved || targetEndMins === tMin(ev.endTime)) return;
    DataManager.saveEvent(sportId, date, { ...ev, endTime: minToTime(targetEndMins) });
    render();
  }

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  function _onGridMouseDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest('.event-note-popup')) return;

    // Resize handle
    const rh = e.target.closest('[data-resize]');
    if (rh) {
      const block   = rh.closest('.event-block');
      if (!block) return;
      const eventId = block.dataset.eventId;
      const sportId = block.dataset.sport;
      const date    = block.dataset.date;
      const ev      = eventId && DataManager.getEvents(sportId, date).find(x => x.id === eventId);
      if (!ev) return;
      e.preventDefault(); e.stopPropagation();
      _resize = { eventId, sportId, date, ev, block, startMins: tMin(ev.startTime), targetEndMins: tMin(ev.endTime), moved: false };
      document.addEventListener('mousemove', _onResizeMove);
      document.addEventListener('mouseup',   _onResizeUp);
      return;
    }

    const block = e.target.closest('.event-block');
    if (!block) return;
    const eventId = block.dataset.eventId;
    const sportId = block.dataset.sport;
    const date    = block.dataset.date;
    const ev      = eventId && DataManager.getEvents(sportId, date).find(x => x.id === eventId);
    if (!ev) return;
    e.preventDefault();

    const br = block.getBoundingClientRect();
    _drag = {
      eventId, sportId, date, ev,
      durMins:       tMin(ev.endTime) - tMin(ev.startTime),
      offsetPx:      e.clientY - br.top,
      origBlock:     block,
      ghost:         null,
      moved:         false,
      initX:         e.clientX,
      initY:         e.clientY,
      targetSportId: sportId,
      targetDate:    date,
      targetMins:    tMin(ev.startTime),
      copyMode:      e.ctrlKey && e.shiftKey,
    };
    document.addEventListener('mousemove', _onDragMove);
    document.addEventListener('mouseup',   _onDragUp);
  }

  function _onDragMove(e) {
    if (!_drag) return;
    const dx = e.clientX - _drag.initX, dy = e.clientY - _drag.initY;
    if (!_drag.moved) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      _drag.moved = true;
      const br = _drag.origBlock.getBoundingClientRect();
      const ghost = _drag.origBlock.cloneNode(true);
      ghost.style.cssText = `position:fixed;pointer-events:none;z-index:9999;width:${br.width}px;height:${br.height}px;opacity:0.8;cursor:${_drag.copyMode?'copy':'grabbing'};box-shadow:0 6px 20px rgba(0,0,0,.35);border-radius:6px;transition:none;`;
      document.body.appendChild(ghost);
      _drag.ghost = ghost;
      if (!_drag.copyMode) _drag.origBlock.classList.add('event-dragging');
    }
    _drag.ghost.style.top  = (e.clientY - _drag.offsetPx) + 'px';
    _drag.ghost.style.left = (e.clientX - _drag.ghost.offsetWidth/2) + 'px';

    const grid = _container && _container.querySelector(`#cg-body-${_hotelId}`);
    if (!grid) return;
    grid.querySelectorAll('.date-column').forEach(c => c.classList.remove('drag-over'));
    const el  = document.elementFromPoint(e.clientX, e.clientY);
    const col = el && el.closest('.date-column');
    if (col && col.dataset.sport && col.dataset.date) {
      col.classList.add('drag-over');
      _drag.targetSportId = col.dataset.sport;
      _drag.targetDate    = col.dataset.date;
      const relY = e.clientY - col.getBoundingClientRect().top - _drag.offsetPx;
      const slot = Math.round(relY / (SLOT_HEIGHT/2));
      const mins = START_HOUR*60 + Math.max(0, slot) * 15;
      _drag.targetMins = Math.max(START_HOUR*60, Math.min(mins, END_HOUR*60 - _drag.durMins));
    }
  }

  function _onDragUp(e) {
    document.removeEventListener('mousemove', _onDragMove);
    document.removeEventListener('mouseup',   _onDragUp);
    if (!_drag) return;
    const { eventId, sportId: origSport, date: origDate, ev, durMins,
            ghost, origBlock, moved, targetSportId, targetDate, targetMins, copyMode } = _drag;
    _drag = null;
    if (ghost) ghost.remove();
    origBlock.classList.remove('event-dragging');
    const grid = _container && _container.querySelector(`#cg-body-${_hotelId}`);
    if (grid) grid.querySelectorAll('.date-column').forEach(c => c.classList.remove('drag-over'));

    if (!moved) { _handleEventClick(e, eventId, origSport, origDate); return; }

    const newStart = minToTime(targetMins);
    const newEnd   = minToTime(targetMins + durMins);

    if (copyMode) {
      const cp = { ...ev, startTime: newStart, endTime: newEnd };
      delete cp.id;
      DataManager.saveEvent(targetSportId, targetDate, cp);
    } else {
      if (targetSportId === origSport && targetDate === origDate && newStart === ev.startTime) return;
      if (targetSportId !== origSport || targetDate !== origDate) {
        DataManager.deleteEvent(origSport, origDate, eventId);
      }
      DataManager.saveEvent(targetSportId, targetDate, { ...ev, startTime: newStart, endTime: newEnd });
    }
    render();
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  function _handleEventClick(e, eventId, sportId, date) {
    _targetSportId = sportId;
    _targetDate    = date;
    if (e.ctrlKey || e.metaKey) {
      const idx = _selectedEvents.findIndex(s => s.id === eventId && s.sportId === sportId && s.date === date);
      if (idx >= 0) _selectedEvents.splice(idx, 1);
      else _selectedEvents.push({ id: eventId, sportId, date });
    } else {
      _selectedEvents = [{ id: eventId, sportId, date }];
    }
    _updateHighlight();
  }

  function _updateHighlight() {
    if (!_container) return;
    _container.querySelectorAll('.event-block').forEach(el => {
      el.classList.toggle('event-selected',
        _selectedEvents.some(s => s.id === el.dataset.eventId && s.sportId === el.dataset.sport && s.date === el.dataset.date));
    });
    _container.querySelectorAll('.date-column').forEach(col => {
      col.classList.toggle('paste-target',
        _clipboard !== null && col.dataset.sport === _targetSportId && col.dataset.date === _targetDate);
    });
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  function _attachKeyboardListener() {
    if (_kbListenerAttached) return;
    document.addEventListener('keydown', _handleKeyDown);
    _kbListenerAttached = true;
  }

  function _handleKeyDown(e) {
    // Only act when combined view panel is active
    const panel = document.getElementById('hotel-tab-__all__');
    if (!panel || !panel.classList.contains('active')) return;
    if (!_container || !document.body.contains(_container)) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if ((e.key === 'Delete' || e.key === 'Backspace') && _selectedEvents.length > 0) {
      e.preventDefault(); _deleteSelected();
    } else if (e.key === 'c' && (e.ctrlKey || e.metaKey) && _selectedEvents.length > 0) {
      e.preventDefault(); _copySelected();
    } else if (e.key === 'v' && (e.ctrlKey || e.metaKey) && _clipboard && _targetSportId && _targetDate) {
      e.preventDefault(); _pasteToTarget();
    } else if (e.key === 'Escape') {
      _selectedEvents = []; _updateHighlight();
    }
  }

  // ── Clipboard operations ──────────────────────────────────────────────────
  function _deleteSelected() {
    if (!confirm(`選択した ${_selectedEvents.length} 件のイベントを削除しますか？`)) return;
    _selectedEvents.forEach(s => DataManager.deleteEvent(s.sportId, s.date, s.id));
    _selectedEvents = [];
    render();
    App.showToast('削除しました');
  }

  function _copySelected() {
    const events = _selectedEvents.map(s => {
      return DataManager.getEvents(s.sportId, s.date).find(e => e.id === s.id);
    }).filter(Boolean);
    if (events.length === 0) return;
    _clipboard = {
      events:      JSON.parse(JSON.stringify(events)),
      fromSportId: _selectedEvents[0].sportId,
      fromDate:    _selectedEvents[0].date,
    };
    render();
    App.showToast(`${events.length} 件をコピーしました（貼り付け先の列をクリック）`);
  }

  function _pasteToTarget() {
    if (!_clipboard || !_targetSportId || !_targetDate) return;
    if (_clipboard.events.length === 0) { App.showToast('コピーするイベントがありません', 'warning'); return; }
    _clipboard.events.forEach(ev => {
      const { id, ...rest } = ev;
      DataManager.saveEvent(_targetSportId, _targetDate, rest);
    });
    render();
    const sport = getSport(_targetSportId);
    App.showToast(`${DataManager.formatDate(_targetDate)} ${sport?.shortName||''} に ${_clipboard.events.length} 件を貼り付けました`);
  }

  function clearClipboard() {
    _clipboard = null;
    render();
  }

  // ── Event modal ───────────────────────────────────────────────────────────
  function showEventModal(eventId, sportId, date, defaultTime) {
    const sport = getSport(sportId);
    const cats  = DataManager.getCategories();
    const ev    = eventId ? DataManager.getEvents(sportId, date).find(e => e.id === eventId) : null;
    const defStart = defaultTime || '09:00';
    const defEnd   = defaultTime ? minToTime(tMin(defaultTime) + 60) : '10:00';

    const catOptions = cats.map(c =>
      `<option value="${c.id}" ${ev && ev.category === c.id ? 'selected' : ''}>${c.name}</option>`).join('');

    const dr = DataManager.getDateRange();
    const sportDates = DataManager.getDatesInRange(sport?.startDate||dr.start, sport?.endDate||dr.end);
    const dateOptions = sportDates.map(d =>
      `<option value="${d}" ${d === date ? 'selected' : ''}>${DataManager.formatDate(d)}</option>`).join('');

    const funcRooms = _hotelId ? DataManager.getFunctionRooms(_hotelId) : [];
    const funcField = funcRooms.length === 0 ? '' : `
      <div class="form-group">
        <label>ファンクションルームから選択 <span style="font-size:11px;color:#7f8c8d;font-weight:normal">（選択で階数・場所を自動入力）</span></label>
        <select id="cg-funcroom" onchange="CombinedGrid._onFuncRoomSelect(this.value)">
          <option value="">-- 直接入力 --</option>
          ${funcRooms.map(fr => `<option value="${fr.id}">${fr.floor}F　${fr.name}${fr.sqm?'（'+fr.sqm+'㎡）':''}</option>`).join('')}
        </select>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cg-event-modal" onclick="if(event.target===this)CombinedGrid.closeEventModal()">
        <div class="modal">
          <div class="modal-header">
            <h3>${ev ? 'イベント編集' : 'イベント追加'}
              <span class="tag" style="background:${sport?.color||'#999'};font-size:11px;margin-left:8px;">${sport?.name||''}</span>
            </h3>
            <button class="modal-close" onclick="CombinedGrid.closeEventModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>日付</label>
              <select id="cg-date">${dateOptions}</select>
            </div>
            <div class="form-group">
              <label>タイトル *</label>
              <input type="text" id="cg-title" value="${ev ? (ev.title||'').replace(/"/g,'&quot;') : ''}" placeholder="例：朝食、練習、競技など">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>開始時刻 *</label>
                <input type="time" id="cg-start" value="${ev ? ev.startTime : defStart}" step="300">
              </div>
              <div class="form-group">
                <label>終了時刻 *</label>
                <input type="time" id="cg-end" value="${ev ? ev.endTime : defEnd}" step="300">
              </div>
            </div>
            <div class="form-group">
              <label>カテゴリ</label>
              <select id="cg-category">${catOptions}</select>
            </div>
            ${funcField}
            <div class="form-row">
              <div class="form-group">
                <label>フロア数</label>
                <input type="number" id="cg-floor" value="${ev ? (ev.floor||'') : ''}" placeholder="例：3" min="1" max="200" style="width:80px;">
              </div>
              <div class="form-group" style="flex:1">
                <label>場所</label>
                <input type="text" id="cg-location" value="${ev ? (ev.location||'').replace(/"/g,'&quot;') : ''}" placeholder="例：ファンクションルーム「葵」">
              </div>
            </div>
            <div class="form-group">
              <label>詳細コメント</label>
              <textarea id="cg-note" rows="3">${ev ? (ev.note||'') : ''}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            ${ev ? `<button class="btn btn-danger" onclick="CombinedGrid.confirmDeleteEvent('${eventId}','${sportId}','${date}')">削除</button>` : ''}
            <button class="btn btn-secondary" onclick="CombinedGrid.closeEventModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="CombinedGrid.saveEventFromModal('${eventId||''}','${sportId}','${date||''}')">保存</button>
          </div>
        </div>
      </div>`);
  }

  function _onFuncRoomSelect(roomId) {
    if (!roomId || !_hotelId) return;
    const room = DataManager.getFunctionRooms(_hotelId).find(r => r.id === roomId);
    if (!room) return;
    const fe = document.getElementById('cg-floor');
    const le = document.getElementById('cg-location');
    if (fe) fe.value = room.floor || '';
    if (le) le.value = room.name  || '';
  }

  function closeEventModal() {
    const m = document.getElementById('cg-event-modal');
    if (m) m.remove();
  }

  function saveEventFromModal(eventId, sportId, originalDate) {
    const date      = document.getElementById('cg-date').value;
    const title     = document.getElementById('cg-title').value.trim();
    const startTime = document.getElementById('cg-start').value;
    const endTime   = document.getElementById('cg-end').value;
    const category  = document.getElementById('cg-category').value;
    const floorRaw  = document.getElementById('cg-floor').value;
    const location  = document.getElementById('cg-location').value.trim();
    const note      = document.getElementById('cg-note').value;

    if (!title) { alert('タイトルを入力してください'); return; }
    if (!startTime || !endTime) { alert('時刻を入力してください'); return; }
    if (tMin(endTime) <= tMin(startTime)) { alert('終了時刻は開始時刻より後にしてください'); return; }

    if (eventId && originalDate && originalDate !== date) {
      DataManager.deleteEvent(sportId, originalDate, eventId);
    }
    DataManager.saveEvent(sportId, date, {
      id: eventId || undefined,
      title, startTime, endTime, category,
      floor:    floorRaw ? Number(floorRaw) : undefined,
      location: location || undefined,
      note,
    });
    closeEventModal();
    render();
  }

  function confirmDeleteEvent(eventId, sportId, date) {
    if (confirm('このイベントを削除しますか？')) {
      DataManager.deleteEvent(sportId, date, eventId);
      closeEventModal();
      render();
    }
  }

  // ── Public: update visible sports (called from filter checkboxes) ─────────
  function updateVisible(visibleIds) {
    _visibleIds     = visibleIds;
    _selectedEvents = [];
    render();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    init, render, updateVisible, clearClipboard,
    handleSlotClick,
    showEventModal, closeEventModal, saveEventFromModal, confirmDeleteEvent,
    _onFuncRoomSelect,
  };
})();
