// keyboardManager：集中管理键盘快捷键，避免在各模块分散监听
(function(){
  const STORAGE_KEY = 'app.shortcutMap.v1';

  const DEFAULT_MAP = Object.freeze({
    Space: 'primary', // 按当前上下文触发主要动作
    ArrowLeft: 'flashcard.prev',
    ArrowRight: 'flashcard.next',
    r: 'draw.redo',
    R: 'draw.redo',
    h: 'history.toggle',
    H: 'history.toggle',
    F11: 'window.fullscreenToggle',
    Escape: 'ui.backOrExit',
    F1: 'help.toggle',
    '?': 'help.open'
  });

  let map = { ...DEFAULT_MAP };

  function loadMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const cfg = JSON.parse(raw);
      if (cfg && typeof cfg === 'object') {
        map = { ...DEFAULT_MAP, ...cfg };
      }
    } catch (e) {
      map = { ...DEFAULT_MAP };
    }
  }

  function saveMap() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch (e) {}
  }

  function isEditableTarget(target) {
    if (!target) return false;
    const tag = (target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    const editable = target.isContentEditable || target.getAttribute?.('contenteditable') === 'true';
    return !!editable;
  }

  function anyBlockingOverlayVisible() {
    // 文件导入、模态、其他弹层显示时，屏蔽除必要关闭键外的快捷键
    if (document.getElementById('filePrompt')) return true;
    if (document.querySelector('.modal.active')) return true;
    return false;
  }

  function handlePrimaryAction() {
    const screen = window.AppCommands?.getActiveScreenId?.() || null;
    switch (screen) {
      case 'startScreen':
        return window.AppCommands?.drawStart?.();
      case 'resultScreen':
        return window.AppCommands?.wordShow?.();
      case 'wordScreen':
        return window.AppCommands?.uiBack?.();
      case 'flashcardScreen':
        return window.AppCommands?.flashcardFlip?.();
      default:
        return; // drawingScreen 或未知状态不处理
    }
  }

  function exec(action) {
    switch (action) {
      case 'primary':
        return handlePrimaryAction();
      case 'draw.redo':
        return window.AppCommands?.drawRedo?.();
      case 'history.toggle':
        return window.AppCommands?.historyToggle?.();
      case 'help.open':
        return window.AppCommands?.helpOpen?.();
      case 'help.toggle':
        return window.AppCommands?.helpToggle?.();
      case 'ui.backOrExit':
        return window.AppCommands?.backOrExitFullscreen?.();
      case 'window.fullscreenToggle':
        return window.AppCommands?.fullscreenToggle?.();
      case 'flashcard.prev':
        return window.AppCommands?.flashcardPrev?.();
      case 'flashcard.next':
        return window.AppCommands?.flashcardNext?.();
      default:
        // 支持通过事件总线触发自定义命令
        if (window.AppEvents) {
          window.AppEvents.emit(action);
        }
    }
  }

  function onKeyDown(e) {
    // 避免重复触发与输入冲突
    if (e.repeat) return;

    const key = e.key;
    const keyNorm = (key === ' ' || key === 'Spacebar') ? 'Space' : key;
    // 优先处理帮助（F1/?）与关闭（Esc），即使有遮罩
    const isHelpKey = keyNorm === 'F1' || keyNorm === '?';
    const isEsc = keyNorm === 'Escape';

    if (!isHelpKey && !isEsc) {
      if (isEditableTarget(e.target)) return;
      if (anyBlockingOverlayVisible()) {
        // 允许 H 打开历史，F1/？打开帮助；其他忽略
        if (!(keyNorm === 'h' || keyNorm === 'H' || keyNorm === 'F1' || keyNorm === '?')) return;
      }
    }

    const action = map[keyNorm];
    if (!action) return;

    // 阻止默认，如 F1 的浏览器帮助、F11 的默认全屏
    if (keyNorm === 'F1' || keyNorm === 'Space' || keyNorm === 'F11') {
      e.preventDefault();
    }

    try { exec(action); } catch (err) { console.error('[keyboardManager] exec error', err); }
  }

  function init() {
    loadMap();
    window.addEventListener('keydown', onKeyDown);
    // 向外暴露 API 以便未来动态配置
    window.KeyboardManager = Object.freeze({
      getMap: () => ({ ...map }),
      setMap: (m) => { if (m && typeof m === 'object') { map = { ...DEFAULT_MAP, ...m }; saveMap(); } },
      resetMap: () => { map = { ...DEFAULT_MAP }; saveMap(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
