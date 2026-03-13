/**
 * admin.js - Admin page controller
 * Provides full CRUD management for master data:
 * sports, hotels, venues, event categories, and date range.
 */
const AdminApp = (() => {

  let currentTab = 'sports';

  // ── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    await DataManager.init();
    renderTab('sports');
  }

  // ── Tab routing ───────────────────────────────────────────────────────────
  function switchMainTab(tab) {
    currentTab = tab;
    // Update button states
    document.querySelectorAll('.main-tab-btn').forEach((btn, i) => {
      const tabs = ['sports', 'hotels', 'venues', 'categories', 'daterange'];
      btn.classList.toggle('active', tabs[i] === tab);
    });
    // Show/hide panels
    document.querySelectorAll('.admin-tab-panel').forEach(p => {
      p.style.display = p.id === `tab-${tab}` ? 'block' : 'none';
    });
    renderTab(tab);
  }

  function renderTab(tab) {
    switch (tab) {
      case 'sports':     renderSports();     break;
      case 'hotels':     renderHotels();     break;
      case 'venues':     renderVenues();     break;
      case 'categories': renderCategories(); break;
      case 'daterange':  renderDateRange();  break;
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  function showToast(message, type = 'success') {
    const colors = { success: '#27ae60', warning: '#f39c12', error: '#e74c3c' };
    const toast = document.createElement('div');
    toast.style.cssText = `
      position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
      background:${colors[type] || colors.success};color:white;
      padding:10px 24px;border-radius:24px;font-size:13px;font-weight:600;
      box-shadow:0 4px 16px rgba(0,0,0,0.2);z-index:9999;
      animation:fadeIn 0.2s ease;white-space:nowrap;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 2000);
    setTimeout(() => toast.remove(), 2400);
  }

  function genId(prefix) {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  }

  function closeModal() {
    const c = document.getElementById('modal-container');
    if (c) c.innerHTML = '';
  }

  function openModal(html) {
    const c = document.getElementById('modal-container');
    if (c) c.innerHTML = html;
  }

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Sports Management ─────────────────────────────────────────────────────
  function renderSports() {
    const sports = DataManager.getSports();
    const hotels = DataManager.getHotels();

    const rows = sports.map((s, i) => {
      const assignedHotels = !s.isSoccer
        ? (s.hotelIds || []).map(hid => {
            const h = DataManager.getHotel(hid);
            return h ? `<span class="tag" style="background:${h.color};font-size:11px">${h.name}</span>` : '';
          }).join('')
        : '<span style="font-size:11px;color:#7f8c8d">会場設定で管理</span>';

      return `
        <tr>
          <td style="padding:8px 10px">
            <div style="display:flex;align-items:center;gap:8px">
              <span class="color-preview" style="background:${s.color}"></span>
              <div>
                <div style="font-weight:600">${esc(s.name)}</div>
                <div style="font-size:11px;color:#7f8c8d">${esc(s.shortName || '')}${s.isSoccer ? ' ⚽' : ''}</div>
              </div>
            </div>
          </td>
          <td style="padding:8px 10px;font-size:12px;font-family:monospace">${esc(s.id)}</td>
          <td style="padding:8px 10px;font-size:12px">${assignedHotels || '<span style="color:#bbb">未割当</span>'}</td>
          <td style="padding:8px 10px">
            <div style="display:flex;gap:6px">
              <button class="btn btn-secondary btn-sm" onclick="AdminApp.showEditSportModal('${esc(s.id)}')">編集</button>
              <button class="btn btn-danger btn-sm" onclick="AdminApp.deleteSport('${esc(s.id)}')">削除</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    document.getElementById('tab-sports').innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>🏅 競技管理</h2>
          <button class="btn btn-primary btn-sm" onclick="AdminApp.showAddSportModal()">＋ 競技を追加</button>
        </div>
        <div class="card-body" style="padding:0;overflow-x:auto">
          <table class="match-table" style="width:100%">
            <thead>
              <tr>
                <th>競技名</th>
                <th>ID</th>
                <th>割当ホテル</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#7f8c8d">競技データがありません</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
  }

  function showAddSportModal() {
    openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)AdminApp.closeModal()">
        <div class="modal modal-wide">
          <div class="modal-header">
            <h3>競技を追加</h3>
            <button class="modal-close" onclick="AdminApp.closeModal()">×</button>
          </div>
          <div class="modal-body">
            ${sportFormFields()}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="AdminApp.closeModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="AdminApp.saveNewSport()">追加</button>
          </div>
        </div>
      </div>`);
  }

  function showEditSportModal(sportId) {
    const s = DataManager.getSport(sportId);
    if (!s) return;
    openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)AdminApp.closeModal()">
        <div class="modal modal-wide">
          <div class="modal-header">
            <h3>${esc(s.name)} を編集</h3>
            <button class="modal-close" onclick="AdminApp.closeModal()">×</button>
          </div>
          <div class="modal-body">
            ${sportFormFields(s)}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="AdminApp.closeModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="AdminApp.saveEditSport('${esc(sportId)}')">保存</button>
          </div>
        </div>
      </div>`);
  }

  function sportFormFields(s) {
    const hotels = DataManager.getHotels();
    const hotelChecks = hotels.map(h => `
      <label class="checkbox-label" style="margin-bottom:6px">
        <input type="checkbox" name="sport-hotel" value="${esc(h.id)}"
          ${s && !s.isSoccer && (s.hotelIds || []).includes(h.id) ? 'checked' : ''}>
        <span class="color-preview" style="background:${h.color}"></span>
        ${esc(h.name)}
      </label>`).join('');

    return `
      <div class="form-row">
        <div class="form-group">
          <label>競技名 *</label>
          <input type="text" id="sf-name" value="${esc(s?.name || '')}" placeholder="例: バスケットボール">
        </div>
        <div class="form-group">
          <label>略称</label>
          <input type="text" id="sf-short" value="${esc(s?.shortName || '')}" placeholder="例: バスケ">
        </div>
      </div>
      ${!s ? `
      <div class="form-group">
        <label>ID（半角英数字・アンダースコア）*</label>
        <input type="text" id="sf-id" value="" placeholder="例: basketball_w" pattern="[a-z0-9_]+">
        <div style="font-size:11px;color:#7f8c8d;margin-top:4px">※ 後から変更できません</div>
      </div>` : ''}
      <div class="form-row">
        <div class="form-group">
          <label>カラー</label>
          <input type="color" id="sf-color" value="${esc(s?.color || '#3498db')}">
        </div>
        <div class="form-group" style="padding-top:22px">
          <label class="checkbox-label">
            <input type="checkbox" id="sf-soccer" ${s?.isSoccer ? 'checked' : ''}>
            ⚽ サッカー特殊モード（会場・グループ管理あり）
          </label>
        </div>
      </div>
      <div class="form-group">
        <label>備考</label>
        <textarea id="sf-note" rows="2">${esc(s?.note || '')}</textarea>
      </div>
      <div class="form-group" id="sf-hotel-section" style="${s?.isSoccer ? 'display:none' : ''}">
        <label>割当ホテル（サッカー以外）</label>
        <div style="display:flex;flex-direction:column;gap:4px;max-height:160px;overflow-y:auto;
             border:1px solid var(--border);border-radius:6px;padding:10px">
          ${hotelChecks || '<span style="color:#7f8c8d;font-size:13px">ホテルデータがありません</span>'}
        </div>
      </div>
      <script>
        document.getElementById('sf-soccer').addEventListener('change', function() {
          document.getElementById('sf-hotel-section').style.display = this.checked ? 'none' : '';
        });
      <\/script>`;
  }

  function saveNewSport() {
    const name = document.getElementById('sf-name').value.trim();
    const idInput = document.getElementById('sf-id').value.trim();
    const shortName = document.getElementById('sf-short').value.trim();
    const color = document.getElementById('sf-color').value;
    const isSoccer = document.getElementById('sf-soccer').checked;
    const note = document.getElementById('sf-note').value;

    if (!name) { alert('競技名を入力してください'); return; }
    if (!idInput || !/^[a-z0-9_]+$/.test(idInput)) {
      alert('IDは半角英数字・アンダースコアのみ使用できます'); return;
    }

    const master = DataManager.getMaster();
    if ((master.sports || []).some(s => s.id === idInput)) {
      alert('このIDはすでに使用されています'); return;
    }

    const hotelIds = isSoccer ? [] :
      [...document.querySelectorAll('input[name="sport-hotel"]:checked')].map(cb => cb.value);

    const newSport = {
      id: idInput,
      name, shortName, isSoccer, color,
      venueIds: [], hotelIds,
      startDate: '', endDate: '', note
    };

    master.sports.push(newSport);
    // Update hotelIds references
    hotelIds.forEach(hid => {
      const s = { ...newSport };
      // Already stored in sport.hotelIds
    });

    localStorage.setItem('hotelScheduleApp_v1', JSON.stringify(master));
    closeModal();
    renderTab('sports');
    showToast('競技を追加しました');
  }

  function saveEditSport(sportId) {
    const name = document.getElementById('sf-name').value.trim();
    const shortName = document.getElementById('sf-short').value.trim();
    const color = document.getElementById('sf-color').value;
    const isSoccer = document.getElementById('sf-soccer').checked;
    const note = document.getElementById('sf-note').value;

    if (!name) { alert('競技名を入力してください'); return; }

    const hotelIds = isSoccer ? [] :
      [...document.querySelectorAll('input[name="sport-hotel"]:checked')].map(cb => cb.value);

    DataManager.updateSport(sportId, { name, shortName, color, isSoccer, hotelIds, note });
    closeModal();
    renderTab('sports');
    showToast('競技情報を保存しました');
  }

  function deleteSport(sportId) {
    const s = DataManager.getSport(sportId);
    if (!s) return;
    if (!confirm(`「${s.name}」を削除しますか？\nこの競技に紐づくスケジュールデータは残ります。`)) return;

    const master = DataManager.getMaster();
    master.sports = master.sports.filter(sp => sp.id !== sportId);
    localStorage.setItem('hotelScheduleApp_v1', JSON.stringify(master));
    renderTab('sports');
    showToast('競技を削除しました', 'warning');
  }

  // ── Hotels Management ─────────────────────────────────────────────────────
  function renderHotels() {
    const hotels = DataManager.getHotels();

    const rows = hotels.map(h => {
      const sports = DataManager.getSportsForHotel(h.id);
      return `
        <tr>
          <td style="padding:8px 10px">
            <div style="display:flex;align-items:center;gap:8px">
              <span class="color-preview" style="background:${h.color}"></span>
              <div>
                <div style="font-weight:600">${esc(h.name)}</div>
                <div style="font-size:11px;color:#7f8c8d">${esc(h.address || '住所未設定')}</div>
              </div>
            </div>
          </td>
          <td style="padding:8px 10px;font-size:12px;font-family:monospace">${esc(h.id)}</td>
          <td style="padding:8px 10px;font-size:12px">${esc(h.tel || '—')}</td>
          <td style="padding:8px 10px;font-size:12px">
            ${sports.map(s => `<span class="tag" style="background:${s.color};font-size:11px">${esc(s.shortName || s.name)}</span>`).join('') || '<span style="color:#bbb">未割当</span>'}
          </td>
          <td style="padding:8px 10px">
            <div style="display:flex;gap:6px">
              <button class="btn btn-secondary btn-sm" onclick="AdminApp.showEditHotelModal('${esc(h.id)}')">編集</button>
              <button class="btn btn-danger btn-sm" onclick="AdminApp.deleteHotel('${esc(h.id)}')">削除</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    document.getElementById('tab-hotels').innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>🏨 ホテル管理</h2>
          <button class="btn btn-primary btn-sm" onclick="AdminApp.showAddHotelModal()">＋ ホテルを追加</button>
        </div>
        <div class="card-body" style="padding:0;overflow-x:auto">
          <table class="match-table" style="width:100%">
            <thead>
              <tr><th>ホテル名</th><th>ID</th><th>電話</th><th>担当競技</th><th></th></tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#7f8c8d">ホテルデータがありません</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
  }

  function hotelFormFields(h) {
    const sports = DataManager.getSports().filter(s => !s.isSoccer);
    const sportChecks = sports.map(s => `
      <label class="checkbox-label" style="margin-bottom:6px">
        <input type="checkbox" name="hotel-sport" value="${esc(s.id)}"
          ${h && (s.hotelIds || []).includes(h.id) ? 'checked' : ''}>
        <span class="color-preview" style="background:${s.color}"></span>
        ${esc(s.name)}
      </label>`).join('');

    return `
      ${!h ? `
      <div class="form-group">
        <label>ID（半角英数字・アンダースコア）*</label>
        <input type="text" id="hf-id" value="" placeholder="例: hotel_nagoya_grand" pattern="[a-z0-9_]+">
        <div style="font-size:11px;color:#7f8c8d;margin-top:4px">※ 後から変更できません</div>
      </div>` : ''}
      <div class="form-group">
        <label>ホテル名 *</label>
        <input type="text" id="hf-name" value="${esc(h?.name || '')}" placeholder="例: ナゴヤグランドホテル">
      </div>
      <div class="form-group">
        <label>住所</label>
        <input type="text" id="hf-address" value="${esc(h?.address || '')}" placeholder="例: 愛知県名古屋市中村区...">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>電話番号</label>
          <input type="text" id="hf-tel" value="${esc(h?.tel || '')}" placeholder="052-000-0000">
        </div>
        <div class="form-group">
          <label>カラー</label>
          <input type="color" id="hf-color" value="${esc(h?.color || '#3498db')}">
        </div>
      </div>
      <div class="form-group">
        <label>備考</label>
        <textarea id="hf-note" rows="2">${esc(h?.note || '')}</textarea>
      </div>
      <div class="form-group">
        <label>担当競技（サッカー以外）</label>
        <div style="display:flex;flex-direction:column;gap:4px;max-height:160px;overflow-y:auto;
             border:1px solid var(--border);border-radius:6px;padding:10px">
          ${sportChecks || '<span style="color:#7f8c8d;font-size:13px">競技データがありません</span>'}
        </div>
        <div style="font-size:11px;color:#7f8c8d;margin-top:4px">
          ※ サッカーの担当設定は「会場管理」で行います
        </div>
      </div>`;
  }

  function showAddHotelModal() {
    openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)AdminApp.closeModal()">
        <div class="modal modal-wide">
          <div class="modal-header">
            <h3>ホテルを追加</h3>
            <button class="modal-close" onclick="AdminApp.closeModal()">×</button>
          </div>
          <div class="modal-body">${hotelFormFields(null)}</div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="AdminApp.closeModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="AdminApp.saveNewHotel()">追加</button>
          </div>
        </div>
      </div>`);
  }

  function showEditHotelModal(hotelId) {
    const h = DataManager.getHotel(hotelId);
    if (!h) return;
    openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)AdminApp.closeModal()">
        <div class="modal modal-wide">
          <div class="modal-header">
            <h3>${esc(h.name)} を編集</h3>
            <button class="modal-close" onclick="AdminApp.closeModal()">×</button>
          </div>
          <div class="modal-body">${hotelFormFields(h)}</div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="AdminApp.closeModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="AdminApp.saveEditHotel('${esc(hotelId)}')">保存</button>
          </div>
        </div>
      </div>`);
  }

  function saveNewHotel() {
    const idInput = document.getElementById('hf-id').value.trim();
    const name = document.getElementById('hf-name').value.trim();
    const address = document.getElementById('hf-address').value.trim();
    const tel = document.getElementById('hf-tel').value.trim();
    const color = document.getElementById('hf-color').value;
    const note = document.getElementById('hf-note').value;

    if (!name) { alert('ホテル名を入力してください'); return; }
    if (!idInput || !/^[a-z0-9_]+$/.test(idInput)) {
      alert('IDは半角英数字・アンダースコアのみ使用できます'); return;
    }

    const master = DataManager.getMaster();
    if ((master.hotels || []).some(h => h.id === idInput)) {
      alert('このIDはすでに使用されています'); return;
    }

    const newHotel = { id: idInput, name, address, tel, color, sportIds: [], note };
    master.hotels.push(newHotel);

    // Update sport.hotelIds
    const checkedSportIds = [...document.querySelectorAll('input[name="hotel-sport"]:checked')].map(cb => cb.value);
    checkedSportIds.forEach(sid => {
      const sport = (master.sports || []).find(s => s.id === sid);
      if (sport && !(sport.hotelIds || []).includes(idInput)) {
        sport.hotelIds = [...(sport.hotelIds || []), idInput];
      }
    });

    localStorage.setItem('hotelScheduleApp_v1', JSON.stringify(master));
    closeModal();
    renderTab('hotels');
    showToast('ホテルを追加しました');
  }

  function saveEditHotel(hotelId) {
    const name = document.getElementById('hf-name').value.trim();
    const address = document.getElementById('hf-address').value.trim();
    const tel = document.getElementById('hf-tel').value.trim();
    const color = document.getElementById('hf-color').value;
    const note = document.getElementById('hf-note').value;

    if (!name) { alert('ホテル名を入力してください'); return; }

    DataManager.updateHotel(hotelId, { name, address, tel, color, note });

    // Update sport assignments
    const master = DataManager.getMaster();
    const checkedSportIds = [...document.querySelectorAll('input[name="hotel-sport"]:checked')].map(cb => cb.value);
    const uncheckedSportIds = [...document.querySelectorAll('input[name="hotel-sport"]:not(:checked)')].map(cb => cb.value);

    checkedSportIds.forEach(sid => {
      const sport = (master.sports || []).find(s => s.id === sid);
      if (sport && !(sport.hotelIds || []).includes(hotelId)) {
        sport.hotelIds = [...(sport.hotelIds || []), hotelId];
      }
    });
    uncheckedSportIds.forEach(sid => {
      const sport = (master.sports || []).find(s => s.id === sid);
      if (sport) {
        sport.hotelIds = (sport.hotelIds || []).filter(h => h !== hotelId);
      }
    });

    localStorage.setItem('hotelScheduleApp_v1', JSON.stringify(master));
    closeModal();
    renderTab('hotels');
    showToast('ホテル情報を保存しました');
  }

  function deleteHotel(hotelId) {
    const h = DataManager.getHotel(hotelId);
    if (!h) return;
    if (!confirm(`「${h.name}」を削除しますか？`)) return;

    const master = DataManager.getMaster();
    master.hotels = master.hotels.filter(ho => ho.id !== hotelId);
    // Remove from sport.hotelIds
    (master.sports || []).forEach(s => {
      s.hotelIds = (s.hotelIds || []).filter(hid => hid !== hotelId);
    });
    // Remove from venue.hotelId
    (master.venues || []).forEach(v => {
      if (v.hotelId === hotelId) v.hotelId = '';
    });

    localStorage.setItem('hotelScheduleApp_v1', JSON.stringify(master));
    renderTab('hotels');
    showToast('ホテルを削除しました', 'warning');
  }

  // ── Venues Management ─────────────────────────────────────────────────────
  function renderVenues() {
    const venues = DataManager.getVenues();
    const sports = DataManager.getSports();
    const hotels = DataManager.getHotels();

    const rows = venues.map(v => {
      const sport = DataManager.getSport(v.sportId);
      const hotel = v.hotelId ? DataManager.getHotel(v.hotelId) : null;
      return `
        <tr>
          <td style="padding:8px 10px;font-weight:600">${esc(v.name)}</td>
          <td style="padding:8px 10px;font-size:12px;font-family:monospace">${esc(v.id)}</td>
          <td style="padding:8px 10px;font-size:12px">
            ${sport ? `<span class="tag" style="background:${sport.color};font-size:11px">${esc(sport.shortName || sport.name)}</span>` : '<span style="color:#bbb">未設定</span>'}
          </td>
          <td style="padding:8px 10px;font-size:12px">
            ${hotel ? `<span class="tag" style="background:${hotel.color};font-size:11px">${esc(hotel.name)}</span>` : '<span style="color:#bbb">未設定</span>'}
          </td>
          <td style="padding:8px 10px;font-size:12px">${esc(v.address || '—')}</td>
          <td style="padding:8px 10px">
            <div style="display:flex;gap:6px">
              <button class="btn btn-secondary btn-sm" onclick="AdminApp.showEditVenueModal('${esc(v.id)}')">編集</button>
              <button class="btn btn-danger btn-sm" onclick="AdminApp.deleteVenue('${esc(v.id)}')">削除</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    document.getElementById('tab-venues').innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>📍 会場管理</h2>
          <button class="btn btn-primary btn-sm" onclick="AdminApp.showAddVenueModal()">＋ 会場を追加</button>
        </div>
        <div class="card-body" style="padding:0;overflow-x:auto">
          <table class="match-table" style="width:100%">
            <thead>
              <tr><th>会場名</th><th>ID</th><th>担当競技</th><th>担当ホテル</th><th>住所</th><th></th></tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="6" style="padding:20px;text-align:center;color:#7f8c8d">会場データがありません</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
  }

  function venueFormFields(v) {
    const sports = DataManager.getSports();
    const hotels = DataManager.getHotels();

    const sportOptions = sports.map(s =>
      `<option value="${esc(s.id)}" ${v?.sportId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`
    ).join('');

    const hotelOptions = hotels.map(h =>
      `<option value="${esc(h.id)}" ${v?.hotelId === h.id ? 'selected' : ''}>${esc(h.name)}</option>`
    ).join('');

    return `
      ${!v ? `
      <div class="form-group">
        <label>ID（半角英数字・アンダースコア）*</label>
        <input type="text" id="vf-id" value="" placeholder="例: venue_nagoya_dome" pattern="[a-z0-9_]+">
        <div style="font-size:11px;color:#7f8c8d;margin-top:4px">※ 後から変更できません</div>
      </div>` : ''}
      <div class="form-group">
        <label>会場名 *</label>
        <input type="text" id="vf-name" value="${esc(v?.name || '')}" placeholder="例: 名古屋ドーム">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>担当競技</label>
          <select id="vf-sport">
            <option value="">-- 未設定 --</option>
            ${sportOptions}
          </select>
        </div>
        <div class="form-group">
          <label>担当ホテル</label>
          <select id="vf-hotel">
            <option value="">-- 未設定 --</option>
            ${hotelOptions}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>住所</label>
        <input type="text" id="vf-address" value="${esc(v?.address || '')}" placeholder="例: 愛知県名古屋市東区...">
      </div>
      <div class="form-group">
        <label>備考</label>
        <textarea id="vf-note" rows="2">${esc(v?.note || '')}</textarea>
      </div>`;
  }

  function showAddVenueModal() {
    openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)AdminApp.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <h3>会場を追加</h3>
            <button class="modal-close" onclick="AdminApp.closeModal()">×</button>
          </div>
          <div class="modal-body">${venueFormFields(null)}</div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="AdminApp.closeModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="AdminApp.saveNewVenue()">追加</button>
          </div>
        </div>
      </div>`);
  }

  function showEditVenueModal(venueId) {
    const v = DataManager.getVenue(venueId);
    if (!v) return;
    openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)AdminApp.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <h3>${esc(v.name)} を編集</h3>
            <button class="modal-close" onclick="AdminApp.closeModal()">×</button>
          </div>
          <div class="modal-body">${venueFormFields(v)}</div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="AdminApp.closeModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="AdminApp.saveEditVenue('${esc(venueId)}')">保存</button>
          </div>
        </div>
      </div>`);
  }

  function saveNewVenue() {
    const idInput = document.getElementById('vf-id').value.trim();
    const name = document.getElementById('vf-name').value.trim();
    const sportId = document.getElementById('vf-sport').value;
    const hotelId = document.getElementById('vf-hotel').value;
    const address = document.getElementById('vf-address').value.trim();
    const note = document.getElementById('vf-note').value;

    if (!name) { alert('会場名を入力してください'); return; }
    if (!idInput || !/^[a-z0-9_]+$/.test(idInput)) {
      alert('IDは半角英数字・アンダースコアのみ使用できます'); return;
    }

    const master = DataManager.getMaster();
    if ((master.venues || []).some(v => v.id === idInput)) {
      alert('このIDはすでに使用されています'); return;
    }

    const newVenue = { id: idInput, name, sportId, hotelId, address, note };
    master.venues = [...(master.venues || []), newVenue];

    // Add venue to sport.venueIds if a sport is selected
    if (sportId) {
      const sport = (master.sports || []).find(s => s.id === sportId);
      if (sport && !(sport.venueIds || []).includes(idInput)) {
        sport.venueIds = [...(sport.venueIds || []), idInput];
      }
    }

    localStorage.setItem('hotelScheduleApp_v1', JSON.stringify(master));
    closeModal();
    renderTab('venues');
    showToast('会場を追加しました');
  }

  function saveEditVenue(venueId) {
    const name = document.getElementById('vf-name').value.trim();
    const sportId = document.getElementById('vf-sport').value;
    const hotelId = document.getElementById('vf-hotel').value;
    const address = document.getElementById('vf-address').value.trim();
    const note = document.getElementById('vf-note').value;

    if (!name) { alert('会場名を入力してください'); return; }

    const master = DataManager.getMaster();
    const venue = (master.venues || []).find(v => v.id === venueId);
    if (!venue) return;

    const oldSportId = venue.sportId;

    // Remove venue from old sport's venueIds
    if (oldSportId && oldSportId !== sportId) {
      const oldSport = (master.sports || []).find(s => s.id === oldSportId);
      if (oldSport) {
        oldSport.venueIds = (oldSport.venueIds || []).filter(vid => vid !== venueId);
      }
    }

    // Add venue to new sport's venueIds
    if (sportId && sportId !== oldSportId) {
      const newSport = (master.sports || []).find(s => s.id === sportId);
      if (newSport && !(newSport.venueIds || []).includes(venueId)) {
        newSport.venueIds = [...(newSport.venueIds || []), venueId];
      }
    }

    DataManager.updateVenue(venueId, { name, sportId, hotelId, address, note });
    closeModal();
    renderTab('venues');
    showToast('会場情報を保存しました');
  }

  function deleteVenue(venueId) {
    const v = DataManager.getVenue(venueId);
    if (!v) return;
    if (!confirm(`「${v.name}」を削除しますか？`)) return;

    const master = DataManager.getMaster();
    master.venues = master.venues.filter(ve => ve.id !== venueId);
    // Remove from sport.venueIds
    (master.sports || []).forEach(s => {
      s.venueIds = (s.venueIds || []).filter(vid => vid !== venueId);
    });

    localStorage.setItem('hotelScheduleApp_v1', JSON.stringify(master));
    renderTab('venues');
    showToast('会場を削除しました', 'warning');
  }

  // ── Categories Management ─────────────────────────────────────────────────
  function renderCategories() {
    const cats = DataManager.getCategories();

    const rows = cats.map((c, i) => `
      <tr>
        <td style="padding:8px 10px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:${c.color};flex-shrink:0"></span>
            <span style="font-weight:600">${esc(c.name)}</span>
          </div>
        </td>
        <td style="padding:8px 10px;font-size:12px;font-family:monospace">${esc(c.id)}</td>
        <td style="padding:8px 10px;font-size:12px">${esc(c.color)}</td>
        <td style="padding:8px 10px">
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm" onclick="AdminApp.showEditCategoryModal(${i})">編集</button>
            <button class="btn btn-danger btn-sm" onclick="AdminApp.deleteCategory(${i})">削除</button>
          </div>
        </td>
      </tr>`).join('');

    document.getElementById('tab-categories').innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>🏷 イベントカテゴリ管理</h2>
          <button class="btn btn-primary btn-sm" onclick="AdminApp.showAddCategoryModal()">＋ カテゴリを追加</button>
        </div>
        <div class="card-body" style="padding:0">
          <table class="match-table" style="width:100%">
            <thead>
              <tr><th>カテゴリ名</th><th>ID</th><th>カラーコード</th><th></th></tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#7f8c8d">カテゴリがありません</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div class="alert alert-info mt-2">
        ℹ イベントカテゴリはスケジュール画面でイベントを登録する際に使用されます。
      </div>`;
  }

  function categoryFormFields(c) {
    return `
      ${!c ? `
      <div class="form-group">
        <label>ID（半角英数字・アンダースコア）*</label>
        <input type="text" id="cf-id" value="" placeholder="例: ceremony" pattern="[a-z0-9_]+">
        <div style="font-size:11px;color:#7f8c8d;margin-top:4px">※ 後から変更できません</div>
      </div>` : ''}
      <div class="form-row">
        <div class="form-group">
          <label>カテゴリ名 *</label>
          <input type="text" id="cf-name" value="${esc(c?.name || '')}" placeholder="例: 開会式">
        </div>
        <div class="form-group">
          <label>カラー</label>
          <input type="color" id="cf-color" value="${esc(c?.color || '#3498db')}">
        </div>
      </div>`;
  }

  function showAddCategoryModal() {
    openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)AdminApp.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <h3>カテゴリを追加</h3>
            <button class="modal-close" onclick="AdminApp.closeModal()">×</button>
          </div>
          <div class="modal-body">${categoryFormFields(null)}</div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="AdminApp.closeModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="AdminApp.saveNewCategory()">追加</button>
          </div>
        </div>
      </div>`);
  }

  function showEditCategoryModal(index) {
    const c = DataManager.getCategories()[index];
    if (!c) return;
    openModal(`
      <div class="modal-overlay" onclick="if(event.target===this)AdminApp.closeModal()">
        <div class="modal">
          <div class="modal-header">
            <h3>${esc(c.name)} を編集</h3>
            <button class="modal-close" onclick="AdminApp.closeModal()">×</button>
          </div>
          <div class="modal-body">${categoryFormFields(c)}</div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="AdminApp.closeModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="AdminApp.saveEditCategory(${index})">保存</button>
          </div>
        </div>
      </div>`);
  }

  function saveNewCategory() {
    const idInput = document.getElementById('cf-id').value.trim();
    const name = document.getElementById('cf-name').value.trim();
    const color = document.getElementById('cf-color').value;

    if (!name) { alert('カテゴリ名を入力してください'); return; }
    if (!idInput || !/^[a-z0-9_]+$/.test(idInput)) {
      alert('IDは半角英数字・アンダースコアのみ使用できます'); return;
    }

    const master = DataManager.getMaster();
    if ((master.eventCategories || []).some(c => c.id === idInput)) {
      alert('このIDはすでに使用されています'); return;
    }

    master.eventCategories = [...(master.eventCategories || []), { id: idInput, name, color }];
    localStorage.setItem('hotelScheduleApp_v1', JSON.stringify(master));
    closeModal();
    renderTab('categories');
    showToast('カテゴリを追加しました');
  }

  function saveEditCategory(index) {
    const name = document.getElementById('cf-name').value.trim();
    const color = document.getElementById('cf-color').value;

    if (!name) { alert('カテゴリ名を入力してください'); return; }

    const master = DataManager.getMaster();
    if (!master.eventCategories || !master.eventCategories[index]) return;
    master.eventCategories[index] = { ...master.eventCategories[index], name, color };
    localStorage.setItem('hotelScheduleApp_v1', JSON.stringify(master));
    closeModal();
    renderTab('categories');
    showToast('カテゴリを保存しました');
  }

  function deleteCategory(index) {
    const cats = DataManager.getCategories();
    const c = cats[index];
    if (!c) return;
    if (!confirm(`「${c.name}」を削除しますか？`)) return;

    const master = DataManager.getMaster();
    master.eventCategories.splice(index, 1);
    localStorage.setItem('hotelScheduleApp_v1', JSON.stringify(master));
    renderTab('categories');
    showToast('カテゴリを削除しました', 'warning');
  }

  // ── Date Range Settings ───────────────────────────────────────────────────
  function renderDateRange() {
    const dr = DataManager.getDateRange();

    document.getElementById('tab-daterange').innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>📅 全体期間設定</h2>
        </div>
        <div class="card-body">
          <p style="font-size:13px;color:#7f8c8d;margin-bottom:20px">
            スケジュール管理システム全体の対象期間を設定します。<br>
            この期間がスケジュールグリッドの表示範囲の基準になります。
          </p>
          <div class="form-row" style="max-width:500px">
            <div class="form-group">
              <label>開始日 *</label>
              <input type="date" id="dr-start" value="${esc(dr.start)}">
            </div>
            <div class="form-group">
              <label>終了日 *</label>
              <input type="date" id="dr-end" value="${esc(dr.end)}">
            </div>
          </div>
          <div style="margin-top:8px">
            <button class="btn btn-primary" onclick="AdminApp.saveDateRange()">期間を保存</button>
          </div>
        </div>
      </div>

      <div class="card mt-2">
        <div class="card-header">
          <h2>💾 マスターデータのリセット</h2>
        </div>
        <div class="card-body">
          <p style="font-size:13px;color:#7f8c8d;margin-bottom:16px">
            ローカルストレージのマスターデータを初期状態（埋め込みデータ）にリセットします。<br>
            競技・ホテル・会場の設定がすべて元に戻ります。スケジュールデータは残ります。
          </p>
          <button class="btn btn-danger" onclick="AdminApp.resetMasterData()">
            ⚠ マスターデータを初期化する
          </button>
        </div>
      </div>`;
  }

  function saveDateRange() {
    const start = document.getElementById('dr-start').value;
    const end = document.getElementById('dr-end').value;

    if (!start || !end) { alert('開始日と終了日を入力してください'); return; }
    if (start > end) { alert('終了日は開始日より後にしてください'); return; }

    const master = DataManager.getMaster();
    master.dateRange = { start, end };
    localStorage.setItem('hotelScheduleApp_v1', JSON.stringify(master));
    showToast('期間を保存しました');
  }

  function resetMasterData() {
    if (!confirm('マスターデータを初期状態にリセットしますか？\n競技・ホテル・会場の設定がすべて元に戻ります。')) return;
    localStorage.removeItem('hotelScheduleApp_v1');
    location.reload();
  }

  return {
    init,
    switchMainTab,
    closeModal,
    // Sports
    showAddSportModal, showEditSportModal,
    saveNewSport, saveEditSport, deleteSport,
    // Hotels
    showAddHotelModal, showEditHotelModal,
    saveNewHotel, saveEditHotel, deleteHotel,
    // Venues
    showAddVenueModal, showEditVenueModal,
    saveNewVenue, saveEditVenue, deleteVenue,
    // Categories
    showAddCategoryModal, showEditCategoryModal,
    saveNewCategory, saveEditCategory, deleteCategory,
    // Date range
    saveDateRange, resetMasterData,
  };
})();

window.addEventListener('DOMContentLoaded', () => AdminApp.init());
