/**
 * app.js - Budget management UI controller
 *
 * Views:  dashboard | hotels | hotel/:id
 * Hotel sub-tabs: basic | rooms | costs | summary
 */
const BudgetApp = (() => {

  // ── State ─────────────────────────────────────────────────────────────────
  let view         = 'dashboard';
  let hotelId      = null;
  let hotelTab     = 'basic';

  // ── Boot ──────────────────────────────────────────────────────────────────
  function init() {
    BudgetData.init();
    render();
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function navigate(newView, id) {
    view     = newView;
    hotelId  = id || null;
    hotelTab = 'basic';
    render();
    _updateNav();
  }

  function _updateNav() {
    document.querySelectorAll('#main-nav .nav-btn').forEach((btn, i) => {
      const views = ['dashboard', 'hotels'];
      const active = views[i] === view || (view === 'hotel' && views[i] === 'hotels');
      btn.classList.toggle('active', active);
    });
  }

  function render() {
    const el = document.getElementById('main-content');
    if (!el) return;
    if      (view === 'dashboard') el.innerHTML = renderDashboard();
    else if (view === 'hotels')    el.innerHTML = renderHotelList();
    else if (view === 'hotel')     el.innerHTML = renderHotelPage(hotelId);
    _updateNav();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const CAT  = BudgetData.COST_CATEGORIES;
  const GRP  = BudgetData.USER_GROUPS;

  function yen(n) { return '¥' + Math.round(+n || 0).toLocaleString('ja-JP'); }

  function esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function varStr(v) { return (v >= 0 ? '+' : '') + yen(v); }
  function varCls(v) { return v >= 0 ? 'pos' : 'neg'; }

  function groupTags(groups) {
    return (groups || [])
      .map(g => `<span class="tag group-tag">${esc(GRP[g] || g)}</span>`)
      .join('');
  }

  function catLabel(cat) {
    const c = CAT[cat] || CAT.other;
    return `<span class="cat-dot" style="background:${c.color}"></span>${esc(c.label)}`;
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  function renderDashboard() {
    const gt    = BudgetData.grandTotals();
    const catT  = BudgetData.categoryTotals();
    const grpT  = BudgetData.userGroupTotals();
    const hotels = BudgetData.getHotels();
    const tv    = gt.budget - gt.contract;

    const kpis = `
      <div class="kpi-grid">
        <div class="kpi-card" style="--kpi-color:#1a3a5c">
          <div class="kpi-label">予算合計</div>
          <div class="kpi-value">${yen(gt.budget)}</div>
          <div class="kpi-sub">${hotels.length} ホテル</div>
        </div>
        <div class="kpi-card" style="--kpi-color:#3498db">
          <div class="kpi-label">契約合計</div>
          <div class="kpi-value info-color">${yen(gt.contract)}</div>
          <div class="kpi-sub">予算比 ${gt.budget ? Math.round(gt.contract / gt.budget * 100) : 0}%</div>
        </div>
        <div class="kpi-card" style="--kpi-color:#27ae60">
          <div class="kpi-label">実績合計</div>
          <div class="kpi-value pos">${yen(gt.actual)}</div>
          <div class="kpi-sub">契約比 ${gt.contract ? Math.round(gt.actual / gt.contract * 100) : 0}%</div>
        </div>
        <div class="kpi-card" style="--kpi-color:${tv >= 0 ? '#27ae60' : '#e74c3c'}">
          <div class="kpi-label">乖離（予算 − 契約）</div>
          <div class="kpi-value ${varCls(tv)}">${varStr(tv)}</div>
          <div class="kpi-sub ${varCls(tv)}">${tv >= 0 ? '予算内' : '予算超過'}</div>
        </div>
      </div>`;

    // Hotel rows
    const hotelRows = hotels.length === 0
      ? `<tr><td colspan="7" class="text-center text-muted" style="padding:24px">
           ホテルデータがありません。「ホテル一覧」から追加してください。</td></tr>`
      : hotels.map(h => {
          const t = BudgetData.hotelTotals(h.id);
          const v = t.budget - t.contract;
          return `
            <tr class="clickable" onclick="BudgetApp.navigate('hotel','${esc(h.id)}')">
              <td>
                <div style="font-weight:600">${esc(h.name)}</div>
                <div style="margin-top:3px">${groupTags(h.userGroups)}</div>
              </td>
              <td class="text-muted" style="font-size:12px">
                ${h.contractStart ? esc(h.contractStart) + ' 〜 ' + esc(h.contractEnd) : '—'}
              </td>
              <td class="num">${yen(t.budget)}</td>
              <td class="num info-color">${yen(t.contract)}</td>
              <td class="num pos">${yen(t.actual)}</td>
              <td class="num ${varCls(v)}">${varStr(v)}</td>
              <td style="color:#bbb;font-size:11px">→</td>
            </tr>`;
        }).join('');

    // Category rows
    const catRows = Object.entries(CAT).map(([key]) => {
      const t = catT[key];
      if (!t || (!t.budget && !t.contract && !t.actual)) return '';
      const v = t.budget - t.contract;
      return `
        <tr>
          <td>${catLabel(key)}</td>
          <td class="num">${yen(t.budget)}</td>
          <td class="num info-color">${yen(t.contract)}</td>
          <td class="num pos">${yen(t.actual)}</td>
          <td class="num ${varCls(v)}">${varStr(v)}</td>
        </tr>`;
    }).join('') || `<tr><td colspan="5" class="text-center text-muted" style="padding:16px">データなし</td></tr>`;

    // Group rows
    const grpRows = Object.entries(GRP).map(([key, label]) => {
      const t = grpT[key];
      if (!t) return '';
      const v = t.budget - t.contract;
      return `
        <tr>
          <td style="font-weight:600">${esc(label)}</td>
          <td class="num">${yen(t.budget)}</td>
          <td class="num info-color">${yen(t.contract)}</td>
          <td class="num pos">${yen(t.actual)}</td>
          <td class="num ${varCls(v)}">${varStr(v)}</td>
        </tr>`;
    }).join('') || `<tr><td colspan="5" class="text-center text-muted" style="padding:16px">データなし</td></tr>`;

    return `
      <div class="page-header">
        <div>
          <div class="page-title">📊 ダッシュボード</div>
        </div>
        <button class="btn btn-primary" onclick="BudgetApp.navigate('hotels')">ホテルを管理 →</button>
      </div>

      ${kpis}

      <div class="card mb-2">
        <div class="card-header"><h2>ホテル別集計</h2></div>
        <div class="overflow-x">
          <table class="data-table">
            <thead>
              <tr>
                <th>ホテル名 / 利用区分</th>
                <th>契約期間</th>
                <th class="num">予算</th>
                <th class="num">契約</th>
                <th class="num">実績</th>
                <th class="num">乖離（予−契）</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${hotelRows}</tbody>
          </table>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card mb-0">
          <div class="card-header"><h2>費用区分別集計</h2></div>
          <table class="data-table">
            <thead>
              <tr>
                <th>費用区分</th>
                <th class="num">予算</th>
                <th class="num">契約</th>
                <th class="num">実績</th>
                <th class="num">乖離</th>
              </tr>
            </thead>
            <tbody>${catRows}</tbody>
          </table>
        </div>

        <div class="card mb-0">
          <div class="card-header">
            <h2>利用区分別集計</h2>
            <span style="font-size:11px;color:#7f8c8d">※複数区分は按分</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>利用区分</th>
                <th class="num">予算</th>
                <th class="num">契約</th>
                <th class="num">実績</th>
                <th class="num">乖離</th>
              </tr>
            </thead>
            <tbody>${grpRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── Hotel List ────────────────────────────────────────────────────────────
  function renderHotelList() {
    const hotels = BudgetData.getHotels();

    if (hotels.length === 0) {
      return `
        <div class="page-header">
          <div class="page-title">🏨 ホテル一覧</div>
          <button class="btn btn-primary btn-lg" onclick="BudgetApp.showAddHotelModal()">＋ ホテルを追加</button>
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">🏨</div>
          <div class="empty-state-title">ホテルが登録されていません</div>
          <div class="empty-state-text">「ホテルを追加」から最初のホテルを作成してください</div>
        </div>`;
    }

    const cards = hotels.map(h => {
      const t = BudgetData.hotelTotals(h.id);
      const v = t.budget - t.contract;
      const nights = BudgetData.calcNights(h.contractStart, h.contractEnd);
      return `
        <div class="hotel-card">
          <div class="hotel-card-top" onclick="BudgetApp.navigate('hotel','${esc(h.id)}')">
            <div class="hotel-card-info">
              <div class="hotel-card-name">${esc(h.name)}</div>
              <div style="margin-bottom:6px">${groupTags(h.userGroups) || '<span class="text-muted" style="font-size:12px">利用区分未設定</span>'}</div>
              <div class="hotel-card-meta">
                ${h.contractStart
                  ? `📅 ${esc(h.contractStart)} 〜 ${esc(h.contractEnd)}（${nights}泊）`
                  : '📅 契約期間未設定'}
              </div>
              <div class="hotel-card-meta" style="margin-top:3px">
                客室 ${h.roomContracts.length} タイプ ／ 費用 ${h.costs.length} 件
              </div>
            </div>
            <div class="hotel-card-amounts">
              <div style="font-size:11px;color:#7f8c8d;margin-bottom:3px">予算</div>
              <div class="hotel-card-budget">${yen(t.budget)}</div>
              <div class="hotel-card-contract">契約 ${yen(t.contract)}</div>
              <div class="hotel-card-variance ${varCls(v)}">乖離 ${varStr(v)}</div>
            </div>
          </div>
          <div class="hotel-card-bottom">
            <button class="btn btn-secondary btn-sm" onclick="BudgetApp.navigate('hotel','${esc(h.id)}')">詳細・編集</button>
            <button class="btn btn-danger btn-sm"    onclick="BudgetApp.confirmDeleteHotel('${esc(h.id)}')">削除</button>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="page-header">
        <div class="page-title">🏨 ホテル一覧</div>
        <button class="btn btn-primary" onclick="BudgetApp.showAddHotelModal()">＋ ホテルを追加</button>
      </div>
      <div class="hotel-grid">${cards}</div>`;
  }

  // ── Hotel Page ────────────────────────────────────────────────────────────
  function renderHotelPage(id) {
    const h = BudgetData.getHotel(id);
    if (!h) return '<p class="text-muted text-center" style="padding:40px">ホテルが見つかりません</p>';

    const t  = BudgetData.hotelTotals(id);
    const tv = t.budget - t.contract;

    const tabDefs = [
      { key: 'basic',   label: '基本情報'  },
      { key: 'rooms',   label: '客室契約'  },
      { key: 'costs',   label: '費用明細'  },
      { key: 'summary', label: 'サマリー'  },
    ];

    const tabs = tabDefs.map(td => `
      <button class="tab-btn ${hotelTab === td.key ? 'active' : ''}"
        onclick="BudgetApp.switchTab('${esc(id)}','${td.key}')">
        ${td.label}
      </button>`).join('');

    let tabContent = '';
    if      (hotelTab === 'basic')   tabContent = renderBasicInfo(h);
    else if (hotelTab === 'rooms')   tabContent = renderRoomContracts(h);
    else if (hotelTab === 'costs')   tabContent = renderCostItems(h);
    else if (hotelTab === 'summary') tabContent = renderSummary(h);

    return `
      <div class="page-header">
        <button class="btn btn-back btn-sm" onclick="BudgetApp.navigate('hotels')">← 一覧に戻る</button>
        <div>
          <div class="page-title">${esc(h.name)}</div>
        </div>
        <div style="margin-left:auto;font-size:13px;text-align:right;white-space:nowrap">
          予算 <strong>${yen(t.budget)}</strong> &nbsp;/&nbsp;
          契約 <strong class="info-color">${yen(t.contract)}</strong> &nbsp;/&nbsp;
          乖離 <strong class="${varCls(tv)}">${varStr(tv)}</strong>
        </div>
      </div>

      <div class="tab-bar">${tabs}</div>
      <div id="tab-body">${tabContent}</div>`;
  }

  function switchTab(id, tab) {
    hotelTab = tab;
    const h = BudgetData.getHotel(id);
    if (!h) return;

    document.querySelectorAll('.tab-bar .tab-btn').forEach((btn, i) => {
      const tabs = ['basic', 'rooms', 'costs', 'summary'];
      btn.classList.toggle('active', tabs[i] === tab);
    });

    const body = document.getElementById('tab-body');
    if (!body) return;
    if      (tab === 'basic')   body.innerHTML = renderBasicInfo(h);
    else if (tab === 'rooms')   body.innerHTML = renderRoomContracts(h);
    else if (tab === 'costs')   body.innerHTML = renderCostItems(h);
    else if (tab === 'summary') body.innerHTML = renderSummary(h);
  }

  // ── 基本情報 ─────────────────────────────────────────────────────────────
  function renderBasicInfo(h) {
    const checks = Object.entries(GRP).map(([key, label]) => `
      <label class="check-label">
        <input type="checkbox" name="grp" value="${key}" ${(h.userGroups || []).includes(key) ? 'checked' : ''}>
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
            <input type="text" id="bi-name" value="${esc(h.name)}" placeholder="ホテル名を入力">
          </div>
          <div class="form-group">
            <label>利用区分（複数選択可）</label>
            <div class="group-checkboxes">${checks}</div>
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
            <label>備考・特記事項</label>
            <textarea id="bi-note" rows="3" placeholder="ホテルに関する補足情報など">${esc(h.note || '')}</textarea>
          </div>
        </div>
      </div>`;
  }

  function saveBasicInfo(id) {
    const name  = document.getElementById('bi-name').value.trim();
    if (!name) { alert('ホテル名を入力してください'); return; }
    const userGroups    = [...document.querySelectorAll('input[name="grp"]:checked')].map(cb => cb.value);
    const contractStart = document.getElementById('bi-start').value;
    const contractEnd   = document.getElementById('bi-end').value;
    if (contractStart && contractEnd && contractStart > contractEnd) {
      alert('契約終了日は開始日より後にしてください'); return;
    }
    const note = document.getElementById('bi-note').value;
    BudgetData.updateHotel(id, { name, userGroups, contractStart, contractEnd, note });

    // Update page title & header without full re-render
    const pt = document.querySelector('.page-title');
    if (pt) pt.textContent = name;
    showToast('保存しました');
  }

  // ── 客室契約 ─────────────────────────────────────────────────────────────
  function renderRoomContracts(h) {
    const rcs = h.roomContracts;

    const rows = rcs.map(rc => {
      const n  = BudgetData.calcNights(rc.checkIn, rc.checkOut);
      const ba = (+rc.plannedRooms  || 0) * n * (+rc.budgetRate   || 0);
      const ca = (+rc.contractRooms || 0) * n * (+rc.contractRate || 0);
      return `
        <tr>
          <td>
            <input type="text" value="${esc(rc.roomType)}" placeholder="シングル"
              style="min-width:80px"
              onchange="BudgetApp.updateRC('${esc(h.id)}','${esc(rc.id)}','roomType',this.value)">
          </td>
          <td>
            <input type="number" value="${+rc.plannedRooms || 0}" min="0" style="width:68px"
              onchange="BudgetApp.updateRC('${esc(h.id)}','${esc(rc.id)}','plannedRooms',this.value)">
          </td>
          <td>
            <input type="number" value="${+rc.contractRooms || 0}" min="0" style="width:68px"
              onchange="BudgetApp.updateRC('${esc(h.id)}','${esc(rc.id)}','contractRooms',this.value)">
          </td>
          <td>
            <input type="number" value="${+rc.budgetRate || 0}" min="0" style="width:100px"
              onchange="BudgetApp.updateRC('${esc(h.id)}','${esc(rc.id)}','budgetRate',this.value)">
          </td>
          <td>
            <input type="number" value="${+rc.contractRate || 0}" min="0" style="width:100px"
              onchange="BudgetApp.updateRC('${esc(h.id)}','${esc(rc.id)}','contractRate',this.value)">
          </td>
          <td>
            <input type="date" value="${esc(rc.checkIn || '')}" style="width:128px"
              onchange="BudgetApp.updateRC('${esc(h.id)}','${esc(rc.id)}','checkIn',this.value)">
          </td>
          <td>
            <input type="date" value="${esc(rc.checkOut || '')}" style="width:128px"
              onchange="BudgetApp.updateRC('${esc(h.id)}','${esc(rc.id)}','checkOut',this.value)">
          </td>
          <td class="num">${n}<span class="text-muted">泊</span></td>
          <td class="num">${yen(ba)}</td>
          <td class="num info-color">${yen(ca)}</td>
          <td>
            <button class="btn btn-danger btn-xs"
              onclick="BudgetApp.deleteRC('${esc(h.id)}','${esc(rc.id)}')">削除</button>
          </td>
        </tr>`;
    }).join('');

    const tot = BudgetData.roomContractTotals(h.id);

    return `
      <div class="card">
        <div class="card-header">
          <h2>客室契約</h2>
          <button class="btn btn-primary btn-sm" onclick="BudgetApp.addRC('${esc(h.id)}')">＋ 客室タイプを追加</button>
        </div>
        <div class="overflow-x">
          <table class="data-table">
            <thead>
              <tr>
                <th>客室タイプ</th>
                <th>計画室数</th>
                <th>契約室数</th>
                <th class="num">予算単価（円/泊）</th>
                <th class="num">契約単価（円/泊）</th>
                <th>チェックイン</th>
                <th>チェックアウト</th>
                <th class="num">泊数</th>
                <th class="num">予算額</th>
                <th class="num">契約額</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="11" class="text-center text-muted" style="padding:20px">客室タイプがありません</td></tr>'}
            </tbody>
            ${rcs.length ? `
            <tfoot>
              <tr>
                <td colspan="8" class="text-right">合計</td>
                <td class="num">${yen(tot.budget)}</td>
                <td class="num info-color">${yen(tot.contract)}</td>
                <td></td>
              </tr>
            </tfoot>` : ''}
          </table>
        </div>
      </div>
      <div class="alert alert-info mt-2">
        ℹ チェックイン・チェックアウトを入力すると泊数・金額を自動計算します。
        ここの数値は参考値です。実際の予算・契約額は「費用明細」タブに入力してください。
      </div>`;
  }

  function addRC(id) {
    BudgetData.addRoomContract(id, {});
    switchTab(id, 'rooms');
  }

  function updateRC(hotelId, rcId, field, val) {
    BudgetData.updateRoomContract(hotelId, rcId, { [field]: val });
    // Re-render to refresh computed nights/amounts
    const body = document.getElementById('tab-body');
    const h    = BudgetData.getHotel(hotelId);
    if (body && h) body.innerHTML = renderRoomContracts(h);
  }

  function deleteRC(hotelId, rcId) {
    BudgetData.deleteRoomContract(hotelId, rcId);
    switchTab(hotelId, 'rooms');
  }

  // ── 費用明細 ─────────────────────────────────────────────────────────────
  function renderCostItems(h) {
    const costs = h.costs;

    const rows = costs.map(c => {
      const v = (+c.budgetAmount || 0) - (+c.contractAmount || 0);
      return `
        <tr data-cid="${esc(c.id)}">
          <td>
            <select style="min-width:150px"
              onchange="BudgetApp.setCostField('${esc(h.id)}','${esc(c.id)}','category',this.value)">
              ${Object.entries(CAT).map(([k, cv]) =>
                `<option value="${k}" ${c.category === k ? 'selected' : ''}>${cv.label}</option>`
              ).join('')}
            </select>
          </td>
          <td>
            <input type="text" value="${esc(c.description)}" placeholder="例：シングル50室×30泊"
              style="min-width:200px"
              onchange="BudgetApp.setCostField('${esc(h.id)}','${esc(c.id)}','description',this.value)">
          </td>
          <td>
            <input type="number" value="${+c.budgetAmount || 0}" min="0" step="10000"
              style="width:130px"
              onchange="BudgetApp.setCostAmt('${esc(h.id)}','${esc(c.id)}','budgetAmount',this)">
          </td>
          <td>
            <input type="number" value="${+c.contractAmount || 0}" min="0" step="10000"
              style="width:130px"
              onchange="BudgetApp.setCostAmt('${esc(h.id)}','${esc(c.id)}','contractAmount',this)">
          </td>
          <td>
            <input type="number" value="${+c.actualAmount || 0}" min="0" step="10000"
              style="width:130px"
              onchange="BudgetApp.setCostAmt('${esc(h.id)}','${esc(c.id)}','actualAmount',this)">
          </td>
          <td class="num ${varCls(v)}" style="font-weight:600" data-var>${varStr(v)}</td>
          <td>
            <input type="text" value="${esc(c.note || '')}" placeholder="備考"
              style="min-width:100px"
              onchange="BudgetApp.setCostField('${esc(h.id)}','${esc(c.id)}','note',this.value)">
          </td>
          <td>
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
        <div class="overflow-x">
          <table class="data-table" style="min-width:980px">
            <thead>
              <tr>
                <th>費用区分</th>
                <th>内容・項目名</th>
                <th class="num">予算額（円）</th>
                <th class="num">契約額（円）</th>
                <th class="num">実績額（円）</th>
                <th class="num">乖離（予−契）</th>
                <th>備考</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="cost-rows">
              ${rows || '<tr><td colspan="8" class="text-center text-muted" style="padding:24px">費用がありません。「費用を追加」から入力してください。</td></tr>'}
            </tbody>
            ${costs.length ? `
            <tfoot>
              <tr>
                <td colspan="2" class="text-right">合計</td>
                <td class="num" id="ft-budget">${yen(t.budget)}</td>
                <td class="num info-color" id="ft-contract">${yen(t.contract)}</td>
                <td class="num pos" id="ft-actual">${yen(t.actual)}</td>
                <td class="num ${varCls(tv)}" id="ft-variance">${varStr(tv)}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>` : ''}
          </table>
        </div>
      </div>
      <div class="alert alert-info mt-2">
        ℹ 費用区分は「客室料金・ファンクションルーム・食費・営業補償費・その他」から選択。
        入力フィールドからフォーカスを外すと自動的に保存されます。
      </div>`;
  }

  function addCost(id) {
    BudgetData.addCost(id, {});
    switchTab(id, 'costs');
  }

  function setCostField(hotelId, costId, field, val) {
    BudgetData.updateCost(hotelId, costId, { [field]: val });
  }

  // Amount change: save + update variance cell + footer totals in place (no full re-render)
  function setCostAmt(hotelId, costId, field, inputEl) {
    BudgetData.updateCost(hotelId, costId, { [field]: +inputEl.value || 0 });

    // Update variance cell for this row
    const row = inputEl.closest('tr[data-cid]');
    if (row) {
      const c = (BudgetData.getHotel(hotelId)?.costs || []).find(c => c.id === costId);
      if (c) {
        const v = (+c.budgetAmount || 0) - (+c.contractAmount || 0);
        const varCell = row.querySelector('[data-var]');
        if (varCell) {
          varCell.textContent = varStr(v);
          varCell.className   = `num ${varCls(v)}`;
          varCell.style.fontWeight = '600';
        }
      }
    }

    // Update footer totals
    const t  = BudgetData.hotelTotals(hotelId);
    const tv = t.budget - t.contract;
    const upd = (id, txt, cls) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = txt;
      if (cls) el.className = cls;
    };
    upd('ft-budget',   yen(t.budget));
    upd('ft-contract', yen(t.contract), 'num info-color');
    upd('ft-actual',   yen(t.actual),   'num pos');
    upd('ft-variance', varStr(tv),      `num ${varCls(tv)}`);

    // Update detail page header figures
    _refreshHotelHeader(hotelId);
  }

  function _refreshHotelHeader(id) {
    const t  = BudgetData.hotelTotals(id);
    const tv = t.budget - t.contract;
    const header = document.querySelector('.page-header');
    if (!header) return;
    const strongs = header.querySelectorAll('strong');
    if (strongs.length >= 3) {
      strongs[0].textContent = yen(t.budget);
      strongs[1].textContent = yen(t.contract);
      strongs[2].textContent = varStr(tv);
      strongs[2].className   = varCls(tv);
    }
  }

  function deleteCost(hotelId, costId) {
    BudgetData.deleteCost(hotelId, costId);
    switchTab(hotelId, 'costs');
  }

  // ── サマリー ──────────────────────────────────────────────────────────────
  function renderSummary(h) {
    const t   = BudgetData.hotelTotals(h.id);
    const tv  = t.budget - t.contract;
    const rct = BudgetData.roomContractTotals(h.id);

    // Category breakdown
    const catData = {};
    h.costs.forEach(c => {
      if (!catData[c.category]) catData[c.category] = { budget: 0, contract: 0, actual: 0 };
      catData[c.category].budget   += +c.budgetAmount   || 0;
      catData[c.category].contract += +c.contractAmount || 0;
      catData[c.category].actual   += +c.actualAmount   || 0;
    });

    const catRows = Object.entries(CAT).map(([key]) => {
      const d = catData[key];
      if (!d) return '';
      const v = d.budget - d.contract;
      return `
        <tr>
          <td>${catLabel(key)}</td>
          <td class="num">${yen(d.budget)}</td>
          <td class="num info-color">${yen(d.contract)}</td>
          <td class="num pos">${yen(d.actual)}</td>
          <td class="num ${varCls(v)}">${varStr(v)}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" class="text-center text-muted" style="padding:16px">費用データなし</td></tr>';

    const rcRows = h.roomContracts.map(rc => {
      const n  = BudgetData.calcNights(rc.checkIn, rc.checkOut);
      const ba = (+rc.plannedRooms  || 0) * n * (+rc.budgetRate   || 0);
      const ca = (+rc.contractRooms || 0) * n * (+rc.contractRate || 0);
      return `
        <tr>
          <td>${esc(rc.roomType || '—')}</td>
          <td class="num">${+rc.plannedRooms || 0} 室</td>
          <td class="num">${+rc.contractRooms || 0} 室</td>
          <td class="num">${n} 泊</td>
          <td class="num">${yen(+rc.budgetRate || 0)}</td>
          <td class="num">${yen(+rc.contractRate || 0)}</td>
          <td class="num">${yen(ba)}</td>
          <td class="num info-color">${yen(ca)}</td>
        </tr>`;
    }).join('');

    const nights = BudgetData.calcNights(h.contractStart, h.contractEnd);

    return `
      <div class="kpi-grid">
        <div class="kpi-card" style="--kpi-color:#1a3a5c">
          <div class="kpi-label">予算合計</div>
          <div class="kpi-value">${yen(t.budget)}</div>
        </div>
        <div class="kpi-card" style="--kpi-color:#3498db">
          <div class="kpi-label">契約合計</div>
          <div class="kpi-value info-color">${yen(t.contract)}</div>
        </div>
        <div class="kpi-card" style="--kpi-color:#27ae60">
          <div class="kpi-label">実績合計</div>
          <div class="kpi-value pos">${yen(t.actual)}</div>
        </div>
        <div class="kpi-card" style="--kpi-color:${tv >= 0 ? '#27ae60' : '#e74c3c'}">
          <div class="kpi-label">乖離（予算 − 契約）</div>
          <div class="kpi-value ${varCls(tv)}">${varStr(tv)}</div>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-header"><h2>費用区分別内訳</h2></div>
        <table class="data-table">
          <thead>
            <tr>
              <th>費用区分</th>
              <th class="num">予算</th>
              <th class="num">契約</th>
              <th class="num">実績</th>
              <th class="num">乖離（予−契）</th>
            </tr>
          </thead>
          <tbody>${catRows}</tbody>
          <tfoot>
            <tr>
              <td>合計</td>
              <td class="num">${yen(t.budget)}</td>
              <td class="num info-color">${yen(t.contract)}</td>
              <td class="num pos">${yen(t.actual)}</td>
              <td class="num ${varCls(tv)}">${varStr(tv)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="card mb-2">
        <div class="card-header"><h2>契約概要</h2></div>
        <div class="card-body">
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">利用区分</div>
              <div class="info-value">${groupTags(h.userGroups) || '<span class="text-muted">未設定</span>'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">契約期間</div>
              <div class="info-value" style="font-size:13px">
                ${h.contractStart ? `${esc(h.contractStart)} 〜 ${esc(h.contractEnd)}（${nights}泊）` : '<span class="text-muted">未設定</span>'}
              </div>
            </div>
            <div class="info-item">
              <div class="info-label">客室タイプ</div>
              <div class="info-value">${h.roomContracts.length} タイプ</div>
            </div>
            <div class="info-item">
              <div class="info-label">費用明細</div>
              <div class="info-value">${h.costs.length} 件</div>
            </div>
            ${h.note ? `
            <div class="info-item" style="grid-column:1/-1">
              <div class="info-label">備考</div>
              <div class="info-value" style="font-weight:400;font-size:13px">${esc(h.note)}</div>
            </div>` : ''}
          </div>
        </div>
      </div>

      ${h.roomContracts.length ? `
      <div class="card">
        <div class="card-header"><h2>客室契約参考値</h2></div>
        <div class="overflow-x">
          <table class="data-table">
            <thead>
              <tr>
                <th>客室タイプ</th>
                <th class="num">計画室数</th>
                <th class="num">契約室数</th>
                <th class="num">泊数</th>
                <th class="num">予算単価</th>
                <th class="num">契約単価</th>
                <th class="num">予算額</th>
                <th class="num">契約額</th>
              </tr>
            </thead>
            <tbody>${rcRows}</tbody>
            <tfoot>
              <tr>
                <td colspan="6" class="text-right">合計</td>
                <td class="num">${yen(rct.budget)}</td>
                <td class="num info-color">${yen(rct.contract)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>` : ''}`;
  }

  // ── Add Hotel Modal ───────────────────────────────────────────────────────
  function showAddHotelModal() {
    const checks = Object.entries(GRP).map(([k, v]) => `
      <label class="check-label">
        <input type="checkbox" name="ah-grp" value="${k}"> ${esc(v)}
      </label>`).join('');

    _modal(`
      <div class="modal-header">
        <h3>ホテルを追加</h3>
        <button class="modal-close" onclick="BudgetApp.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>ホテル名 *</label>
          <input type="text" id="ah-name" placeholder="例: ナゴヤキャッスルホテル" autofocus>
        </div>
        <div class="form-group">
          <label>利用区分（複数選択可）</label>
          <div class="group-checkboxes">${checks}</div>
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
        <button class="btn btn-primary"   onclick="BudgetApp.saveNewHotel()">追加</button>
      </div>`);
  }

  function saveNewHotel() {
    const name = document.getElementById('ah-name').value.trim();
    if (!name) { alert('ホテル名を入力してください'); return; }
    const userGroups    = [...document.querySelectorAll('input[name="ah-grp"]:checked')].map(cb => cb.value);
    const contractStart = document.getElementById('ah-start').value;
    const contractEnd   = document.getElementById('ah-end').value;
    const h = BudgetData.addHotel({ name, userGroups, contractStart, contractEnd });
    closeModal();
    navigate('hotel', h.id);
    showToast('ホテルを追加しました');
  }

  function confirmDeleteHotel(id) {
    const h = BudgetData.getHotel(id);
    if (!h) return;
    if (!confirm(`「${h.name}」を削除しますか？\nすべての費用データも削除されます。`)) return;
    BudgetData.deleteHotel(id);
    navigate('hotels');
    showToast('ホテルを削除しました', 'warning');
  }

  // ── Export / Import Modal ─────────────────────────────────────────────────
  function showExportModal() {
    _modal(`
      <div class="modal-header">
        <h3>データのエクスポート / インポート</h3>
        <button class="modal-close" onclick="BudgetApp.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;gap:12px">
          <button class="btn btn-primary btn-lg" onclick="BudgetApp.exportData()">
            ↓ バックアップ JSON をダウンロード
          </button>
          <hr style="border:none;border-top:1px solid var(--border);margin:4px 0">
          <div class="form-group" style="margin:0">
            <label>JSONファイルから復元</label>
            <input type="file" id="import-file" accept=".json" style="width:100%;padding:6px 0">
          </div>
          <button class="btn btn-secondary" onclick="BudgetApp.importData()">
            ↑ インポート（現在のデータを上書き）
          </button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="BudgetApp.closeModal()">閉じる</button>
      </div>`);
  }

  function exportData() {
    const blob = new Blob([BudgetData.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hotel-budget-backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('ダウンロードしました');
  }

  async function importData() {
    const file = document.getElementById('import-file')?.files?.[0];
    if (!file) { alert('ファイルを選択してください'); return; }
    if (!confirm('現在のデータをすべて上書きします。よろしいですか？')) return;
    try {
      const text = await file.text();
      BudgetData.importJSON(text);
      closeModal();
      navigate('dashboard');
      showToast('データを復元しました');
    } catch(e) {
      alert('インポートエラー: ' + e.message);
    }
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function _modal(html) {
    document.getElementById('modal-root').innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)BudgetApp.closeModal()">
        <div class="modal">${html}</div>
      </div>`;
  }

  function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    const colors = { success: '#27ae60', warning: '#f39c12', error: '#e74c3c' };
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:${colors[type]||colors.success};color:white;
      padding:11px 26px;border-radius:30px;font-size:13px;font-weight:700;
      box-shadow:0 4px 20px rgba(0,0,0,0.22);z-index:9999;white-space:nowrap;
      animation:fadeIn .18s ease;`;
    el.textContent = msg;
    document.getElementById('toast-root').appendChild(el);
    setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s'; }, 2200);
    setTimeout(() => el.remove(), 2600);
  }

  return {
    init, navigate,
    switchTab, saveBasicInfo,
    addRC, updateRC, deleteRC,
    addCost, setCostField, setCostAmt, deleteCost,
    showAddHotelModal, saveNewHotel, confirmDeleteHotel,
    showExportModal, exportData, importData,
    closeModal,
  };
})();

window.addEventListener('DOMContentLoaded', () => BudgetApp.init());
