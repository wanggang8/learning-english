// 历史面板组件：显示当前会话抽取历史与统计
(function () {
  const STORAGE_KEYS = Object.freeze({
    VISIBLE: 'historyPanelVisible',
    SORT: 'historyPanelSort'
  });

  const SORT_MODES = Object.freeze({
    TIME: 'time',
    COUNT: 'count'
  });

  const SELECTORS = Object.freeze({
    PANEL_ID: 'historyPanel',
    TOGGLE_ID: 'historyToggleBtn'
  });

  let sortMode = SORT_MODES.TIME;
  let visible = false;

  function readStateFromStorage() {
    try {
      const v = localStorage.getItem(STORAGE_KEYS.VISIBLE);
      visible = v === '1';
    } catch (e) { visible = false; }

    try {
      const s = localStorage.getItem(STORAGE_KEYS.SORT);
      sortMode = (s === SORT_MODES.COUNT || s === SORT_MODES.TIME) ? s : SORT_MODES.TIME;
    } catch (e) { sortMode = SORT_MODES.TIME; }
  }

  function writeVisibility(v) {
    try { localStorage.setItem(STORAGE_KEYS.VISIBLE, v ? '1' : '0'); } catch (e) {}
  }

  function writeSortMode(s) {
    try { localStorage.setItem(STORAGE_KEYS.SORT, s); } catch (e) {}
  }

  function ensurePanel() {
    let panel = document.getElementById(SELECTORS.PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = SELECTORS.PANEL_ID;
      panel.className = 'history-panel';
      panel.innerHTML = `
        <div class="history-header">
          <div class="history-title">📜 抽取历史</div>
          <div class="history-actions">
            <div class="history-sort">
              <button id="hpSortTime" class="hp-sort-btn" data-mode="time">按时间</button>
              <button id="hpSortCount" class="hp-sort-btn" data-mode="count">按次数</button>
            </div>
            <button id="hpClearBtn" class="hp-clear-btn" title="清空历史">🗑</button>
            <button id="hpCloseBtn" class="hp-close-btn" title="关闭">✖</button>
          </div>
        </div>
        <div class="history-summary" id="historySummary"></div>
        <div class="history-content" id="historyContent"></div>
        <div class="history-footer">按 H 键开关 / Esc 关闭</div>
      `;
      document.body.appendChild(panel);

      // 绑定事件
      panel.querySelector('#hpCloseBtn')?.addEventListener('click', () => hide());
      panel.querySelector('#hpClearBtn')?.addEventListener('click', () => {
        if (window.showClearHistoryDialog) {
          window.showClearHistoryDialog();
        } else {
          try { window.PersistenceService?.clearHistory({ scope: 'current' }); } catch (e) {}
        }
        // 清理后刷新
        setTimeout(refresh, 50);
      });

      panel.querySelectorAll('.hp-sort-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const mode = e.currentTarget.getAttribute('data-mode');
          if (mode === SORT_MODES.TIME || mode === SORT_MODES.COUNT) {
            setSortMode(mode);
          }
        });
      });
    }
    return panel;
  }

  function ensureToggleButton() {
    let btn = document.getElementById(SELECTORS.TOGGLE_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = SELECTORS.TOGGLE_ID;
      btn.className = 'history-toggle';
      btn.title = '历史面板 (H)';
      btn.textContent = '🕘';
      btn.addEventListener('click', toggle);
      document.body.appendChild(btn);
    }
    return btn;
  }

  function setSortMode(mode) {
    sortMode = mode;
    writeSortMode(mode);
    // 更新按钮激活样式
    const timeBtn = document.getElementById('hpSortTime');
    const countBtn = document.getElementById('hpSortCount');
    timeBtn?.classList.toggle('active', mode === SORT_MODES.TIME);
    countBtn?.classList.toggle('active', mode === SORT_MODES.COUNT);
    refresh();
  }

  function formatTime(iso) {
    try {
      const d = new Date(iso);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    } catch (e) {
      return '--:--:--';
    }
  }

  function getState() {
    try {
      const result = window.PersistenceService?.getState();
      if (result && result.success) {
        return result.data;
      }
    } catch (e) {}
    return null;
  }

  function buildTimeList(events) {
    const list = document.createElement('ul');
    list.className = 'history-list time-list';

    const sorted = (events || []).slice().sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    if (!sorted.length) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = '暂无历史事件';
      return empty;
    }

    for (const e of sorted) {
      const li = document.createElement('li');
      li.className = 'history-item';
      const time = formatTime(e.timestamp);
      const student = e.student || '——';
      const wordText = (e && e.word && typeof e.word === 'object') ? (e.word.word || '——') : (e.word || '——');
      li.innerHTML = `<span class="h-time">${time}</span><span class="h-name">${student}</span><span class="h-word">${wordText}</span>`;
      list.appendChild(li);
    }
    return list;
  }

  function buildCountList(events) {
    const wrap = document.createElement('div');
    wrap.className = 'count-list';

    const statMap = new Map();
    (events || []).forEach((e) => {
      const key = e.student || '（未命名）';
      if (!statMap.has(key)) {
        statMap.set(key, { name: key, count: 0, lastAt: e.timestamp || null });
      }
      const rec = statMap.get(key);
      rec.count += 1;
      if (!rec.lastAt || (e.timestamp && e.timestamp.localeCompare(rec.lastAt) > 0)) {
        rec.lastAt = e.timestamp;
      }
    });

    const arr = Array.from(statMap.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return (b.lastAt || '').localeCompare(a.lastAt || '');
    });

    if (!arr.length) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = '暂无统计数据';
      return empty;
    }

    const list = document.createElement('ul');
    list.className = 'history-list count-mode-list';
    for (const rec of arr) {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `<span class="h-name">${rec.name}</span><span class="h-badge">${rec.count}</span><span class="h-time">${formatTime(rec.lastAt)}</span>`;
      list.appendChild(li);
    }
    return list;
  }

  function refresh() {
    const panel = ensurePanel();
    const state = getState();
    const events = state?.sessionHistory?.activeSession?.events || [];
    const reviews = state?.sessionHistory?.activeSession?.wordsReview || [];

    const summaryEl = document.getElementById('historySummary');
    const uniqStudents = new Set(events.map(e => e.student || '（未命名）'));
    const masteryChanges = reviews.filter(r => r && r.action === 'mastery').length;
    const favChanges = reviews.filter(r => r && r.action === 'favorite').length;
    const reviewCount = reviews.length;
    summaryEl.textContent = `本节共 ${events.length} 次 | 涉及 ${uniqStudents.size} 人` + (reviewCount ? ` | 复习 ${reviewCount}（掌握度 ${masteryChanges} · 收藏 ${favChanges}）` : '');

    const content = document.getElementById('historyContent');
    content.innerHTML = '';
    if (sortMode === SORT_MODES.TIME) {
      content.appendChild(buildTimeList(events));
    } else {
      content.appendChild(buildCountList(events));
    }
  }

  function show() {
    visible = true;
    writeVisibility(true);
    ensurePanel().classList.add('visible');
    const btn = ensureToggleButton();
    btn && btn.classList.add('active');
    refresh();
  }

  function hide() {
    visible = false;
    writeVisibility(false);
    ensurePanel().classList.remove('visible');
    const btn = ensureToggleButton();
    btn && btn.classList.remove('active');
  }

  function toggle() {
    if (visible) hide(); else show();
  }

  function init() {
    readStateFromStorage();
    ensurePanel();
    ensureToggleButton();
    // 键盘快捷键由 KeyboardManager 统一处理
    setSortMode(sortMode);
    if (visible) {
      show();
    } else {
      hide();
    }
  }

  window.HistoryPanel = Object.freeze({
    init,
    refresh,
    show,
    hide,
    toggle
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
