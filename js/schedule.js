/**
 * schedule.js - Schedule grid component
 * Renders a time × date grid with event blocks.
 * Supports event CRUD, day copy/paste, and template operations.
 */
const ScheduleGrid = (() => {
  // ── Constants ────────────────────────────────────────────────────────────
  const SLOT_HEIGHT = 40;      // px per 30-min slot
  const TIME_COL_W  = 60;      // px for time label column
  const DATE_COL_W  = 130;     // px per date column
  const START_HOUR  = 6;       // 6:00
  const END_HOUR    = 24;      // 24:00 (midnight)
  const SLOTS_PER_HOUR = 2;    // 30-min slots

  let _sportId    = null;
  let _hotelId    = null;      // hotel context for function room suggestions
  let _dates      = [];        // array of 'YYYY-MM-DD' strings
  let _container  = null;      // DOM element
  let _clipboard          = null;  // { events: [...], fromDate: '...' }
  let _drag               = null;  // drag state
  let _resize             = null;  // resize state
  let _selectedEvents     = [];    // [{id, date}, ...]
  let _targetDate         = null;  // paste target date
  let _kbListenerAttached = false;

  // ── Time helpers ─────────────────────────────────────────────────────────
  function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  function minutesToTime(mins) {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  function slotToMinutes(slot) {
    return (START_HOUR * 60) + slot * 30;
  }

  function minutesToTop(mins) {
    const offsetMins = mins - START_HOUR * 60;
    return (offsetMins / 30) * SLOT_HEIGHT;
  }

  function durationToHeight(startMins, endMins) {
    const dur = endMins - startMins;
    return Math.max((dur / 30) * SLOT_HEIGHT, 20); // minimum 20px
  }

  // ── Generate time slots ──────────────────────────────────────────────────
  function generateSlots() {
    const slots = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      slots.push({ hour: h, minute: 0,  label: `${String(h).padStart(2,'0')}:00`, isHour: true });
      slots.push({ hour: h, minute: 30, label: `${String(h).padStart(2,'0')}:30`, isHour: false });
    }
    return slots;
  }

  // ── Total grid height ────────────────────────────────────────────────────
  function gridHeight() {
    return (END_HOUR - START_HOUR) * SLOTS_PER_HOUR * SLOT_HEIGHT;
  }

  // ── Public init ──────────────────────────────────────────────────────────
  function init(containerId, sportId, startDate, endDate, hotelId) {
    _sportId   = sportId;
    _hotelId   = hotelId || null;
    _container = document.getElementById(containerId);
    if (!_container) return;

    const dr = DataManager.getDateRange();
    const s  = startDate || dr.start;
    const e  = endDate   || dr.end;
    _dates = DataManager.getDatesInRange(s, e);

    render();
  }

  // ── Main render ──────────────────────────────────────────────────────────
  function render() {
    if (!_container) return;
    const slots = generateSlots();
    const gh    = gridHeight();

    // Toolbar
    const toolbar = `
      <div class="schedule-toolbar">
        <button class="btn btn-primary btn-sm" onclick="ScheduleGrid.showEventModal(null, null)">
          ＋ イベント追加
        </button>
        <button class="btn btn-secondary btn-sm" onclick="ScheduleGrid.showTemplatePanel()">
          📋 テンプレート
        </button>
        ${_clipboard ? `
          <div style="margin-left:auto;display:flex;align-items:center;gap:8px;background:#eaf4fb;border:1px solid #aed6f1;padding:4px 12px;border-radius:20px;font-size:12px;">
            <span>📋 ${DataManager.formatDate(_clipboard.fromDate)} のイベントをコピー中</span>
            <button class="btn btn-xs btn-outline" onclick="ScheduleGrid.clearClipboard()">クリア</button>
          </div>
        ` : ''}
      </div>`;

    // Legend
    const cats = DataManager.getCategories();
    const legend = `
      <div class="legend">
        ${cats.map(c => `
          <div class="legend-item">
            <div class="legend-dot" style="background:${c.color}"></div>
            <span>${c.name}</span>
          </div>`).join('')}
      </div>`;

    // Day type options
    const DAY_TYPE_OPTIONS = [
      { value: '',            label: '-- 区分 --' },
      { value: 'checkin',     label: 'チェックイン日' },
      { value: 'practice',    label: '練習日' },
      { value: 'competition', label: '競技日' },
      { value: 'stay',        label: '滞在日' },
      { value: 'checkout',    label: 'チェックアウト日' },
    ];

    // Build header row
    const headerCells = _dates.map((date, i) => {
      const wd      = DataManager.getWeekday(date);
      const lbl     = DataManager.formatDate(date);
      const cls     = wd === 0 ? 'weekend' : wd === 6 ? 'saturday' : '';
      const dayType = DataManager.getDayType(_sportId, date);
      const dtCls   = dayType ? `daytype-${dayType}` : '';
      const opts    = DAY_TYPE_OPTIONS.map(o =>
        `<option value="${o.value}" ${dayType === o.value ? 'selected' : ''}>${o.label}</option>`
      ).join('');
      return `
        <div class="date-header-cell ${cls} ${dtCls}" data-date="${date}">
          <div class="date-label">${lbl}</div>
          <select class="day-type-select" onchange="ScheduleGrid.setDayType('${date}', this.value)">
            ${opts}
          </select>
          <div class="date-actions">
            <button class="btn btn-xs btn-secondary" title="このコピー" onclick="ScheduleGrid.copyDay('${date}')">コピー</button>
            ${_clipboard ? `<button class="btn btn-xs btn-primary" title="貼り付け" onclick="ScheduleGrid.pasteDay('${date}')">貼付</button>` : ''}
            <button class="btn btn-xs btn-secondary" title="テンプレートとして保存" onclick="ScheduleGrid.saveDayAsTemplate('${date}')">保存</button>
          </div>
        </div>`;
    }).join('');

    // Build time label column
    const timeLabels = slots.map(s => `
      <div class="time-slot-label ${s.isHour ? 'hour' : ''}">${s.isHour ? s.label : ''}</div>
    `).join('');

    // Build date columns with events
    const dateCols = _dates.map(date => {
      const events = DataManager.getEvents(_sportId, date);
      const cellSlots = slots.map(s => {
        const mins = s.hour * 60 + s.minute;
        return `<div class="time-slot-cell ${s.isHour ? 'hour-boundary' : ''}"
          onclick="ScheduleGrid.showEventModal(null, '${date}', '${minutesToTime(mins)}')"
          data-date="${date}" data-time="${minutesToTime(mins)}"></div>`;
      }).join('');

      const eventBlocks = events.map(ev => renderEventBlock(ev, date)).join('');

      return `
        <div class="date-column" data-date="${date}" style="height:${gh}px;">
          ${cellSlots}
          ${eventBlocks}
        </div>`;
    }).join('');

    const kbHint = `<div class="kb-hint">選択: クリック ／ 複数選択: Ctrl+クリック ／ コピー: Ctrl+C ／ 削除: Delete ／ 貼り付け: 対象日クリック後 Ctrl+V ／ 選択解除: Esc</div>`;

    _container.innerHTML = `
      ${toolbar}
      ${legend}
      ${kbHint}
      <div class="schedule-wrapper">
        <div class="schedule-container">
          <div class="schedule-header">
            <div class="time-col" style="width:${TIME_COL_W}px;min-width:${TIME_COL_W}px;"></div>
            ${headerCells}
          </div>
          <div class="schedule-body">
            <div class="time-col-body" style="width:${TIME_COL_W}px;min-width:${TIME_COL_W}px;">
              ${timeLabels}
            </div>
            <div class="schedule-grid">
              ${dateCols}
            </div>
          </div>
        </div>
      </div>`;

    _initDragDrop();
    _attachPostRenderListeners();
  }

  // ── Event block ──────────────────────────────────────────────────────────
  function renderEventBlock(ev, date) {
    const cat    = DataManager.getCategory(ev.category) || { color: '#7f8c8d' };
    const color  = ev.color || cat.color;
    const sMin   = timeToMinutes(ev.startTime);
    const eMin   = timeToMinutes(ev.endTime);
    const top    = minutesToTop(sMin);
    const height = durationToHeight(sMin, eMin);
    const safeTitle = (ev.title || '').replace(/"/g, '&quot;');
    const safeNote  = (ev.note  || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const subInfo   = [ev.floor ? `${ev.floor}F` : '', ev.location || ''].filter(Boolean).join(' ');
    const hasPopup  = ev.note || subInfo;
    const popupBody = [subInfo, safeNote].filter(Boolean).join('<br>');
    const notePopup = hasPopup
      ? `<div class="event-note-popup"><div class="event-note-popup-title">${safeTitle}</div><div class="event-note-popup-body">${popupBody}</div></div>`
      : '';
    const isSelected = _selectedEvents.some(s => s.id === ev.id && s.date === date);
    return `
      <div class="event-block${hasPopup ? ' has-note' : ''}${isSelected ? ' event-selected' : ''}"
           style="top:${top}px;height:${height}px;background:${color};cursor:grab;"
           data-event-id="${ev.id}" data-date="${date}"
           ondblclick="event.stopPropagation();ScheduleGrid.showEventModal('${ev.id}','${date}')"
           title="${safeTitle}">
        <div class="event-time">${ev.startTime}–${ev.endTime}</div>
        <div class="event-title">${ev.title || ''}${hasPopup ? ' <span class="note-icon">💬</span>' : ''}</div>
        ${subInfo ? `<div style="font-size:9px;opacity:0.9;">${subInfo}</div>` : ''}
        ${notePopup}
        <div class="event-resize-handle" data-resize="bottom"></div>
      </div>`;
  }

  // ── Event modal ──────────────────────────────────────────────────────────
  function showEventModal(eventId, date, defaultTime) {
    const sport = DataManager.getSport(_sportId);
    const cats  = DataManager.getCategories();
    let ev = eventId ? DataManager.getEvents(_sportId, date).find(e => e.id === eventId) : null;

    // Default values
    const defStart = defaultTime || '09:00';
    const defEnd   = defaultTime
      ? minutesToTime(timeToMinutes(defaultTime) + 60)
      : '10:00';

    const catOptions = cats.map(c =>
      `<option value="${c.id}" ${ev && ev.category === c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    const dateOptions = _dates.map(d =>
      `<option value="${d}" ${d === date ? 'selected' : ''}>${DataManager.formatDate(d)}</option>`
    ).join('');

    const html = `
      <div class="modal-overlay" id="event-modal" onclick="if(event.target===this)ScheduleGrid.closeEventModal()">
        <div class="modal">
          <div class="modal-header">
            <h3>${ev ? 'イベント編集' : 'イベント追加'}</h3>
            <button class="modal-close" onclick="ScheduleGrid.closeEventModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>日付</label>
              <select id="ev-date">${dateOptions}</select>
            </div>
            <div class="form-group">
              <label>タイトル *</label>
              <input type="text" id="ev-title" value="${ev ? (ev.title||'').replace(/"/g,'&quot;') : ''}" placeholder="例：朝食、練習、競技など">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>開始時刻 *</label>
                <input type="time" id="ev-start" value="${ev ? ev.startTime : defStart}" step="300">
              </div>
              <div class="form-group">
                <label>終了時刻 *</label>
                <input type="time" id="ev-end" value="${ev ? ev.endTime : defEnd}" step="300">
              </div>
            </div>
            <div class="form-group">
              <label>カテゴリ</label>
              <select id="ev-category">${catOptions}</select>
            </div>
            <div class="form-group">
              <label>カラー（カテゴリ色を上書き）</label>
              <input type="color" id="ev-color" value="${ev && ev.color ? ev.color : '#3498db'}" style="width:60px;height:36px;padding:2px;">
              <button class="btn btn-xs btn-secondary" style="margin-left:6px"
                onclick="document.getElementById('ev-color').value=''">カテゴリ色を使用</button>
            </div>
            ${(() => {
              const funcRooms = _hotelId ? DataManager.getFunctionRooms(_hotelId) : [];
              if (funcRooms.length === 0) return '';
              return `<div class="form-group">
                <label>ファンクションルームから選択 <span style="font-size:11px;color:#7f8c8d;font-weight:normal">（選択で階数・場所を自動入力）</span></label>
                <select id="ev-funcroom" onchange="ScheduleGrid._onFuncRoomSelect(this.value)">
                  <option value="">-- 直接入力 --</option>
                  ${funcRooms.map(fr => `<option value="${fr.id}">${fr.floor}F　${fr.name}${fr.sqm ? '（'+fr.sqm+'㎡）' : ''}</option>`).join('')}
                </select>
              </div>`;
            })()}
            <div class="form-row">
              <div class="form-group">
                <label>フロア数</label>
                <input type="number" id="ev-floor" value="${ev ? (ev.floor||'') : ''}" placeholder="例：3" min="1" max="200" style="width:80px;">
              </div>
              <div class="form-group" style="flex:1">
                <label>場所</label>
                <input type="text" id="ev-location" value="${ev ? (ev.location||'').replace(/"/g,'&quot;') : ''}" placeholder="例：ファンクションルーム「葵」">
              </div>
            </div>
            <div class="form-group">
              <label>詳細コメント <span style="font-size:11px;color:#7f8c8d;font-weight:normal">（印刷・Excel出力に反映、Web上はホバーで表示）</span></label>
              <textarea id="ev-note" rows="3" placeholder="例：3階ファンクションルーム「葵」にて食事、食事後はエレベーターで客室へ戻る">${ev ? (ev.note||'') : ''}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            ${ev ? `<button class="btn btn-danger" onclick="ScheduleGrid.confirmDeleteEvent('${ev.id}','${date}')">削除</button>` : ''}
            <button class="btn btn-secondary" onclick="ScheduleGrid.closeEventModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="ScheduleGrid.saveEventFromModal('${eventId||''}', '${date||''}')">保存</button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  function _onFuncRoomSelect(roomId) {
    if (!roomId || !_hotelId) return;
    const funcRooms = DataManager.getFunctionRooms(_hotelId);
    const room = funcRooms.find(r => r.id === roomId);
    if (!room) return;
    const floorEl    = document.getElementById('ev-floor');
    const locationEl = document.getElementById('ev-location');
    if (floorEl)    floorEl.value    = room.floor || '';
    if (locationEl) locationEl.value = room.name  || '';
  }

  function closeEventModal() {
    const m = document.getElementById('event-modal');
    if (m) m.remove();
  }

  function saveEventFromModal(eventId, originalDate) {
    const date     = document.getElementById('ev-date').value;
    const title    = document.getElementById('ev-title').value.trim();
    const startTime = document.getElementById('ev-start').value;
    const endTime   = document.getElementById('ev-end').value;
    const category  = document.getElementById('ev-category').value;
    const color     = document.getElementById('ev-color').value;
    const floorRaw  = document.getElementById('ev-floor').value;
    const location  = document.getElementById('ev-location').value.trim();
    const note      = document.getElementById('ev-note').value;

    if (!title) { alert('タイトルを入力してください'); return; }
    if (!startTime || !endTime) { alert('時刻を入力してください'); return; }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      alert('終了時刻は開始時刻より後にしてください'); return;
    }

    // If date changed and this is an edit, remove from original date
    if (eventId && originalDate && originalDate !== date) {
      DataManager.deleteEvent(_sportId, originalDate, eventId);
    }

    const ev = {
      id: eventId || undefined,
      title, startTime, endTime, category,
      color: color || undefined,
      floor: floorRaw ? Number(floorRaw) : undefined,
      location: location || undefined,
      note
    };

    DataManager.saveEvent(_sportId, date, ev);
    closeEventModal();
    render();
  }

  // ── Resize (bottom handle → end time, 15-min snap) ───────────────────────
  function _onResizeMove(e) {
    if (!_resize) return;
    const grid = _container && _container.querySelector('.schedule-grid');
    const col  = grid && grid.querySelector(`.date-column[data-date="${_resize.date}"]`);
    if (!col) return;

    const colRect  = col.getBoundingClientRect();
    const relY     = e.clientY - colRect.top;
    // 15-min snap: SLOT_HEIGHT/2 = 20px per 15 min
    const snapPx   = SLOT_HEIGHT / 2;
    const totalMins = START_HOUR * 60 + Math.round(relY / snapPx) * 15;
    const minEnd    = _resize.startMins + 15;
    const newEnd    = Math.max(minEnd, Math.min(totalMins, END_HOUR * 60));

    _resize.targetEndMins = newEnd;
    _resize.moved = true;

    // Live visual feedback
    const newHeight = durationToHeight(_resize.startMins, newEnd);
    _resize.block.style.height = newHeight + 'px';
    const timeEl = _resize.block.querySelector('.event-time');
    if (timeEl) timeEl.textContent = `${_resize.ev.startTime}–${minutesToTime(newEnd)}`;
  }

  function _onResizeUp() {
    document.removeEventListener('mousemove', _onResizeMove);
    document.removeEventListener('mouseup',   _onResizeUp);
    if (!_resize) return;

    const { eventId, date, ev, moved, targetEndMins } = _resize;
    _resize = null;

    if (!moved || targetEndMins === timeToMinutes(ev.endTime)) return;

    DataManager.saveEvent(_sportId, date, { ...ev, endTime: minutesToTime(targetEndMins) });
    render();
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  function _initDragDrop() {
    const grid = _container && _container.querySelector('.schedule-grid');
    if (!grid) return;
    // Use a fresh listener each render (grid is recreated)
    grid.addEventListener('mousedown', _onGridMouseDown);
  }

  function _onGridMouseDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest('.event-note-popup')) return;

    // Resize handle takes priority over drag
    const resizeHandle = e.target.closest('[data-resize]');
    if (resizeHandle) {
      const block = resizeHandle.closest('.event-block');
      if (!block) return;
      const eventId = block.dataset.eventId;
      const date    = block.dataset.date;
      if (!eventId || !date) return;
      const ev = DataManager.getEvents(_sportId, date).find(x => x.id === eventId);
      if (!ev) return;
      e.preventDefault();
      e.stopPropagation();
      _resize = {
        eventId, date, ev, block,
        startMins:    timeToMinutes(ev.startTime),
        endMins:      timeToMinutes(ev.endTime),
        targetEndMins: timeToMinutes(ev.endTime),
        moved: false,
      };
      document.addEventListener('mousemove', _onResizeMove);
      document.addEventListener('mouseup',   _onResizeUp);
      return;
    }

    const block = e.target.closest('.event-block');
    if (!block) return;
    const eventId = block.dataset.eventId;
    const date    = block.dataset.date;
    if (!eventId || !date) return;

    const ev = DataManager.getEvents(_sportId, date).find(x => x.id === eventId);
    if (!ev) return;

    e.preventDefault(); // prevent text selection while dragging

    const blockRect = block.getBoundingClientRect();
    _drag = {
      eventId, date, ev,
      durMins:    timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime),
      offsetPx:   e.clientY - blockRect.top,
      origBlock:  block,
      ghost:      null,
      moved:      false,
      initX:      e.clientX,
      initY:      e.clientY,
      targetDate: date,
      targetMins: timeToMinutes(ev.startTime),
      copyMode:   e.ctrlKey && e.shiftKey,
    };

    document.addEventListener('mousemove', _onDragMove);
    document.addEventListener('mouseup',   _onDragUp);
  }

  function _onDragMove(e) {
    if (!_drag) return;
    const dx = e.clientX - _drag.initX;
    const dy = e.clientY - _drag.initY;

    // Create ghost on first significant movement
    if (!_drag.moved) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      _drag.moved = true;
      const br    = _drag.origBlock.getBoundingClientRect();
      const ghost = _drag.origBlock.cloneNode(true);
      ghost.style.cssText = `
        position:fixed;pointer-events:none;z-index:9999;
        width:${br.width}px;height:${br.height}px;
        opacity:0.8;cursor:${_drag.copyMode ? 'copy' : 'grabbing'};
        box-shadow:0 6px 20px rgba(0,0,0,0.35);
        border-radius:6px;transition:none;
      `;
      if (_drag.copyMode) {
        // Show "+" badge on ghost to indicate copy mode
        const badge = document.createElement('div');
        badge.className = 'event-copy-badge';
        badge.textContent = '＋';
        ghost.appendChild(badge);
      }
      document.body.appendChild(ghost);
      _drag.ghost = ghost;
      if (!_drag.copyMode) {
        _drag.origBlock.classList.add('event-dragging');
      }
    }

    // Move ghost (anchored to cursor offset inside original block)
    const ghost = _drag.ghost;
    ghost.style.top  = (e.clientY - _drag.offsetPx) + 'px';
    ghost.style.left = (e.clientX - ghost.offsetWidth / 2) + 'px';

    // Determine target column and snapped time
    const grid = _container.querySelector('.schedule-grid');
    if (!grid) return;
    grid.querySelectorAll('.date-column').forEach(c => c.classList.remove('drag-over'));
    const el  = document.elementFromPoint(e.clientX, e.clientY); // ghost has pointer-events:none
    const col = el && el.closest('.date-column');
    if (col && _dates.includes(col.dataset.date)) {
      col.classList.add('drag-over');
      _drag.targetDate = col.dataset.date;

      const colRect  = col.getBoundingClientRect();
      const relY     = e.clientY - colRect.top - _drag.offsetPx;
      const snapPx   = SLOT_HEIGHT / 2; // 15-min snap (same as resize)
      const slot     = Math.round(relY / snapPx);
      const clamped  = Math.max(0, Math.min(slot, (END_HOUR - START_HOUR) * SLOTS_PER_HOUR * 2 - 1));
      const newStart = START_HOUR * 60 + clamped * 15;
      _drag.targetMins = Math.max(START_HOUR * 60,
                           Math.min(newStart, END_HOUR * 60 - _drag.durMins));
    }
  }

  function _onDragUp(e) {
    document.removeEventListener('mousemove', _onDragMove);
    document.removeEventListener('mouseup',   _onDragUp);
    if (!_drag) return;

    const { eventId, date: origDate, ev, durMins,
            ghost, origBlock, moved, targetDate, targetMins, copyMode } = _drag;
    _drag = null;

    if (ghost) ghost.remove();
    origBlock.classList.remove('event-dragging');

    const grid = _container && _container.querySelector('.schedule-grid');
    if (grid) grid.querySelectorAll('.date-column').forEach(c => c.classList.remove('drag-over'));

    if (!moved) {
      // No movement: single click → select event (dblclick handled by ondblclick handler)
      if (!copyMode) handleEventClick(e, eventId, origDate);
      return;
    }

    const newStart = minutesToTime(targetMins);
    const newEnd   = minutesToTime(targetMins + durMins);

    if (copyMode) {
      // Copy: save new event (no id → new id generated), original stays
      const newEv = { ...ev, startTime: newStart, endTime: newEnd };
      delete newEv.id;
      DataManager.saveEvent(_sportId, targetDate, newEv);
    } else {
      // Move: no-op if same position
      if (targetDate === origDate && newStart === ev.startTime) return;
      if (targetDate !== origDate) {
        DataManager.deleteEvent(_sportId, origDate, eventId);
        DataManager.saveEvent(_sportId, targetDate, { ...ev, startTime: newStart, endTime: newEnd });
      } else {
        DataManager.saveEvent(_sportId, origDate, { ...ev, startTime: newStart, endTime: newEnd });
      }
    }
    render();
  }

  function confirmDeleteEvent(eventId, date) {
    if (confirm('このイベントを削除しますか？')) {
      DataManager.deleteEvent(_sportId, date, eventId);
      closeEventModal();
      render();
    }
  }

  // ── Day copy / paste ────────────────────────────────────────────────────
  function copyDay(date) {
    const events = DataManager.getEvents(_sportId, date);
    _clipboard = { events: JSON.parse(JSON.stringify(events)), fromDate: date };
    render();
    App.showToast(`${DataManager.formatDate(date)} のイベントをコピーしました`);
  }

  function pasteDay(targetDate) {
    if (!_clipboard) return;
    if (_clipboard.events.length === 0) {
      App.showToast('コピーするイベントがありません', 'warning');
      return;
    }
    if (!confirm(`${DataManager.formatDate(targetDate)} に ${_clipboard.events.length} 件のイベントを貼り付けますか？\n（既存のイベントに追加されます）`)) return;

    _clipboard.events.forEach(ev => {
      const { id, ...rest } = ev;
      DataManager.saveEvent(_sportId, targetDate, rest);
    });
    render();
    App.showToast(`${DataManager.formatDate(targetDate)} に貼り付けました`);
  }

  function clearClipboard() {
    _clipboard = null;
    render();
  }

  // ── Save day as template ─────────────────────────────────────────────────
  function saveDayAsTemplate(date) {
    const events = DataManager.getEvents(_sportId, date);
    if (events.length === 0) {
      App.showToast('保存するイベントがありません', 'warning');
      return;
    }
    const defaultName = `${DataManager.getSport(_sportId)?.shortName || ''} ${DataManager.formatDate(date)}`;
    showSaveTemplateModal(defaultName, events);
  }

  function showSaveTemplateModal(defaultName, events) {
    const html = `
      <div class="modal-overlay" id="save-tmpl-modal" onclick="if(event.target===this)ScheduleGrid.closeSaveTemplateModal()">
        <div class="modal">
          <div class="modal-header">
            <h3>テンプレートとして保存</h3>
            <button class="modal-close" onclick="ScheduleGrid.closeSaveTemplateModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info">イベント ${events.length} 件をテンプレートとして保存します。</div>
            <div class="form-group">
              <label>テンプレート名 *</label>
              <input type="text" id="tmpl-name" value="${defaultName.replace(/"/g,'&quot;')}" placeholder="テンプレート名を入力">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="ScheduleGrid.closeSaveTemplateModal()">キャンセル</button>
            <button class="btn btn-success" onclick="ScheduleGrid._doSaveTemplate()">保存</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    // Store events temporarily
    ScheduleGrid._pendingTemplateEvents = events;
  }

  function closeSaveTemplateModal() {
    const m = document.getElementById('save-tmpl-modal');
    if (m) m.remove();
    ScheduleGrid._pendingTemplateEvents = null;
  }

  function _doSaveTemplate() {
    const name = document.getElementById('tmpl-name').value.trim();
    if (!name) { alert('テンプレート名を入力してください'); return; }
    DataManager.saveTemplate(name, ScheduleGrid._pendingTemplateEvents);
    closeSaveTemplateModal();
    App.showToast(`テンプレート「${name}」を保存しました`);
  }

  // ── Template panel ───────────────────────────────────────────────────────
  function showTemplatePanel() {
    const templates = DataManager.getTemplates();
    const dateOptions = _dates.map(d =>
      `<option value="${d}">${DataManager.formatDate(d)}</option>`
    ).join('');

    const tmplList = templates.length === 0
      ? '<p class="text-muted text-center" style="padding:20px">テンプレートがありません。<br>スケジュール日のヘッダー「保存」から作成できます。</p>'
      : templates.map(t => `
          <div class="template-item" id="tmpl-${t.id}">
            <div>
              <div class="template-name">${t.name}</div>
              <div class="template-meta">${t.events.length} 件 · ${new Date(t.createdAt).toLocaleDateString('ja-JP')}</div>
            </div>
            <select class="btn btn-sm" id="apply-date-${t.id}" style="margin-left:auto">
              ${dateOptions}
            </select>
            <button class="btn btn-primary btn-sm" onclick="ScheduleGrid.applyTemplate('${t.id}')">適用</button>
            <button class="btn btn-danger btn-sm" onclick="ScheduleGrid.deleteTemplate('${t.id}')">削除</button>
          </div>`).join('');

    const html = `
      <div class="modal-overlay" id="tmpl-panel" onclick="if(event.target===this)ScheduleGrid.closeTemplatePanel()">
        <div class="modal modal-wide">
          <div class="modal-header">
            <h3>📋 テンプレート管理</h3>
            <button class="modal-close" onclick="ScheduleGrid.closeTemplatePanel()">×</button>
          </div>
          <div class="modal-body">
            <div class="template-list">${tmplList}</div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="ScheduleGrid.closeTemplatePanel()">閉じる</button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  function closeTemplatePanel() {
    const m = document.getElementById('tmpl-panel');
    if (m) m.remove();
  }

  function applyTemplate(templateId) {
    const sel = document.getElementById(`apply-date-${templateId}`);
    if (!sel) return;
    const targetDate = sel.value;
    if (!confirm(`テンプレートを ${DataManager.formatDate(targetDate)} に適用しますか？`)) return;
    DataManager.applyTemplate(templateId, _sportId, targetDate);
    closeTemplatePanel();
    render();
    App.showToast('テンプレートを適用しました');
  }

  function deleteTemplate(templateId) {
    if (!confirm('このテンプレートを削除しますか？')) return;
    DataManager.deleteTemplate(templateId);
    closeTemplatePanel();
    showTemplatePanel();
    App.showToast('テンプレートを削除しました');
  }

  // ── Sport date range editor ───────────────────────────────────────────────
  function showDateRangeModal(sportId) {
    const sport = DataManager.getSport(sportId);
    if (!sport) return;
    const dr = DataManager.getDateRange();

    const html = `
      <div class="modal-overlay" id="daterange-modal" onclick="if(event.target===this)ScheduleGrid.closeDateRangeModal()">
        <div class="modal">
          <div class="modal-header">
            <h3>滞在期間設定: ${sport.name}</h3>
            <button class="modal-close" onclick="ScheduleGrid.closeDateRangeModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info">全体の期間: ${dr.start} ～ ${dr.end}</div>
            <div class="form-row">
              <div class="form-group">
                <label>滞在開始日</label>
                <input type="date" id="dr-start" value="${sport.startDate || dr.start}"
                  min="${dr.start}" max="${dr.end}">
              </div>
              <div class="form-group">
                <label>滞在終了日</label>
                <input type="date" id="dr-end" value="${sport.endDate || dr.end}"
                  min="${dr.start}" max="${dr.end}">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="ScheduleGrid.closeDateRangeModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="ScheduleGrid.saveDateRange('${sportId}')">保存</button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  function closeDateRangeModal() {
    const m = document.getElementById('daterange-modal');
    if (m) m.remove();
  }

  function saveDateRange(sportId) {
    const start = document.getElementById('dr-start').value;
    const end   = document.getElementById('dr-end').value;
    if (start > end) { alert('終了日は開始日より後にしてください'); return; }
    DataManager.updateSport(sportId, { startDate: start, endDate: end });
    closeDateRangeModal();
    // Re-init with new dates
    init(_container.id, sportId, start, end);
    App.showToast('滞在期間を更新しました');
  }

  // ── Selection & keyboard shortcuts ──────────────────────────────────────
  function _attachPostRenderListeners() {
    if (!_kbListenerAttached) {
      document.addEventListener('keydown', _handleKeyDown);
      _kbListenerAttached = true;
    }
    // Click on date header to set paste target
    _container.querySelectorAll('.date-header-cell').forEach(cell => {
      cell.addEventListener('click', e => {
        if (e.target.closest('button') || e.target.closest('select')) return;
        const date = cell.dataset.date;
        if (date) { _targetDate = date; _updateTargetHighlight(); }
      });
    });
    // Click on date column background: deselect all (if no Ctrl) and set target
    _container.querySelectorAll('.date-column').forEach(col => {
      col.addEventListener('click', e => {
        if (e.target.closest('.event-block')) return;
        const date = col.dataset.date;
        if (date) { _targetDate = date; }
        if (!e.ctrlKey && !e.metaKey) {
          _selectedEvents = [];
          _updateSelectionHighlight();
        }
      });
    });
  }

  function handleEventClick(e, eventId, date) {
    _targetDate = date;
    if (e.ctrlKey || e.metaKey) {
      const idx = _selectedEvents.findIndex(s => s.id === eventId && s.date === date);
      if (idx >= 0) _selectedEvents.splice(idx, 1);
      else _selectedEvents.push({ id: eventId, date });
    } else {
      _selectedEvents = [{ id: eventId, date }];
    }
    _updateSelectionHighlight();
  }

  function _updateSelectionHighlight() {
    if (!_container) return;
    _container.querySelectorAll('.event-block').forEach(el => {
      const id   = el.dataset.eventId;
      const date = el.dataset.date;
      el.classList.toggle('event-selected', _selectedEvents.some(s => s.id === id && s.date === date));
    });
    _updateTargetHighlight();
  }

  function _updateTargetHighlight() {
    if (!_container) return;
    _container.querySelectorAll('.date-column').forEach(col => {
      col.classList.toggle('paste-target', col.dataset.date === _targetDate && _clipboard !== null);
    });
  }

  function _handleKeyDown(e) {
    if (!_container) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && _selectedEvents.length > 0) {
      e.preventDefault();
      _deleteSelectedEvents();
    } else if (e.key === 'c' && (e.ctrlKey || e.metaKey) && _selectedEvents.length > 0) {
      e.preventDefault();
      _copySelectedEvents();
    } else if (e.key === 'v' && (e.ctrlKey || e.metaKey) && _clipboard && _targetDate) {
      e.preventDefault();
      _pasteToTargetDate();
    } else if (e.key === 'Escape') {
      _selectedEvents = [];
      _updateSelectionHighlight();
    }
  }

  function _deleteSelectedEvents() {
    if (_selectedEvents.length === 0) return;
    if (!confirm(`選択した ${_selectedEvents.length} 件のイベントを削除しますか？`)) return;
    _selectedEvents.forEach(s => DataManager.deleteEvent(_sportId, s.date, s.id));
    _selectedEvents = [];
    render();
    App.showToast('削除しました');
  }

  function _copySelectedEvents() {
    const events = _selectedEvents.map(s => {
      const all = DataManager.getEvents(_sportId, s.date);
      return all.find(e => e.id === s.id);
    }).filter(Boolean);
    _clipboard = { events: JSON.parse(JSON.stringify(events)), fromDate: _selectedEvents[0]?.date };
    render();
    App.showToast(`${events.length} 件をコピーしました（貼り付け先の日をクリックして Ctrl+V）`);
  }

  function _pasteToTargetDate() {
    if (!_clipboard || !_targetDate) return;
    if (_clipboard.events.length === 0) { App.showToast('コピーするイベントがありません', 'warning'); return; }
    _clipboard.events.forEach(ev => {
      const { id, ...rest } = ev;
      DataManager.saveEvent(_sportId, _targetDate, rest);
    });
    render();
    App.showToast(`${DataManager.formatDate(_targetDate)} に ${_clipboard.events.length} 件を貼り付けました`);
  }

  function setDayType(date, type) {
    DataManager.setDayType(_sportId, date, type);
    if (!_container) return;
    const cell = _container.querySelector(`.date-header-cell[data-date="${date}"]`);
    if (!cell) return;
    cell.classList.remove('daytype-checkin', 'daytype-practice', 'daytype-competition', 'daytype-stay', 'daytype-checkout');
    if (type) cell.classList.add(`daytype-${type}`);
  }

  return {
    init, render,
    showEventModal, closeEventModal, saveEventFromModal, confirmDeleteEvent,
    _onFuncRoomSelect,
    copyDay, pasteDay, clearClipboard,
    saveDayAsTemplate, showSaveTemplateModal, closeSaveTemplateModal, _doSaveTemplate,
    showTemplatePanel, closeTemplatePanel, applyTemplate, deleteTemplate,
    showDateRangeModal, closeDateRangeModal, saveDateRange,
    setDayType, handleEventClick,
    _pendingTemplateEvents: null,
    get clipboard() { return _clipboard; },
  };
})();
