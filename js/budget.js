/**
 * budget.js - Budget management UI controller
 *
 * Views:
 *   dashboard      - Grand total KPIs + per-hotel / per-category summary tables
 *   hotels         - Hotel card list with add button
 *   hotel_detail   - Per-hotel detail with 4 sub-tabs:
 *                    基本情報 / 客室契約 / 費用明細 / サマリー
 */
const BudgetApp = (() => {

  // ── Master data ───────────────────────────────────────────────────────────
  const CATEGORIES = {
    room:         { label: '客室料金',           color: '#3498db' },
    function:     { label: 'ファンクションルーム', color: '#9b59b6' },
    meal:         { label: '食費',               color: '#f39c12' },
    compensation: { label: '営業補償費',          color: '#e74c3c' },
    other:        { label: 'その他',             color: '#7f8c8d' },
  };

  const USER_GROUPS = {
    athletes:  '選手団',
    technical: '技術役員',
    family:    'ファミリー',
    sponsor:   'スポンサー',
    media:     'メディア',
    wf:        'WF',
  };

  // ── State ─────────────────────────────────────────────────────────────────
  let currentView    = 'dashboard';
  let currentHotelId = null;
  let currentHotelTab = 'basic';

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    await DataManager.init();   // master hotel data
    BudgetData.init();
    renderView();
  }

  // ── Routing ───────────────────────────────────────────────────────────────
  function navigate(view, hotelId) {
    currentView     = view;
    currentHotelId  = hotelId || null;
    currentHotelTab = 'basic';
    renderView();
    _updateMainTabs();
  }

  function _updateMainTabs() {
    const tabs = ['dashboard', 'hotels'];
    document.querySelectorAll('#main-tabs .main-tab-btn').forEach((btn, i) => {
      const active = tabs[i] === currentView ||
                     (currentView === 'hotel_detail' && tabs[i] === 'hotels');
      btn.classList.toggle('active', active);
    });
  }

  function renderView() {
    const el = document.getElementById('budget-content');
    if (!el) return;
    switch (currentView) {
      case 'dashboard':    el.innerHTML = renderDashboard();           break;
      case 'hotels':       el.innerHTML = renderHotelList();           break;
      case 'hotel_detail': el.innerHTML = renderHotelDetail(currentHotelId); break;
    }
    _updateMainTabs();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmt(n) {
    return '¥' + Math.round(+n || 0).toLocaleString('ja-JP');
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function varStyle(v) {
    return v >= 0 ? 'color:#27ae60' : 'color:#e74c3c';
  }

  function varStr(v) {
    return (v >= 0 ? '+' : '') + fmt(v);
  }

  function groupTags(groups) {
    return (groups || []).map(g =>
      `<span class="group-tag">${esc(USER_GROUPS[g] || g)}</span>`
    ).join('');
  }

  function catDot(category) {
    const c = CATEGORIES[category] || CATEGORIES.other;
    return `<span class="cat-dot" style="background:${c.color}"></span>${esc(c.label)}`;
  }

  function showToast(msg, type = 'success') {
    const colors = { success: '#27ae60', warning: '#f39c12', error: '#e74c3c' };
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
      background:${colors[type] || colors.success};color:white;
      padding:10px 24px;border-radius:24px;font-size:13px;font-weight:600;
      box-shadow:0 4px 16px rgba(0,0,0,0.2);z-index:9999;white-space:nowrap;`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }, 2200);
    setTimeout(() => el.remove(), 2600);
  }

  function closeModal() { document.getElementById('modal-container').innerHTML = ''; }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  function renderDashboard() {
    const gt = BudgetData.grandTotals();
    const tv = gt.budget - gt.contract;
    const hotels = BudgetData.getHotels();
    const catT   = BudgetData.categoryTotals();
    const grpT   = BudgetData.userGroupTotals();

    // KPI cards
    const kpis = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">予算合計</div>
          <div class="kpi-value" style="color:#2c3e50">${fmt(gt.budget)}</div>
          <div class="kpi-sub">${hotels.length} ホテル</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">契約合計</div>
          <div class="kpi-value" style="color:#3498db">${fmt(gt.contract)}</div>
          <div class="kpi-sub">予算比 ${gt.budget ? Math.round(gt.contract/gt.budget*100) : 0}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">実績合計</div>
          <div class="kpi-value" style="color:#27ae60">${fmt(gt.actual)}</div>
          <div class="kpi-sub">契約比 ${gt.contract ? Math.round(gt.actual/gt.contract*100) : 0}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">乖離（予算 − 契約）</div>
          <div class="kpi-value" style="${varStyle(tv)}">${varStr(tv)}</div>
          <div class="kpi-sub" style="${varStyle(tv)}">${tv >= 0 ? '予算内' : '予算超過'}</div>
        </div>
      </div>`;

    // Per-hotel table
    const hotelRows = hotels.map(h => {
      const t = BudgetData.hotelTotals(h.id);
      const v = t.budget - t.contract;
      return `
        <tr style="cursor:pointer" onclick="BudgetApp.navigate('hotel_detail','${esc(h.id)}')">
          <td style="padding:8px 10px">
            <div style="font-weight:600">${esc(h.name)}</div>
            <div style="margin-top:2px">${groupTags(h.userGroups)}</div>
          </td>
          <td style="padding:8px 10px;font-size:12px;color:#7f8c8d">
            ${h.contractStart ? esc(h.contractStart) + ' ～ ' + esc(h.contractEnd) : '—'}
          </td>
          <td style="padding:8px 10px;text-align:right">${fmt(t.budget)}</td>
          <td style="padding:8px 10px;text-align:right;color:#3498db">${fmt(t.contract)}</td>
          <td style="padding:8px 10px;text-align:right;color:#27ae60">${fmt(t.actual)}</td>
          <td style="padding:8px 10px;text-align:right;${varStyle(v)}">${varStr(v)}</td>
          <td style="padding:8px 10px">
            <span style="font-size:11px;color:#7f8c8d">→</span>
          </td>
        </tr>`;
    }).join('');

    // Per-category table
    const catRows = Object.entries(CATEGORIES).map(([key, cat]) => {
      const t = catT[key];
      if (!t || (t.budget === 0 && t.contract === 0 && t.actual === 0)) return '';
      const v = t.budget - t.contract;
      return `
        <tr>
          <td style="padding:8px 10px">${catDot(key)}</td>
          <td style="padding:8px 10px;text-align:right">${fmt(t.budget)}</td>
          <td style="padding:8px 10px;text-align:right;color:#3498db">${fmt(t.contract)}</td>
          <td style="padding:8px 10px;text-align:right;color:#27ae60">${fmt(t.actual)}</td>
          <td style="padding:8px 10px;text-align:right;${varStyle(v)}">${varStr(v)}</td>
        </tr>`;
    }).join('');

    // Per-user-group table
    const grpRows = Object.entries(USER_GROUPS).map(([key, label]) => {
      const t = grpT[key];
      if (!t) return '';
      const v = t.budget - t.contract;
      return `
        <tr>
          <td style="padding:8px 10px;font-weight:600">${esc(label)}</td>
          <td style="padding:8px 10px;text-align:right">${fmt(t.budget)}</td>
          <td style="padding:8px 10px;text-align:right;color:#3498db">${fmt(t.contract)}</td>
          <td style="padding:8px 10px;text-align:right;color:#27ae60">${fmt(t.actual)}</td>
          <td style="padding:8px 10px;text-align:right;${varStyle(v)}">${varStr(v)}</td>
        </tr>`;
    }).join('');

    const noData = '<tr><td colspan="6" style="padding:24px;text-align:center;color:#7f8c8d">データがありません。「ホテル一覧」からホテルを追加してください。</td></tr>';
    const noDataShort = '<tr><td colspan="5" style="padding:16px;text-align:center;color:#7f8c8d">データなし</td></tr>';

    return `
      <h2 class="page-title">📊 予算ダッシュボード</h2>
      ${kpis}

      <div class="card mb-2">
        <div class="card-header">
          <h2>ホテル別集計</h2>
          <button class="btn btn-primary btn-sm" onclick="BudgetApp.navigate('hotels')">ホテル一覧へ →</button>
        </div>
        <div class="card-body" style="padding:0;overflow-x:auto">
          <table class="match-table" style="width:100%">
            <thead>
              <tr>
                <th>ホテル名 / 利用区分</th>
                <th>契約期間</th>
                <th style="text-align:right">予算</th>
                <th style="text-align:right">契約</th>
                <th style="text-align:right">実績</th>
                <th style="text-align:right">乖離（予−契）</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${hotelRows || noData}</tbody>
          </table>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card">
          <div class="card-header"><h2>費用区分別集計</h2></div>
          <div class="card-body" style="padding:0">
            <table class="match-table" style="width:100%">
              <thead>
                <tr>
                  <th>費用区分</th>
                  <th style="text-align:right">予算</th>
                  <th style="text-align:right">契約</th>
                  <th style="text-align:right">実績</th>
                  <th style="text-align:right">乖離</th>
                </tr>
              </thead>
              <tbody>${catRows || noDataShort}</tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>利用区分別集計</h2>
            <span style="font-size:11px;color:#7f8c8d">※複数区分のホテルは按分</span>
          </div>
          <div class="card-body" style="padding:0">
            <table class="match-table" style="width:100%">
              <thead>
                <tr>
                  <th>利用区分</th>
                  <th style="text-align:right">予算</th>
                  <th style="text-align:right">契約</th>
                  <th style="text-align:right">実績</th>
                  <th style="text-align:right">乖離</th>
                </tr>
              </thead>
              <tbody>${grpRows || noDataShort}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  // ── Hotel List ────────────────────────────────────────────────────────────
  function renderHotelList() {
    const hotels = BudgetData.getHotels();

    const cards = hotels.map(h => {
      const t = BudgetData.hotelTotals(h.id);
      const v = t.budget - t.contract;
      const rcCount = h.roomContracts.length;
      const costCount = h.costs.length;
      return `
        <div class="hotel-card">
          <div class="hotel-card-body" onclick="BudgetApp.navigate('hotel_detail','${esc(h.id)}')">
            <div style="min-width:0">
              <div class="hotel-name">${esc(h.name)}</div>
              <div style="margin:4px 0">${groupTags(h.userGroups) || '<span style="color:#bbb;font-size:12px">利用区分未設定</span>'}</div>
              ${h.contractStart ? `
              <div style="font-size:11px;color:#7f8c8d;margin-top:4px">
                📅 ${esc(h.contractStart)} ～ ${esc(h.contractEnd)}
              </div>` : ''}
              <div style="font-size:11px;color:#7f8c8d;margin-top:4px">
                客室タイプ ${rcCount} 種 ／ 費用明細 ${costCount} 件
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:11px;color:#7f8c8d">予算</div>
              <div style="font-size:18px;font-weight:700;white-space:nowrap">${fmt(t.budget)}</div>
              <div style="font-size:12px;color:#3498db;margin-top:2px">契約 ${fmt(t.contract)}</div>
              <div style="font-size:12px;${varStyle(v)};margin-top:2px">乖離 ${varStr(v)}</div>
            </div>
          </div>
          <div class="hotel-card-footer">
            <button class="btn btn-secondary btn-sm" onclick="BudgetApp.navigate('hotel_detail','${esc(h.id)}')">
              詳細・編集
            </button>
            <button class="btn btn-danger btn-sm" onclick="BudgetApp.confirmDeleteHotel('${esc(h.id)}')">
              削除
            </button>
          </div>
        </div>`;
    }).join('');

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h2 class="page-title" style="margin:0">🏨 ホテル一覧</h2>
        <button class="btn btn-primary" onclick="BudgetApp.showAddHotelModal()">＋ ホテルを追加</button>
      </div>
      ${hotels.length === 0 ? `
        <div class="card">
          <div class="card-body" style="text-align:center;padding:48px;color:#7f8c8d">
            <div style="font-size:40px;margin-bottom:12px">🏨</div>
            <div>ホテルがありません。「ホテルを追加」ボタンから作成してください。</div>
          </div>
        </div>` : `
        <div class="hotel-grid">${cards}</div>`}`;
  }

  // ── Hotel Detail ──────────────────────────────────────────────────────────
  function renderHotelDetail(hotelId) {
    const h = BudgetData.getHotel(hotelId);
    if (!h) return '<p class="text-muted text-center" style="padding:40px">ホテルが見つかりません</p>';

    const t   = BudgetData.hotelTotals(hotelId);
    const tv  = t.budget - t.contract;

    const tabContents = {
      basic:   renderBasicInfo(h),
      rooms:   renderRoomContracts(h),
      costs:   renderCostItems(h),
      summary: renderHotelSummary(h),
    };

    const tabs = [
      { key: 'basic',   label: '基本情報' },
      { key: 'rooms',   label: '客室契約' },
      { key: 'costs',   label: '費用明細' },
      { key: 'summary', label: 'サマリー' },
    ];

    const tabBar = tabs.map(tab => `
      <button class="tab-btn ${currentHotelTab === tab.key ? 'active' : ''}"
        onclick="BudgetApp.switchHotelTab('${esc(hotelId)}','${tab.key}')">
        ${tab.label}
      </button>`).join('');

    return `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="BudgetApp.navigate('hotels')">← 一覧に戻る</button>
        <h2 class="page-title" style="margin:0;flex:1">${esc(h.name)}</h2>
        <div style="font-size:13px;white-space:nowrap">
          予算 <strong>${fmt(t.budget)}</strong>
          &nbsp;／&nbsp;
          契約 <strong style="color:#3498db">${fmt(t.contract)}</strong>
          &nbsp;／&nbsp;
          乖離 <strong style="${varStyle(tv)}">${varStr(tv)}</strong>
        </div>
      </div>

      <div class="tab-bar">${tabBar}</div>
      <div id="hotel-tab-content">${tabContents[currentHotelTab]}</div>`;
  }

  function switchHotelTab(hotelId, tab) {
    currentHotelTab = tab;
    const content = document.getElementById('hotel-tab-content');
    if (!content) return;

    document.querySelectorAll('.tab-bar .tab-btn').forEach((btn, i) => {
      const tabs = ['basic', 'rooms', 'costs', 'summary'];
      btn.classList.toggle('active', tabs[i] === tab);
    });

    const h = BudgetData.getHotel(hotelId);
    if (!h) return;
    switch (tab) {
      case 'basic':   content.innerHTML = renderBasicInfo(h);        break;
      case 'rooms':   content.innerHTML = renderRoomContracts(h);    break;
      case 'costs':   content.innerHTML = renderCostItems(h);        break;
      case 'summary': content.innerHTML = renderHotelSummary(h);     break;
    }
  }

  // ── 基本情報 tab ──────────────────────────────────────────────────────────
  function renderBasicInfo(h) {
    const groupChecks = Object.entries(USER_GROUPS).map(([key, label]) => `
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;
                    padding:4px 8px;border-radius:4px;user-select:none">
        <input type="checkbox" name="bi-group" value="${key}"
          ${(h.userGroups || []).includes(key) ? 'checked' : ''}>
        ${esc(label)}
      </label>`).join('');

    return `
      <div class="card">
        <div class="card-header">
          <h2>基本情報</h2>
          <button class="btn btn-primary btn-sm" onclick="BudgetApp.saveBasicInfo('${esc(h.id)}')">保存</button>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label>ホテル名 *</label>
            <input type="text" id="bi-name" value="${esc(h.name)}" placeholder="例: ナゴヤキャッスルホテル">
          </div>
          <div class="form-group">
            <label>利用区分（複数選択可）</label>
            <div style="display:flex;flex-wrap:wrap;gap:4px 8px;border:1px solid var(--border);
                        border-radius:6px;padding:10px">
              ${groupChecks}
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>契約開始日</label>
              <input type="date" id="bi-start" value="${esc(h.contractStart || '')}">
            </div>
            <div class="form-group">
              <label>契約終了日</label>
              <input type="date" id="bi-end" value="${esc(h.contractEnd || '')}">
            </div>
          </div>
          <div class="form-group">
            <label>備考</label>
            <textarea id="bi-note" rows="3" placeholder="ホテルに関する特記事項など">${esc(h.note || '')}</textarea>
          </div>
        </div>
      </div>`;
  }

  function saveBasicInfo(hotelId) {
    const name = document.getElementById('bi-name').value.trim();
    if (!name) { alert('ホテル名を入力してください'); return; }
    const userGroups    = [...document.querySelectorAll('input[name="bi-group"]:checked')].map(cb => cb.value);
    const contractStart = document.getElementById('bi-start').value;
    const contractEnd   = document.getElementById('bi-end').value;
    const note          = document.getElementById('bi-note').value;

    if (contractStart && contractEnd && contractStart > contractEnd) {
      alert('契約終了日は開始日より後にしてください'); return;
    }

    BudgetData.updateHotel(hotelId, { name, userGroups, contractStart, contractEnd, note });

    // Update header display without full re-render
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = name;
    showToast('基本情報を保存しました');
  }

  // ── 客室契約 tab ──────────────────────────────────────────────────────────
  function renderRoomContracts(h) {
    const rcs = h.roomContracts || [];

    const rows = rcs.map(rc => {
      const nights  = BudgetData.calcNights(rc.checkIn, rc.checkOut);
      const budgAmt = (+rc.plannedRooms  || 0) * nights * (+rc.budgetRate   || 0);
      const contAmt = (+rc.contractRooms || 0) * nights * (+rc.contractRate || 0);
      return `
        <tr data-rc-id="${esc(rc.id)}">
          <td style="padding:6px 8px">
            <input type="text" value="${esc(rc.roomType)}" placeholder="シングル"
              style="min-width:80px"
              onchange="BudgetApp.updateRC('${esc(h.id)}','${esc(rc.id)}','roomType',this.value)">
          </td>
          <td style="padding:6px 8px">
            <input type="number" value="${+rc.plannedRooms || 0}" min="0" style="width:70px"
              onchange="BudgetApp.updateRC('${esc(h.id)}','${esc(rc.id)}','plannedRooms',this.value)">
          </td>
          <td style="padding:6px 8px">
            <input type="number" value="${+rc.contractRooms || 0}" min="0" style="width:70px"
              onchange="BudgetApp.updateRC('${esc(h.id)}','${esc(rc.id)}','contractRooms',this.value)">
          </td>
          <td style="padding:6px 8px">
            <input type="number" value="${+rc.budgetRate || 0}" min="0" style="width:100px"
              onchange="BudgetApp.updateRC('${esc(h.id)}','${esc(rc.id)}','budgetRate',this.value)">
          </td>
          <td style="padding:6px 8px">
            <input type="number" value="${+rc.contractRate || 0}" min="0" style="width:100px"
              onchange="BudgetApp.updateRC('${esc(h.id)}','${esc(rc.id)}','contractRate',this.value)">
          </td>
          <td style="padding:6px 8px">
            <input type="date" value="${esc(rc.checkIn || '')}" style="width:130px"
              onchange="BudgetApp.updateRC('${esc(h.id)}','${esc(rc.id)}','checkIn',this.value)">
          </td>
          <td style="padding:6px 8px">
            <input type="date" value="${esc(rc.checkOut || '')}" style="width:130px"
              onchange="BudgetApp.updateRC('${esc(h.id)}','${esc(rc.id)}','checkOut',this.value)">
          </td>
          <td style="padding:6px 8px;text-align:right;font-size:12px" class="rc-nights">${nights}<span style="color:#7f8c8d">泊</span></td>
          <td style="padding:6px 8px;text-align:right;font-size:12px" class="rc-budg-amt">${fmt(budgAmt)}</td>
          <td style="padding:6px 8px;text-align:right;font-size:12px;color:#3498db" class="rc-cont-amt">${fmt(contAmt)}</td>
          <td style="padding:6px 8px">
            <button class="btn btn-danger btn-xs"
              onclick="BudgetApp.deleteRC('${esc(h.id)}','${esc(rc.id)}')">削除</button>
          </td>
        </tr>`;
    }).join('');

    const rct = BudgetData.roomContractTotals(h.id);

    return `
      <div class="card">
        <div class="card-header">
          <h2>客室契約</h2>
          <button class="btn btn-primary btn-sm" onclick="BudgetApp.addRC('${esc(h.id)}')">＋ 客室タイプを追加</button>
        </div>
        <div class="card-body" style="padding:0;overflow-x:auto">
          <table class="match-table" id="rc-table" style="width:100%">
            <thead>
              <tr>
                <th>客室タイプ</th>
                <th>計画室数</th>
                <th>契約室数</th>
                <th style="text-align:right">予算単価（円/泊）</th>
                <th style="text-align:right">契約単価（円/泊）</th>
                <th>チェックイン</th>
                <th>チェックアウト</th>
                <th style="text-align:right">泊数</th>
                <th style="text-align:right">予算額</th>
                <th style="text-align:right">契約額</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="rc-tbody">
              ${rows || '<tr><td colspan="11" style="padding:20px;text-align:center;color:#7f8c8d">客室タイプがありません</td></tr>'}
            </tbody>
            ${rcs.length > 0 ? `
            <tfoot>
              <tr style="background:#f8f9fa;font-weight:700">
                <td colspan="8" style="padding:8px 10px;text-align:right">合計</td>
                <td style="padding:8px 10px;text-align:right" id="rc-ft-budg">${fmt(rct.budget)}</td>
                <td style="padding:8px 10px;text-align:right;color:#3498db" id="rc-ft-cont">${fmt(rct.contract)}</td>
                <td></td>
              </tr>
            </tfoot>` : ''}
          </table>
        </div>
      </div>
      <div class="alert alert-info mt-2">
        ℹ 客室契約はチェックイン・チェックアウトから泊数を自動計算します。
        ここで把握した金額は参考値として使用し、「費用明細」タブに実際の予算・契約額を入力してください。
      </div>`;
  }

  function addRC(hotelId) {
    const dr = DataManager.getDateRange();
    BudgetData.addRoomContract(hotelId, {
      checkIn: dr.start || '', checkOut: dr.end || '',
    });
    switchHotelTab(hotelId, 'rooms');
  }

  function updateRC(hotelId, rcId, field, value) {
    BudgetData.updateRoomContract(hotelId, rcId, { [field]: value });
    // Re-render the tab to update calculated nights/amounts
    const content = document.getElementById('hotel-tab-content');
    if (content) {
      const h = BudgetData.getHotel(hotelId);
      if (h) content.innerHTML = renderRoomContracts(h);
    }
  }

  function deleteRC(hotelId, rcId) {
    BudgetData.deleteRoomContract(hotelId, rcId);
    switchHotelTab(hotelId, 'rooms');
  }

  // ── 費用明細 tab ──────────────────────────────────────────────────────────
  function renderCostItems(h) {
    const costs = h.costs || [];

    const catOptions = Object.entries(CATEGORIES).map(([k, v]) =>
      `<option value="${k}">${v.label}</option>`
    ).join('');

    const rows = costs.map(c => {
      const v = (+c.budgetAmount || 0) - (+c.contractAmount || 0);
      return `
        <tr data-cost-id="${esc(c.id)}">
          <td style="padding:6px 8px">
            <select style="min-width:140px"
              onchange="BudgetApp.onCostChange('${esc(h.id)}','${esc(c.id)}','category',this.value)">
              ${Object.entries(CATEGORIES).map(([k, cv]) =>
                `<option value="${k}" ${c.category === k ? 'selected' : ''}>${cv.label}</option>`
              ).join('')}
            </select>
          </td>
          <td style="padding:6px 8px">
            <input type="text" value="${esc(c.description)}" placeholder="費用の内容を入力"
              style="min-width:180px"
              onchange="BudgetApp.onCostChange('${esc(h.id)}','${esc(c.id)}','description',this.value)">
          </td>
          <td style="padding:6px 8px">
            <input type="number" value="${+c.budgetAmount || 0}" min="0" step="1000"
              style="width:130px"
              onchange="BudgetApp.onCostAmt('${esc(h.id)}','${esc(c.id)}','budgetAmount',this)">
          </td>
          <td style="padding:6px 8px">
            <input type="number" value="${+c.contractAmount || 0}" min="0" step="1000"
              style="width:130px"
              onchange="BudgetApp.onCostAmt('${esc(h.id)}','${esc(c.id)}','contractAmount',this)">
          </td>
          <td style="padding:6px 8px">
            <input type="number" value="${+c.actualAmount || 0}" min="0" step="1000"
              style="width:130px"
              onchange="BudgetApp.onCostAmt('${esc(h.id)}','${esc(c.id)}','actualAmount',this)">
          </td>
          <td style="padding:6px 8px;text-align:right;font-weight:600;${varStyle(v)}" class="cost-var">
            ${varStr(v)}
          </td>
          <td style="padding:6px 8px">
            <input type="text" value="${esc(c.note || '')}" placeholder="備考" style="min-width:100px"
              onchange="BudgetApp.onCostChange('${esc(h.id)}','${esc(c.id)}','note',this.value)">
          </td>
          <td style="padding:6px 8px">
            <button class="btn btn-danger btn-xs"
              onclick="BudgetApp.deleteCost('${esc(h.id)}','${esc(c.id)}')">削除</button>
          </td>
        </tr>`;
    }).join('');

    const t  = BudgetData.hotelTotals(h.id);
    const tv = t.budget - t.contract;

    return `
      <div class="card">
        <div class="card-header">
          <h2>費用明細</h2>
          <button class="btn btn-primary btn-sm" onclick="BudgetApp.addCost('${esc(h.id)}')">＋ 費用を追加</button>
        </div>
        <div class="card-body" style="padding:0;overflow-x:auto">
          <table class="match-table" style="width:100%;min-width:900px">
            <thead>
              <tr>
                <th>費用区分</th>
                <th>内容・項目</th>
                <th style="text-align:right">予算額（円）</th>
                <th style="text-align:right">契約額（円）</th>
                <th style="text-align:right">実績額（円）</th>
                <th style="text-align:right">乖離（予−契）</th>
                <th>備考</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="cost-tbody">
              ${rows || '<tr><td colspan="8" style="padding:20px;text-align:center;color:#7f8c8d">費用がありません。「費用を追加」ボタンから入力してください。</td></tr>'}
            </tbody>
            ${costs.length > 0 ? `
            <tfoot>
              <tr style="background:#f8f9fa;font-weight:700">
                <td colspan="2" style="padding:8px 10px;text-align:right">合計</td>
                <td style="padding:8px 10px;text-align:right" id="ft-budget">${fmt(t.budget)}</td>
                <td style="padding:8px 10px;text-align:right;color:#3498db" id="ft-contract">${fmt(t.contract)}</td>
                <td style="padding:8px 10px;text-align:right;color:#27ae60" id="ft-actual">${fmt(t.actual)}</td>
                <td style="padding:8px 10px;text-align:right;${varStyle(tv)}" id="ft-variance">${varStr(tv)}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>` : ''}
          </table>
        </div>
      </div>
      <div class="alert alert-info mt-2">
        ℹ 予算額・契約額・実績額を入力してください。乖離は「予算 − 契約」で計算されます。
        入力欄からフォーカスを外すと自動保存されます。
      </div>`;
  }

  function addCost(hotelId) {
    BudgetData.addCost(hotelId, { category: 'room', description: '' });
    switchHotelTab(hotelId, 'costs');
  }

  // Simple field update (category, description, note) - no DOM recalculation needed
  function onCostChange(hotelId, costId, field, value) {
    BudgetData.updateCost(hotelId, costId, { [field]: value });
  }

  // Amount update - save data then update variance cell and footer totals in place
  function onCostAmt(hotelId, costId, field, inputEl) {
    const value = +inputEl.value || 0;
    BudgetData.updateCost(hotelId, costId, { [field]: value });

    // Update variance cell for this row
    const row = inputEl.closest('tr[data-cost-id]');
    if (row) {
      const c = (BudgetData.getHotel(hotelId)?.costs || []).find(c => c.id === costId);
      if (c) {
        const v = (+c.budgetAmount || 0) - (+c.contractAmount || 0);
        const varCell = row.querySelector('.cost-var');
        if (varCell) {
          varCell.textContent = varStr(v);
          varCell.style.color = v >= 0 ? '#27ae60' : '#e74c3c';
        }
      }
    }

    // Update footer totals
    const t  = BudgetData.hotelTotals(hotelId);
    const tv = t.budget - t.contract;
    const set = (id, val, style) => {
      const el = document.getElementById(id);
      if (el) { el.textContent = fmt(val); if (style) el.style.color = style; }
    };
    set('ft-budget',   t.budget);
    set('ft-contract', t.contract, '#3498db');
    set('ft-actual',   t.actual,   '#27ae60');
    const ftv = document.getElementById('ft-variance');
    if (ftv) {
      ftv.textContent = varStr(tv);
      ftv.style.color = tv >= 0 ? '#27ae60' : '#e74c3c';
    }

    // Update detail page header figures
    _refreshDetailHeader(hotelId);
  }

  function _refreshDetailHeader(hotelId) {
    const t  = BudgetData.hotelTotals(hotelId);
    const tv = t.budget - t.contract;
    // The header amounts are in a div with specific text - update all strong elements
    const headerDiv = document.querySelector('.page-title')?.parentElement;
    if (headerDiv) {
      const strongs = headerDiv.querySelectorAll('strong');
      if (strongs.length >= 3) {
        strongs[0].textContent = fmt(t.budget);
        strongs[1].textContent = fmt(t.contract);
        strongs[2].textContent = varStr(tv);
        strongs[2].style.color = tv >= 0 ? '#27ae60' : '#e74c3c';
      }
    }
  }

  function deleteCost(hotelId, costId) {
    BudgetData.deleteCost(hotelId, costId);
    switchHotelTab(hotelId, 'costs');
  }

  // ── サマリー tab ──────────────────────────────────────────────────────────
  function renderHotelSummary(h) {
    const t   = BudgetData.hotelTotals(h.id);
    const tv  = t.budget - t.contract;
    const rct = BudgetData.roomContractTotals(h.id);

    // Category breakdown
    const catData = {};
    (h.costs || []).forEach(c => {
      if (!catData[c.category]) catData[c.category] = { budget: 0, contract: 0, actual: 0 };
      catData[c.category].budget   += +c.budgetAmount   || 0;
      catData[c.category].contract += +c.contractAmount || 0;
      catData[c.category].actual   += +c.actualAmount   || 0;
    });

    const catRows = Object.entries(CATEGORIES).map(([key]) => {
      const d = catData[key];
      if (!d) return '';
      const v = d.budget - d.contract;
      return `
        <tr>
          <td style="padding:8px 10px">${catDot(key)}</td>
          <td style="padding:8px 10px;text-align:right">${fmt(d.budget)}</td>
          <td style="padding:8px 10px;text-align:right;color:#3498db">${fmt(d.contract)}</td>
          <td style="padding:8px 10px;text-align:right;color:#27ae60">${fmt(d.actual)}</td>
          <td style="padding:8px 10px;text-align:right;${varStyle(v)}">${varStr(v)}</td>
        </tr>`;
    }).join('');

    // Room contract reference rows
    const rcRows = (h.roomContracts || []).map(rc => {
      const nights = BudgetData.calcNights(rc.checkIn, rc.checkOut);
      const ba = (+rc.plannedRooms  || 0) * nights * (+rc.budgetRate   || 0);
      const ca = (+rc.contractRooms || 0) * nights * (+rc.contractRate || 0);
      return `
        <tr>
          <td style="padding:6px 10px">${esc(rc.roomType || '—')}</td>
          <td style="padding:6px 10px;text-align:right">${+rc.plannedRooms || 0} 室</td>
          <td style="padding:6px 10px;text-align:right">${+rc.contractRooms || 0} 室</td>
          <td style="padding:6px 10px;text-align:right">${nights} 泊</td>
          <td style="padding:6px 10px;text-align:right">${fmt(+rc.budgetRate || 0)}</td>
          <td style="padding:6px 10px;text-align:right">${fmt(+rc.contractRate || 0)}</td>
          <td style="padding:6px 10px;text-align:right">${fmt(ba)}</td>
          <td style="padding:6px 10px;text-align:right;color:#3498db">${fmt(ca)}</td>
        </tr>`;
    }).join('');

    const nights = BudgetData.calcNights(h.contractStart, h.contractEnd);

    return `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">予算合計</div>
          <div class="kpi-value" style="color:#2c3e50">${fmt(t.budget)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">契約合計</div>
          <div class="kpi-value" style="color:#3498db">${fmt(t.contract)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">実績合計</div>
          <div class="kpi-value" style="color:#27ae60">${fmt(t.actual)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">乖離（予算 − 契約）</div>
          <div class="kpi-value" style="${varStyle(tv)}">${varStr(tv)}</div>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-header"><h2>費用区分別内訳</h2></div>
        <div class="card-body" style="padding:0">
          <table class="match-table" style="width:100%">
            <thead>
              <tr>
                <th>費用区分</th>
                <th style="text-align:right">予算</th>
                <th style="text-align:right">契約</th>
                <th style="text-align:right">実績</th>
                <th style="text-align:right">乖離（予−契）</th>
              </tr>
            </thead>
            <tbody>
              ${catRows || '<tr><td colspan="5" style="padding:16px;text-align:center;color:#7f8c8d">費用明細を追加してください</td></tr>'}
            </tbody>
            <tfoot>
              <tr style="background:#f8f9fa;font-weight:700">
                <td style="padding:8px 10px">合計</td>
                <td style="padding:8px 10px;text-align:right">${fmt(t.budget)}</td>
                <td style="padding:8px 10px;text-align:right;color:#3498db">${fmt(t.contract)}</td>
                <td style="padding:8px 10px;text-align:right;color:#27ae60">${fmt(t.actual)}</td>
                <td style="padding:8px 10px;text-align:right;${varStyle(tv)}">${varStr(tv)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-header"><h2>契約概要</h2></div>
        <div class="card-body">
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">利用区分</div>
              <div class="info-value">${groupTags(h.userGroups) || '<span style="color:#bbb">未設定</span>'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">契約期間</div>
              <div class="info-value">
                ${h.contractStart
                  ? `${esc(h.contractStart)} ～ ${esc(h.contractEnd)}（${nights}泊）`
                  : '<span style="color:#bbb">未設定</span>'}
              </div>
            </div>
            <div class="info-item">
              <div class="info-label">客室タイプ数</div>
              <div class="info-value">${(h.roomContracts || []).length} タイプ</div>
            </div>
            <div class="info-item">
              <div class="info-label">費用明細件数</div>
              <div class="info-value">${(h.costs || []).length} 件</div>
            </div>
            ${h.note ? `
            <div class="info-item" style="grid-column:1/-1">
              <div class="info-label">備考</div>
              <div class="info-value" style="font-weight:normal;font-size:13px">${esc(h.note)}</div>
            </div>` : ''}
          </div>
        </div>
      </div>

      ${h.roomContracts?.length > 0 ? `
      <div class="card">
        <div class="card-header"><h2>客室契約参考値</h2></div>
        <div class="card-body" style="padding:0;overflow-x:auto">
          <table class="match-table" style="width:100%">
            <thead>
              <tr>
                <th>客室タイプ</th>
                <th style="text-align:right">計画室数</th>
                <th style="text-align:right">契約室数</th>
                <th style="text-align:right">泊数</th>
                <th style="text-align:right">予算単価</th>
                <th style="text-align:right">契約単価</th>
                <th style="text-align:right">予算額</th>
                <th style="text-align:right">契約額</th>
              </tr>
            </thead>
            <tbody>${rcRows}</tbody>
            <tfoot>
              <tr style="background:#f8f9fa;font-weight:700">
                <td colspan="6" style="padding:8px 10px;text-align:right">合計</td>
                <td style="padding:8px 10px;text-align:right">${fmt(rct.budget)}</td>
                <td style="padding:8px 10px;text-align:right;color:#3498db">${fmt(rct.contract)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>` : ''}`;
  }

  // ── Add Hotel Modal ───────────────────────────────────────────────────────
  function showAddHotelModal() {
    const masterHotels = DataManager.getHotels();
    const masterOpts = masterHotels.map(mh =>
      `<option value="${esc(mh.id)}">${esc(mh.name)}</option>`
    ).join('');

    const groupChecks = Object.entries(USER_GROUPS).map(([k, v]) => `
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;
                    padding:4px 8px;border-radius:4px">
        <input type="checkbox" name="ah-group" value="${k}"> ${esc(v)}
      </label>`).join('');

    document.getElementById('modal-container').innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)BudgetApp.closeModal()">
        <div class="modal modal-wide">
          <div class="modal-header">
            <h3>ホテルを追加</h3>
            <button class="modal-close" onclick="BudgetApp.closeModal()">×</button>
          </div>
          <div class="modal-body">
            ${masterHotels.length > 0 ? `
            <div class="form-group">
              <label>マスターホテルから選択（任意）</label>
              <select id="ah-master" onchange="BudgetApp.onMasterSelect(this.value)">
                <option value="">— 新規入力 —</option>
                ${masterOpts}
              </select>
            </div>` : ''}
            <div class="form-group">
              <label>ホテル名 *</label>
              <input type="text" id="ah-name" placeholder="例: ナゴヤキャッスルホテル">
            </div>
            <div class="form-group">
              <label>利用区分（複数選択可）</label>
              <div style="display:flex;flex-wrap:wrap;gap:4px 8px;border:1px solid var(--border);
                          border-radius:6px;padding:10px">
                ${groupChecks}
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>契約開始日</label>
                <input type="date" id="ah-start">
              </div>
              <div class="form-group">
                <label>契約終了日</label>
                <input type="date" id="ah-end">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="BudgetApp.closeModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="BudgetApp.saveNewHotel()">追加</button>
          </div>
        </div>
      </div>`;
  }

  function onMasterSelect(masterHotelId) {
    if (!masterHotelId) return;
    const mh = DataManager.getHotel(masterHotelId);
    if (mh) document.getElementById('ah-name').value = mh.name;
  }

  function saveNewHotel() {
    const name = document.getElementById('ah-name').value.trim();
    if (!name) { alert('ホテル名を入力してください'); return; }

    const masterEl = document.getElementById('ah-master');
    const masterHotelId  = masterEl ? masterEl.value : '';
    const userGroups     = [...document.querySelectorAll('input[name="ah-group"]:checked')].map(cb => cb.value);
    const contractStart  = document.getElementById('ah-start').value;
    const contractEnd    = document.getElementById('ah-end').value;

    const hotel = BudgetData.addHotel({ name, masterHotelId, userGroups, contractStart, contractEnd });
    closeModal();
    navigate('hotel_detail', hotel.id);
    showToast('ホテルを追加しました');
  }

  function confirmDeleteHotel(hotelId) {
    const h = BudgetData.getHotel(hotelId);
    if (!h) return;
    if (!confirm(`「${h.name}」を削除しますか？\nすべての費用データも削除されます。`)) return;
    BudgetData.deleteHotel(hotelId);
    navigate('hotels');
    showToast('ホテルを削除しました', 'warning');
  }

  return {
    init, navigate,
    switchHotelTab,
    saveBasicInfo,
    addRC, updateRC, deleteRC,
    addCost, onCostChange, onCostAmt, deleteCost,
    showAddHotelModal, onMasterSelect, saveNewHotel,
    confirmDeleteHotel, closeModal,
  };
})();

window.addEventListener('DOMContentLoaded', () => BudgetApp.init());
