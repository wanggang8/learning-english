// AppCommands: 统一的指令入口，封装具体动作，确保按钮与快捷键调用链一致
(function(){
  function getActiveScreenId() {
    const el = document.querySelector('.screen.active');
    return el ? el.id : null;
  }

  function ensureDataAvailable() {
    try {
      const stateRes = window.PersistenceService?.getState();
      const students = stateRes && stateRes.success && Array.isArray(stateRes.data?.students) ? stateRes.data.students : [];
      const words = stateRes && stateRes.success && Array.isArray(stateRes.data?.words) ? stateRes.data.words : [];
      if (students.length === 0 || words.length === 0) {
        window.Feedback?.showToast('请先导入学生名单和单词列表', window.Feedback?.TOAST_TYPES?.INFO || 'info', 3500);
        // 打开导入面板
        try { window.showFileUploadPrompt && window.showFileUploadPrompt(); } catch(e) {}
        return false;
      }
      return true;
    } catch (e) {
      return true; // 忽略异常，交由具体动作自行校验
    }
  }

  function drawStart() {
    if (!ensureDataAvailable()) return;
    try { window.startDrawing && window.startDrawing(); } catch (e) { console.error('drawStart failed', e); }
  }

  function drawRedo() {
    if (!ensureDataAvailable()) return;
    const screen = getActiveScreenId();
    // 抽取动画中不触发重抽，避免多重计时器冲突
    if (screen === 'drawingScreen') return;
    // 在任意其它界面直接开始下一次抽取
    if (screen === 'wordScreen') {
      // 回到开始再抽
      try { window.resetToStart && window.resetToStart(); } catch(e) {}
    }
    drawStart();
  }

  function wordShow() {
    if (!ensureDataAvailable()) return;
    try { window.showWordInput && window.showWordInput(); } catch (e) { console.error('wordShow failed', e); }
  }

  function uiBack() {
    const screen = getActiveScreenId();
    if (screen && screen !== 'startScreen') {
      try { window.resetToStart && window.resetToStart(); } catch (e) { console.error('uiBack failed', e); }
    }
  }

  function historyToggle() {
    try {
      if (window.HistoryPanel && typeof window.HistoryPanel.toggle === 'function') {
        window.HistoryPanel.toggle();
      }
    } catch (e) { console.error('historyToggle failed', e); }
  }

  function historyHide() {
    try { window.HistoryPanel && window.HistoryPanel.hide && window.HistoryPanel.hide(); } catch (e) {}
  }

  function helpOpen() {
    try { window.ShortcutHelp && window.ShortcutHelp.open && window.ShortcutHelp.open(); } catch (e) {}
  }
  function helpClose() {
    try { window.ShortcutHelp && window.ShortcutHelp.close && window.ShortcutHelp.close(); } catch (e) {}
  }
  function helpToggle() {
    try { window.ShortcutHelp && window.ShortcutHelp.toggle && window.ShortcutHelp.toggle(); } catch (e) {}
  }

  function exitFullscreenIfAny() {
    const el = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    if (el) {
      try {
        (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen).call(document);
        return true;
      } catch (e) { /* ignore */ }
    }
    return false;
  }

  function backOrExitFullscreen() {
    if (exitFullscreenIfAny()) return;
    // 优先关闭帮助/历史
    helpClose();
    historyHide();
    uiBack();
  }

  // 将命令暴露给其他模块（如 keyboardManager）
  window.AppCommands = Object.freeze({
    getActiveScreenId,
    drawStart,
    drawRedo,
    wordShow,
    uiBack,
    historyToggle,
    historyHide,
    helpOpen,
    helpClose,
    helpToggle,
    backOrExitFullscreen
  });

  // 同时订阅事件总线（如有）
  if (window.AppEvents) {
    window.AppEvents.on('draw:start', drawStart);
    window.AppEvents.on('draw:redo', drawRedo);
    window.AppEvents.on('word:show', wordShow);
    window.AppEvents.on('ui:back', uiBack);
    window.AppEvents.on('history:toggle', historyToggle);
    window.AppEvents.on('help:open', helpOpen);
    window.AppEvents.on('help:close', helpClose);
    window.AppEvents.on('help:toggle', helpToggle);
    window.AppEvents.on('ui:backOrExit', backOrExitFullscreen);
  }
})();
