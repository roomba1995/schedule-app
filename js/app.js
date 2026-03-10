/**
 * app.js - Main application controller
 * Handles routing, view rendering, and global UI interactions.
 */
const App = (() => {

  // ── Router ───────────────────────────────────────────────────────────────
  function navigate(hash) {
    window.location.hash = hash;
  }

  function getRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const parts = hash.split('/');
    return { view: parts[0], id: parts[1] || null };
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    await DataManager.init();
    renderSidebar();
    window.addEventListener('hashchange', () => {
      renderSidebar();
      renderView();
    });
    renderView();
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────
  function renderSidebar() {
    const { view, id } = getRoute();
    const sports = DataManager.getSports();
    const hotels = DataManager.getHotels();

    const sportItems = sports.map(s => `
      <a class="sidebar-item ${view === 'sport' && id === s.id ? 'active' : ''}"
         href="#sport/${s.id}">
        <span class="sidebar-dot" style="background:${s.color}"></span>
        ${s.shortName || s.name}
      </a>`).join('');

    const hotelItems = hotels.map(h => `
      <a class="sidebar-item ${view === 'hotel' && id === h.id ? 'active' : ''}"
         href="#hotel/${h.id}">
        <span class="sidebar-dot" style="background:${h.color}"></span>
        ${h.name}
      </a>`).join('');

    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.innerHTML = `
        <div class="sidebar-section">
          <h3>競技</h3>
          ${sportItems}
        </div>
        <div class="sidebar-section">
          <h3>ホテル</h3>
          ${hotelItems}
        </div>
        <div class="sidebar-section">
          <a class="sidebar-item ${view === 'soccer' ? 'active' : ''}" href="#soccer">
            ⚽ サッカー設定
          </a>
          <a class="sidebar-item ${view === 'data' ? 'active' : ''}" href="#data">
            💾 データ管理
          </a>
        </div>`;
    }
  }

  // ── View router ──────────────────────────────────────────────────────────
  function renderView() {
    const { view, id } = getRoute();
    const main = document.getElementById('main-content');
    if (!main) return;

    // Update nav active state
    document.querySelectorAll('nav a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === `#${view}`);
    });

    switch (view) {
      case 'dashboard': main.innerHTML = renderDashboard(); break;
      case 'sport':     renderSportView(id, main); break;
      case 'hotel':     renderHotelView(id, main); break;
      case 'soccer':    main.innerHTML = renderSoccerConfig(); break;
      case 'data':      main.innerHTML = renderDataManagement(); break;
      default:          main.innerHTML = renderDashboard();
    }
  }

  // ── Dashboard ────────────────────────────────────────────────────────────
  function renderDashboard() {
    const sports = DataManager.getSports();
    const hotels = DataManager.getHotels();
    const dr     = DataManager.getDateRange();

    const sportCards = sports.map(s => {
      const hotelCount = DataManager.getHotelsForSport(s.id).length;
      const allEvents  = DataManager.getAllEventsForSport(s.id);
      const eventCount = Object.values(allEvents).reduce((n, evs) => n + evs.length, 0);
      return `
        <a class="sport-card" href="#sport/${s.id}">
          <div class="sport-card-header">
            <div class="sport-color-bar" style="background:${s.color}"></div>
            <div>
              <h3>${s.name}</h3>
              <div class="sport-meta">
                ${s.startDate && s.endDate
                  ? `${DataManager.formatDate(s.startDate)} ～ ${DataManager.formatDate(s.endDate)}`
                  : '期間未設定'}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:12px;font-size:12px;color:#7f8c8d;">
            <span>🏨 ${hotelCount > 0 ? hotelCount + 'ホテル' : '未設定'}</span>
            <span>📅 ${eventCount} 件のイベント</span>
          </div>
        </a>`;
    }).join('');

    const hotelCards = hotels.map(h => {
      const sportCount = DataManager.getSportsForHotel(h.id).length;
      return `
        <a class="hotel-card" href="#hotel/${h.id}">
          <span class="hotel-icon" style="color:${h.color}">🏨</span>
          <div>
            <h3>${h.name}</h3>
            <div class="hotel-meta">${sportCount > 0 ? sportCount + ' 競技' : '競技未割当'}</div>
          </div>
        </a>`;
    }).join('');

    return `
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <h2 class="page-title" style="margin:0">ダッシュボード</h2>
          <div style="font-size:13px;color:#7f8c8d;">
            全体期間: ${DataManager.formatDateFull(dr.start)} ～ ${DataManager.formatDateFull(dr.end)}
          </div>
        </div>

        <h3 class="section-title">競技 (${sports.length})</h3>
        <div class="dashboard-grid">${sportCards}</div>

        <h3 class="section-title">ホテル (${hotels.length})</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;">
          ${hotelCards}
        </div>
      </div>`;
  }

  // ── Sport View ───────────────────────────────────────────────────────────
  function renderSportView(sportId, container) {
    const sport = DataManager.getSport(sportId);
    if (!sport) {
      container.innerHTML = '<p class="text-muted text-center" style="padding:40px">競技が見つかりません</p>';
      return;
    }

    const hotels      = DataManager.getHotelsForSport(sportId);
    const hotelTags   = hotels.map(h =>
      `<span class="tag" style="background:${h.color}">${h.name}</span>`).join('') || '<span class="text-muted">未設定</span>';

    const dr          = DataManager.getDateRange();
    const startDate   = sport.startDate || dr.start;
    const endDate     = sport.endDate   || dr.end;

    const soccerInfo  = sport.isSoccer ? renderSoccerInfo(sportId) : '';

    container.innerHTML = `
      <div class="detail-header">
        <div class="detail-color-bar" style="background:${sport.color}"></div>
        <div>
          <h2>${sport.name}</h2>
          <div class="detail-sub">
            ${startDate && endDate
              ? `${DataManager.formatDateFull(startDate)} ～ ${DataManager.formatDateFull(endDate)}`
              : '期間未設定'}
          </div>
        </div>
        <div class="detail-header-actions">
          <button class="btn btn-secondary" onclick="ScheduleGrid.showDateRangeModal('${sportId}')">
            📅 期間設定
          </button>
          <button class="btn btn-secondary" onclick="App.showSportSettingsModal('${sportId}')">
            ⚙ 設定
          </button>
          <button class="btn btn-primary" onclick="ExportManager.showExportModal('${sportId}', null)">
            ↓ エクスポート
          </button>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-body">
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">割当ホテル</div>
              <div class="info-value">${hotelTags}</div>
            </div>
            ${sport.isSoccer ? `
              <div class="info-item">
                <div class="info-label">競技会場</div>
                <div class="info-value">
                  ${(sport.venueIds || []).map(vid => {
                    const v = DataManager.getVenue(vid);
                    return v ? `<div style="font-size:12px;">${v.name}</div>` : '';
                  }).join('')}
                </div>
              </div>` : ''}
            ${sport.note ? `
              <div class="info-item" style="grid-column:1/-1">
                <div class="info-label">備考</div>
                <div class="info-value" style="font-weight:normal;font-size:13px;">${sport.note}</div>
              </div>` : ''}
          </div>
        </div>
      </div>

      ${soccerInfo}

      <div class="card">
        <div class="card-header">
          <h2>📅 タイムスケジュール</h2>
        </div>
        <div class="card-body" style="padding:10px">
          <div id="schedule-grid-container"></div>
        </div>
      </div>`;

    // Init schedule grid
    ScheduleGrid.init('schedule-grid-container', sportId, startDate, endDate);
  }

  function renderSoccerInfo(sportId) {
    const groups  = DataManager.getSoccerGroups();
    const matches = DataManager.getSoccerMatches();
    if (groups.length === 0 && matches.length === 0) {
      return `
        <div class="alert alert-info mb-2">
          ⚽ サッカーのグループ・試合設定は
          <a href="#soccer" style="color:#1a5276;font-weight:600">サッカー設定</a> から行えます。
        </div>`;
    }
    return `
      <div class="card mb-2">
        <div class="card-header">
          <h2>⚽ グループ・試合情報</h2>
          <a href="#soccer" class="btn btn-secondary btn-sm">編集</a>
        </div>
        <div class="card-body">
          <div class="group-grid">
            ${groups.map(g => `
              <div class="group-card">
                <div class="group-card-header">
                  <span>グループ ${g.name}</span>
                  <span style="font-size:12px;opacity:0.8">${(g.teams||[]).join(', ')}</span>
                </div>
                <div style="padding:10px;">
                  ${matches.filter(m => m.groupId === g.id).map(m => `
                    <div style="font-size:12px;padding:4px 0;border-bottom:1px solid #eee;">
                      ${DataManager.formatDate(m.date)} ${m.time || ''}
                      ${m.team1} vs ${m.team2}
                      ${m.score ? `<strong>(${m.score})</strong>` : ''}
                    </div>`).join('')}
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  // ── Hotel View ────────────────────────────────────────────────────────────
  function renderHotelView(hotelId, container) {
    const hotel  = DataManager.getHotel(hotelId);
    if (!hotel) {
      container.innerHTML = '<p class="text-muted text-center" style="padding:40px">ホテルが見つかりません</p>';
      return;
    }

    const sports = DataManager.getSportsForHotel(hotelId);
    const sportTags = sports.map(s =>
      `<span class="tag" style="background:${s.color}">${s.shortName || s.name}</span>`).join('') || '<span class="text-muted">未割当</span>';

    // Build tabs for each sport
    const tabBar = sports.length > 0 ? `
      <div class="tab-bar" id="hotel-tab-bar">
        ${sports.map((s, i) => `
          <button class="tab-btn ${i===0?'active':''}" onclick="App.switchHotelTab('${s.id}')">
            ${s.shortName || s.name}
          </button>`).join('')}
      </div>` : '<p class="text-muted">この ホテルに割り当てられた競技はありません。</p>';

    const tabPanels = sports.map((s, i) => {
      const dr    = DataManager.getDateRange();
      const start = s.startDate || dr.start;
      const end   = s.endDate   || dr.end;
      return `
        <div class="tab-panel ${i===0?'active':''}" id="hotel-tab-${s.id}">
          <div id="hotel-schedule-${s.id}"></div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="detail-header">
        <span style="font-size:36px;color:${hotel.color}">🏨</span>
        <div>
          <h2>${hotel.name}</h2>
          <div class="detail-sub">${hotel.address || 'アドレス未設定'}</div>
        </div>
        <div class="detail-header-actions">
          <button class="btn btn-secondary" onclick="App.showHotelSettingsModal('${hotelId}')">
            ⚙ 設定
          </button>
          <button class="btn btn-primary" onclick="ExportManager.showExportModal(null, '${hotelId}')">
            ↓ エクスポート
          </button>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-body">
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">担当競技</div>
              <div class="info-value">${sportTags}</div>
            </div>
            ${hotel.tel ? `<div class="info-item"><div class="info-label">電話</div><div class="info-value">${hotel.tel}</div></div>` : ''}
            ${hotel.note ? `<div class="info-item" style="grid-column:1/-1"><div class="info-label">備考</div><div class="info-value" style="font-weight:normal">${hotel.note}</div></div>` : ''}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2>📅 タイムスケジュール</h2></div>
        <div class="card-body" style="padding:10px">
          ${tabBar}
          ${tabPanels}
        </div>
      </div>`;

    // Init only the first (active) tab's grid; others are initialized on tab switch
    if (sports.length > 0) {
      const s     = sports[0];
      const dr    = DataManager.getDateRange();
      const start = s.startDate || dr.start;
      const end   = s.endDate   || dr.end;
      ScheduleGrid.init(`hotel-schedule-${s.id}`, s.id, start, end);
    }
  }

  function switchHotelTab(sportId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim() === (DataManager.getSport(sportId)?.shortName || sportId));
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === `hotel-tab-${sportId}`);
    });
    // Re-init ScheduleGrid with the correct sportId for this tab
    const sport = DataManager.getSport(sportId);
    if (sport) {
      const dr    = DataManager.getDateRange();
      const start = sport.startDate || dr.start;
      const end   = sport.endDate   || dr.end;
      ScheduleGrid.init(`hotel-schedule-${sportId}`, sportId, start, end);
    }
  }

  // ── Soccer Config ─────────────────────────────────────────────────────────
  function renderSoccerConfig() {
    const venues  = DataManager.getVenues();
    const hotels  = DataManager.getHotels();
    const groups  = DataManager.getSoccerGroups();
    const matches = DataManager.getSoccerMatches();
    const sport   = DataManager.getSport('soccer_w');

    const venueRows = venues.map(v => `
      <tr>
        <td style="padding:8px 10px">${v.name}</td>
        <td style="padding:8px 10px">
          <select onchange="App.updateVenueHotel('${v.id}', this.value)" style="width:100%">
            <option value="">-- 選択 --</option>
            ${hotels.map(h => `
              <option value="${h.id}" ${v.hotelId === h.id ? 'selected' : ''}>${h.name}</option>`).join('')}
          </select>
        </td>
        <td style="padding:8px 10px;font-size:12px;color:#7f8c8d">
          ${v.address || ''}
        </td>
      </tr>`).join('');

    const groupCards = groups.map((g, gi) => `
      <div class="group-card">
        <div class="group-card-header">
          <span>グループ ${g.name}</span>
          <button class="btn btn-xs btn-danger" onclick="App.deleteGroup(${gi})">削除</button>
        </div>
        <div style="padding:10px">
          <div class="form-group">
            <label>チーム (カンマ区切り)</label>
            <input type="text" value="${(g.teams||[]).join(', ')}"
              onchange="App.updateGroupTeams(${gi}, this.value)"
              placeholder="例: 日本, 中国, 韓国, ...">
          </div>
        </div>
      </div>`).join('');

    const matchRows = matches.map((m, mi) => `
      <tr>
        <td style="padding:6px 8px">
          <select onchange="App.updateMatch(${mi}, 'groupId', this.value)" style="min-width:100px">
            <option value="">--</option>
            ${groups.map(g => `<option value="${g.id}" ${m.groupId === g.id ? 'selected' : ''}>Gr.${g.name}</option>`).join('')}
          </select>
        </td>
        <td style="padding:6px 8px">
          <input type="date" value="${m.date||''}" style="width:130px"
            onchange="App.updateMatch(${mi}, 'date', this.value)">
        </td>
        <td style="padding:6px 8px">
          <input type="time" value="${m.time||''}" style="width:80px"
            onchange="App.updateMatch(${mi}, 'time', this.value)">
        </td>
        <td style="padding:6px 8px">
          <input type="text" value="${m.team1||''}" placeholder="チーム1" style="width:100px"
            onchange="App.updateMatch(${mi}, 'team1', this.value)">
        </td>
        <td style="padding:6px 8px">
          <input type="text" value="${m.team2||''}" placeholder="チーム2" style="width:100px"
            onchange="App.updateMatch(${mi}, 'team2', this.value)">
        </td>
        <td style="padding:6px 8px">
          <select onchange="App.updateMatch(${mi}, 'venueId', this.value)" style="min-width:130px">
            <option value="">-- 会場 --</option>
            ${venues.map(v => `<option value="${v.id}" ${m.venueId === v.id ? 'selected' : ''}>${v.name}</option>`).join('')}
          </select>
        </td>
        <td style="padding:6px 8px">
          <input type="text" value="${m.score||''}" placeholder="例: 2-1" style="width:60px"
            onchange="App.updateMatch(${mi}, 'score', this.value)">
        </td>
        <td style="padding:6px 8px">
          <button class="btn btn-danger btn-xs" onclick="App.deleteMatch(${mi})">削除</button>
        </td>
      </tr>`).join('');

    return `
      <div>
        <h2 class="page-title">⚽ サッカー（女子）設定</h2>

        <div class="tab-bar" id="soccer-tabs">
          <button class="tab-btn active" onclick="App.switchTab('soccer', 'venues')">会場・ホテル設定</button>
          <button class="tab-btn" onclick="App.switchTab('soccer', 'groups')">グループ設定</button>
          <button class="tab-btn" onclick="App.switchTab('soccer', 'matches')">試合スケジュール</button>
        </div>

        <!-- Tab: Venues -->
        <div class="tab-panel active" id="soccer-tab-venues">
          <div class="card">
            <div class="card-header"><h2>会場とホテルの紐付け</h2></div>
            <div class="card-body" style="padding:0">
              <table class="match-table" style="width:100%">
                <thead>
                  <tr>
                    <th>会場名</th>
                    <th>担当ホテル</th>
                    <th>住所</th>
                  </tr>
                </thead>
                <tbody>${venueRows}</tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Tab: Groups -->
        <div class="tab-panel" id="soccer-tab-groups">
          <div class="card">
            <div class="card-header">
              <h2>グループ設定</h2>
              <button class="btn btn-primary btn-sm" onclick="App.addGroup()">＋ グループ追加</button>
            </div>
            <div class="card-body">
              <div class="group-grid" id="group-grid">
                ${groupCards || '<p class="text-muted">グループがありません。「グループ追加」ボタンから作成してください。</p>'}
              </div>
            </div>
          </div>
        </div>

        <!-- Tab: Matches -->
        <div class="tab-panel" id="soccer-tab-matches">
          <div class="card">
            <div class="card-header">
              <h2>試合スケジュール</h2>
              <button class="btn btn-primary btn-sm" onclick="App.addMatch()">＋ 試合追加</button>
            </div>
            <div class="card-body" style="padding:0;overflow-x:auto">
              <table class="match-table" style="width:100%">
                <thead>
                  <tr>
                    <th>グループ</th>
                    <th>日付</th>
                    <th>時刻</th>
                    <th>チーム1</th>
                    <th>チーム2</th>
                    <th>会場</th>
                    <th>スコア</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="match-tbody">${matchRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;
  }

  // Soccer tab switching
  function switchTab(prefix, tab) {
    document.querySelectorAll(`#${prefix}-tabs .tab-btn`).forEach((btn, i) => {
      const panels = document.querySelectorAll(`[id^="${prefix}-tab-"]`);
      const isActive = i === ['venues','groups','matches'].indexOf(tab);
      btn.classList.toggle('active', isActive);
      if (panels[i]) panels[i].classList.toggle('active', isActive);
    });
  }

  // Soccer group management
  function addGroup() {
    const groups = DataManager.getSoccerGroups();
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const name = letters[groups.length] || String(groups.length + 1);
    groups.push({ id: `group_${name}`, name, teams: [] });
    DataManager.saveSoccerGroups(groups);
    navigate('soccer');
  }

  function deleteGroup(index) {
    if (!confirm('このグループを削除しますか？')) return;
    const groups = DataManager.getSoccerGroups();
    groups.splice(index, 1);
    DataManager.saveSoccerGroups(groups);
    navigate('soccer');
  }

  function updateGroupTeams(index, value) {
    const groups = DataManager.getSoccerGroups();
    if (!groups[index]) return;
    groups[index].teams = value.split(',').map(t => t.trim()).filter(Boolean);
    DataManager.saveSoccerGroups(groups);
  }

  // Soccer match management
  function addMatch() {
    const matches = DataManager.getSoccerMatches();
    const dr = DataManager.getDateRange();
    matches.push({ date: dr.start, time: '10:00', team1: '', team2: '', groupId: '', venueId: '', score: '' });
    DataManager.saveSoccerMatches(matches);
    navigate('soccer');
  }

  function deleteMatch(index) {
    if (!confirm('この試合を削除しますか？')) return;
    const matches = DataManager.getSoccerMatches();
    matches.splice(index, 1);
    DataManager.saveSoccerMatches(matches);
    navigate('soccer');
  }

  function updateMatch(index, field, value) {
    const matches = DataManager.getSoccerMatches();
    if (!matches[index]) return;
    matches[index][field] = value;
    DataManager.saveSoccerMatches(matches);
  }

  function updateVenueHotel(venueId, hotelId) {
    DataManager.updateVenue(venueId, { hotelId });
    showToast('会場のホテルを更新しました');
  }

  // ── Data Management ───────────────────────────────────────────────────────
  function renderDataManagement() {
    return `
      <div>
        <h2 class="page-title">💾 データ管理</h2>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <!-- Import -->
          <div class="card">
            <div class="card-header"><h2>インポート</h2></div>
            <div class="card-body">
              <p style="font-size:13px;color:#7f8c8d;margin-bottom:16px">
                xlsx / csv / json ファイルから競技・ホテル情報やスケジュールデータを読み込みます。
              </p>

              <div class="form-group">
                <label>マスターデータ (sports, hotels, venues) — xlsx / json</label>
                <div class="upload-zone" onclick="document.getElementById('import-master').click()">
                  <div class="upload-icon">📂</div>
                  <div class="upload-text">master.xlsx または master.json をクリックして選択</div>
                </div>
                <input type="file" id="import-master" accept=".xlsx,.json" class="hidden"
                  onchange="App.importMaster(this)">
              </div>

              <div class="form-group">
                <label>スケジュールデータ — xlsx / csv / json</label>
                <div class="upload-zone" onclick="document.getElementById('import-schedules').click()">
                  <div class="upload-icon">📂</div>
                  <div class="upload-text">schedules.xlsx / .csv / .json をクリックして選択</div>
                </div>
                <input type="file" id="import-schedules" accept=".xlsx,.csv,.json" class="hidden"
                  onchange="App.importSchedules(this)">
              </div>

              <div class="form-group">
                <label>全データ（バックアップから復元）— xlsx / json</label>
                <div class="upload-zone" onclick="document.getElementById('import-full').click()">
                  <div class="upload-icon">📂</div>
                  <div class="upload-text">backup.xlsx または backup.json をクリックして選択</div>
                </div>
                <input type="file" id="import-full" accept=".xlsx,.json" class="hidden"
                  onchange="App.importFull(this)">
              </div>
            </div>
          </div>

          <!-- Export -->
          <div class="card">
            <div class="card-header"><h2>エクスポート</h2></div>
            <div class="card-body">
              <p style="font-size:13px;color:#7f8c8d;margin-bottom:16px">
                データをファイルに保存します。定期的にバックアップを取ることをお勧めします。
              </p>

              <div style="display:grid;gap:10px;">
                <button class="btn btn-secondary" onclick="App.exportMaster()">
                  📊 マスターデータ (master.xlsx) をダウンロード
                </button>
                <button class="btn btn-secondary" onclick="App.exportSchedules('xlsx')">
                  📅 スケジュールデータ (schedules.xlsx) をダウンロード
                </button>
                <button class="btn btn-outline" onclick="App.exportSchedules('csv')" style="font-size:12px">
                  📄 スケジュールデータ (schedules.csv) をダウンロード
                </button>
                <button class="btn btn-primary" onclick="App.exportScheduleTemplate()" style="background:#8e44ad;border-color:#8e44ad">
                  📋 スケジュール入力テンプレート (.xlsx) をダウンロード
                </button>
                <div style="font-size:11px;color:#7f8c8d;margin-top:-4px;padding:0 4px">
                  ↑ チェックイン・朝食・夕食・チェックアウトが競技ごとに自動入力済。Excelで編集後アップロード可能。カテゴリ・競技ID一覧・使い方シート付き。
                </div>
                <button class="btn btn-primary" onclick="App.exportFull()">
                  💾 全データバックアップ (backup.xlsx) をダウンロード
                </button>
                <hr style="margin:8px 0;border:none;border-top:1px solid #eee">
                <button class="btn btn-success" onclick="ExportManager.exportAllToExcel()">
                  📊 全競技スケジュール Excel (.xlsx) でダウンロード
                </button>
              </div>

              <div class="alert alert-warning mt-2">
                ⚠ データはブラウザのローカルストレージに保存されています。
                ブラウザのキャッシュクリアで消えることがあるため、定期的にバックアップしてください。
              </div>
            </div>
          </div>
        </div>

        <!-- Sport settings quick editor -->
        <div class="card mt-2">
          <div class="card-header"><h2>競技設定一覧</h2></div>
          <div class="card-body" style="padding:0">
            <table class="match-table" style="width:100%">
              <thead>
                <tr>
                  <th>競技名</th>
                  <th>滞在開始</th>
                  <th>滞在終了</th>
                  <th>割当ホテル</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${DataManager.getSports().map(s => {
                  const hotels = DataManager.getHotelsForSport(s.id);
                  return `
                    <tr>
                      <td style="padding:8px 10px">
                        <span class="sidebar-dot" style="background:${s.color};display:inline-block;margin-right:6px"></span>
                        ${s.name}
                      </td>
                      <td style="padding:8px 10px">
                        <input type="date" value="${s.startDate||''}" style="width:130px"
                          onchange="App.quickUpdateSport('${s.id}','startDate',this.value)"
                          min="2026-09-10" max="2026-10-07">
                      </td>
                      <td style="padding:8px 10px">
                        <input type="date" value="${s.endDate||''}" style="width:130px"
                          onchange="App.quickUpdateSport('${s.id}','endDate',this.value)"
                          min="2026-09-10" max="2026-10-07">
                      </td>
                      <td style="padding:8px 10px;font-size:12px">
                        ${s.isSoccer
                          ? '(会場により異なる)'
                          : hotels.map(h => `<span class="tag" style="background:${h.color};font-size:11px">${h.name}</span>`).join('') || '未設定'}
                      </td>
                      <td style="padding:8px 10px">
                        <a href="#sport/${s.id}" class="btn btn-secondary btn-sm">詳細</a>
                      </td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Hotel settings -->
        <div class="card mt-2">
          <div class="card-header"><h2>ホテル設定一覧</h2></div>
          <div class="card-body" style="padding:0">
            <table class="match-table" style="width:100%">
              <thead>
                <tr><th>ホテル名</th><th>担当競技</th><th>住所</th><th></th></tr>
              </thead>
              <tbody>
                ${DataManager.getHotels().map(h => {
                  const sports = DataManager.getSportsForHotel(h.id);
                  return `
                    <tr>
                      <td style="padding:8px 10px">
                        <span style="color:${h.color}">🏨</span> ${h.name}
                      </td>
                      <td style="padding:8px 10px">
                        ${sports.map(s => `<span class="tag" style="background:${s.color};font-size:11px">${s.shortName||s.name}</span>`).join('')||'未設定'}
                      </td>
                      <td style="padding:8px 10px;font-size:12px">${h.address||''}</td>
                      <td style="padding:8px 10px">
                        <button class="btn btn-secondary btn-sm" onclick="App.showHotelSettingsModal('${h.id}')">設定</button>
                      </td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card mt-2">
          <div class="card-header"><h2 style="color:#c0392b">⚠ 危険操作</h2></div>
          <div class="card-body">
            <button class="btn btn-danger" onclick="App.clearAllData()">
              🗑 全スケジュールデータを消去
            </button>
            <p style="font-size:12px;color:#7f8c8d;margin-top:8px">
              マスターデータ（競技・ホテル情報）は残ります。スケジュールとテンプレートのみ削除されます。
            </p>
          </div>
        </div>
      </div>`;
  }

  // ── Sport Settings Modal ──────────────────────────────────────────────────
  function showSportSettingsModal(sportId) {
    const sport  = DataManager.getSport(sportId);
    if (!sport) return;
    const hotels = DataManager.getHotels();
    const dr     = DataManager.getDateRange();

    const hotelCheckboxes = !sport.isSoccer ? hotels.map(h => `
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px;cursor:pointer;">
        <input type="checkbox" value="${h.id}" ${(sport.hotelIds||[]).includes(h.id) ? 'checked' : ''}>
        <span class="sidebar-dot" style="background:${h.color}"></span>
        ${h.name}
      </label>`).join('') : '<p class="text-muted" style="font-size:13px">サッカーのホテル割当は「サッカー設定」で行います</p>';

    const html = `
      <div class="modal-overlay" id="sport-settings-modal" onclick="if(event.target===this)App.closeSportSettingsModal()">
        <div class="modal modal-wide">
          <div class="modal-header">
            <h3>${sport.name} の設定</h3>
            <button class="modal-close" onclick="App.closeSportSettingsModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>滞在開始日</label>
                <input type="date" id="ss-start" value="${sport.startDate||''}" min="${dr.start}" max="${dr.end}">
              </div>
              <div class="form-group">
                <label>滞在終了日</label>
                <input type="date" id="ss-end" value="${sport.endDate||''}" min="${dr.start}" max="${dr.end}">
              </div>
            </div>
            <div class="form-group">
              <label>割当ホテル</label>
              <div id="hotel-checkboxes">${hotelCheckboxes}</div>
            </div>
            <div class="form-group">
              <label>備考</label>
              <textarea id="ss-note" rows="2">${sport.note||''}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="App.closeSportSettingsModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="App.saveSportSettings('${sportId}')">保存</button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  function closeSportSettingsModal() {
    const m = document.getElementById('sport-settings-modal');
    if (m) m.remove();
  }

  function saveSportSettings(sportId) {
    const start = document.getElementById('ss-start').value;
    const end   = document.getElementById('ss-end').value;
    const note  = document.getElementById('ss-note').value;

    if (start && end && start > end) { alert('終了日は開始日より後にしてください'); return; }

    const hotelIds = [...document.querySelectorAll('#hotel-checkboxes input:checked')].map(cb => cb.value);

    DataManager.updateSport(sportId, { startDate: start, endDate: end, hotelIds, note });
    closeSportSettingsModal();
    navigate(`sport/${sportId}`);
    showToast('設定を保存しました');
  }

  // ── Hotel Settings Modal ───────────────────────────────────────────────────
  function showHotelSettingsModal(hotelId) {
    const hotel  = DataManager.getHotel(hotelId);
    if (!hotel) return;
    const sports = DataManager.getSports().filter(s => !s.isSoccer);

    const html = `
      <div class="modal-overlay" id="hotel-settings-modal" onclick="if(event.target===this)App.closeHotelSettingsModal()">
        <div class="modal modal-wide">
          <div class="modal-header">
            <h3>${hotel.name} の設定</h3>
            <button class="modal-close" onclick="App.closeHotelSettingsModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>ホテル名</label>
              <input type="text" id="hs-name" value="${hotel.name.replace(/"/g,'&quot;')}">
            </div>
            <div class="form-group">
              <label>住所</label>
              <input type="text" id="hs-address" value="${(hotel.address||'').replace(/"/g,'&quot;')}" placeholder="住所を入力">
            </div>
            <div class="form-group">
              <label>電話番号</label>
              <input type="text" id="hs-tel" value="${(hotel.tel||'').replace(/"/g,'&quot;')}" placeholder="例: 052-000-0000">
            </div>
            <div class="form-group">
              <label>担当競技（サッカー以外）</label>
              ${sports.map(s => `
                <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px;cursor:pointer;">
                  <input type="checkbox" name="hs-sport" value="${s.id}"
                    ${(s.hotelIds||[]).includes(hotelId) ? 'checked' : ''}>
                  <span class="sidebar-dot" style="background:${s.color}"></span>
                  ${s.name}
                </label>`).join('')}
              <p class="text-muted" style="font-size:12px;margin-top:6px">
                ※サッカーの担当設定は「サッカー設定」の会場ページで行います。
              </p>
            </div>
            <div class="form-group">
              <label>備考</label>
              <textarea id="hs-note" rows="2">${hotel.note||''}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="App.closeHotelSettingsModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="App.saveHotelSettings('${hotelId}')">保存</button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  function closeHotelSettingsModal() {
    const m = document.getElementById('hotel-settings-modal');
    if (m) m.remove();
  }

  function saveHotelSettings(hotelId) {
    const name    = document.getElementById('hs-name').value.trim();
    const address = document.getElementById('hs-address').value.trim();
    const tel     = document.getElementById('hs-tel').value.trim();
    const note    = document.getElementById('hs-note').value;

    if (!name) { alert('ホテル名を入力してください'); return; }

    DataManager.updateHotel(hotelId, { name, address, tel, note });

    // Update sport → hotel assignments
    const checked = [...document.querySelectorAll('input[name="hs-sport"]:checked')].map(cb => cb.value);
    const unchecked = [...document.querySelectorAll('input[name="hs-sport"]:not(:checked)')].map(cb => cb.value);

    checked.forEach(sportId => {
      const sport = DataManager.getSport(sportId);
      if (sport && !(sport.hotelIds||[]).includes(hotelId)) {
        DataManager.updateSport(sportId, { hotelIds: [...(sport.hotelIds||[]), hotelId] });
      }
    });

    unchecked.forEach(sportId => {
      const sport = DataManager.getSport(sportId);
      if (sport) {
        DataManager.updateSport(sportId, { hotelIds: (sport.hotelIds||[]).filter(h => h !== hotelId) });
      }
    });

    closeHotelSettingsModal();
    renderSidebar();
    showToast('設定を保存しました');
  }

  // ── Import/Export handlers ────────────────────────────────────────────────
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function getFileExt(file) {
    return file.name.split('.').pop().toLowerCase();
  }

  async function importMaster(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    try {
      const ext = getFileExt(file);
      if (ext === 'xlsx') {
        const buf = await readFileAsArrayBuffer(file);
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        DataManager.importMasterXLSX(wb);
      } else {
        const text = await readFileAsText(file);
        DataManager.importMasterJSON(text);
      }
      renderSidebar();
      navigate('dashboard');
      showToast('マスターデータをインポートしました', 'success');
    } catch(e) {
      alert('インポートエラー: ' + e.message);
    }
    input.value = '';
  }

  async function importSchedules(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    try {
      const ext = getFileExt(file);
      if (ext === 'xlsx') {
        const buf = await readFileAsArrayBuffer(file);
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        DataManager.importSchedulesXLSX(wb);
      } else if (ext === 'csv') {
        const text = await readFileAsText(file);
        DataManager.importSchedulesCSV(text);
      } else {
        const text = await readFileAsText(file);
        DataManager.importSchedulesJSON(text);
      }
      showToast('スケジュールデータをインポートしました', 'success');
    } catch(e) {
      alert('インポートエラー: ' + e.message);
    }
    input.value = '';
  }

  async function importFull(input) {
    if (!input.files || !input.files[0]) return;
    if (!confirm('全データを上書きします。よろしいですか？')) return;
    const file = input.files[0];
    try {
      const ext = getFileExt(file);
      if (ext === 'xlsx') {
        const buf = await readFileAsArrayBuffer(file);
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        DataManager.importFullXLSX(wb);
      } else {
        const text = await readFileAsText(file);
        DataManager.importFullJSON(text);
      }
      renderSidebar();
      navigate('dashboard');
      showToast('データを復元しました', 'success');
    } catch(e) {
      alert('インポートエラー: ' + e.message);
    }
    input.value = '';
  }

  function exportMaster() {
    ExportManager.exportMasterXLSX();
    showToast('マスターデータをダウンロードしました');
  }

  function exportSchedules(fmt) {
    if (fmt === 'csv') {
      ExportManager.exportSchedulesCSV();
      showToast('スケジュールデータ (CSV) をダウンロードしました');
    } else {
      ExportManager.exportSchedulesXLSX();
      showToast('スケジュールデータをダウンロードしました');
    }
  }

  function exportScheduleTemplate() {
    ExportManager.exportScheduleTemplate();
    showToast('スケジュール入力テンプレートをダウンロードしました');
  }

  function exportFull() {
    ExportManager.exportFullXLSX();
    showToast('バックアップをダウンロードしました');
  }

  function clearAllData() {
    if (!confirm('全スケジュールデータとテンプレートを削除します。\nこの操作は元に戻せません。よろしいですか？')) return;
    DataManager.clearAllData();
    showToast('データを消去しました', 'warning');
  }

  function quickUpdateSport(sportId, field, value) {
    DataManager.updateSport(sportId, { [field]: value });
  }

  // ── Toast notifications ──────────────────────────────────────────────────
  function showToast(message, type = 'success') {
    const colors = { success: '#27ae60', warning: '#f39c12', error: '#e74c3c' };
    const toast = document.createElement('div');
    toast.style.cssText = `
      position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
      background:${colors[type]||colors.success};color:white;
      padding:10px 24px;border-radius:24px;font-size:13px;font-weight:600;
      box-shadow:0 4px 16px rgba(0,0,0,0.2);z-index:9999;
      animation:fadeIn 0.2s ease;white-space:nowrap;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 2000);
    setTimeout(() => toast.remove(), 2400);
  }

  return {
    init, navigate, renderView, renderSidebar,
    switchHotelTab, switchTab,
    addGroup, deleteGroup, updateGroupTeams,
    addMatch, deleteMatch, updateMatch, updateVenueHotel,
    showSportSettingsModal, closeSportSettingsModal, saveSportSettings,
    showHotelSettingsModal, closeHotelSettingsModal, saveHotelSettings,
    importMaster, importSchedules, importFull,
    exportMaster, exportSchedules, exportFull, exportScheduleTemplate,
    clearAllData, quickUpdateSport,
    showToast,
  };
})();

// ── Start app ──────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => App.init());
