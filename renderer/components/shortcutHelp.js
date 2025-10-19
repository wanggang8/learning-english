// 快捷键帮助面板：F1 或 ? 打开，Esc 关闭
(function(){
  const PANEL_ID = 'shortcutHelpPanel';

  const SHORTCUTS = [
    { keys: ['空格'], desc: '主要动作（开始抽取 / 抽取单词 / 返回）' },
    { keys: ['R'], desc: '重抽（开始下一次抽取）' },
    { keys: ['H'], desc: '切换历史面板' },
    { keys: ['Esc'], desc: '返回 / 关闭面板 / 退出全屏' },
    { keys: ['F1', '?'], desc: '打开/关闭快捷键帮助' }
  ];

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'shortcut-help-panel';
    panel.innerHTML = `
      <div class="shp-content">
        <div class="shp-header">
          <div class="shp-title">⌨️ 快捷键帮助</div>
          <button id="shpCloseBtn" class="shp-close" title="关闭 (Esc)">✖</button>
        </div>
        <div class="shp-body" id="shpBody"></div>
        <div class="shp-footer">按 F1 或 ? 打开/关闭此面板 · 按 Esc 关闭</div>
      </div>
    `;
    document.body.appendChild(panel);

    const closeBtn = panel.querySelector('#shpCloseBtn');
    closeBtn?.addEventListener('click', close);

    const body = panel.querySelector('#shpBody');
    body.innerHTML = '';
    for (const item of SHORTCUTS) {
      const row = document.createElement('div');
      row.className = 'shp-row';
      row.innerHTML = `
        <div class="shp-keys">${item.keys.map(k => `<span class="shp-key">${k}</span>`).join(' + ')}</div>
        <div class="shp-desc">${item.desc}</div>
      `;
      body.appendChild(row);
    }

    return panel;
  }

  function open() {
    const panel = ensurePanel();
    panel.classList.add('visible');
  }

  function close() {
    const panel = ensurePanel();
    panel.classList.remove('visible');
  }

  function toggle() {
    const panel = ensurePanel();
    panel.classList.toggle('visible');
  }

  window.ShortcutHelp = Object.freeze({ open, close, toggle });
})();
