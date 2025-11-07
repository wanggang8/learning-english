// AppCommands: 统一的指令入口，封装具体动作，确保按钮与快捷键调用链一致
(function(){
  let isWindowFullscreen = false;

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

  function updateFullscreenUI(isFull) {
    isWindowFullscreen = !!isFull;
    try { document.body.classList.toggle('fullscreen-active', !!isFull); } catch (e) {}
    const btn = document.getElementById('fullscreenBtn');
    if (btn) {
      btn.textContent = isFull ? '🗗' : '🗖';
      btn.title = isFull ? '退出全屏 (Esc)' : '全屏 (F11)';
      btn.classList.toggle('active', !!isFull);
    }
  }

  function setupFullscreenListeners() {
    try {
      if (window.windowControls && typeof window.windowControls.onFullscreenChanged === 'function') {
        window.windowControls.onFullscreenChanged(updateFullscreenUI);
        if (typeof window.windowControls.isFullscreen === 'function') {
          window.windowControls.isFullscreen().then(updateFullscreenUI).catch(() => {});
        }
      }
    } catch (e) {}
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
    // 闪卡界面不触发“重抽”，避免误操作中断学习
    if (screen === 'flashcardScreen') return;
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

  function fullscreenToggle() {
    try { window.windowControls && window.windowControls.toggleFullscreen && window.windowControls.toggleFullscreen(); } catch (e) {}
  }
  function fullscreenExit() {
    try { window.windowControls && window.windowControls.exitFullscreen && window.windowControls.exitFullscreen(); } catch (e) {}
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
    if (isWindowFullscreen) { fullscreenExit(); return; }
    if (exitFullscreenIfAny()) return;
    // 优先关闭帮助/历史
    helpClose();
    historyHide();
    uiBack();
  }

  // Flashcard commands
  function flashcardOpen() {
    try {
      const stateRes = window.PersistenceService?.getState();
      const words = stateRes && stateRes.success && Array.isArray(stateRes.data?.words) ? stateRes.data.words : [];
      if (!words.length) {
        window.Feedback?.showToast('请先导入单词列表', window.Feedback?.TOAST_TYPES?.INFO || 'info', 3000);
        try { window.showFileUploadPrompt && window.showFileUploadPrompt(); } catch(e) {}
        return;
      }
    } catch (e) {}
    try { window.Flashcard && window.Flashcard.open && window.Flashcard.open(); } catch (e) { console.error('flashcardOpen failed', e); }
  }
  function flashcardFlip() { try { window.Flashcard && window.Flashcard.flip && window.Flashcard.flip(); } catch (e) {} }
  function flashcardNext() { try { window.Flashcard && window.Flashcard.next && window.Flashcard.next(); } catch (e) {} }
  function flashcardPrev() { try { window.Flashcard && window.Flashcard.prev && window.Flashcard.prev(); } catch (e) {} }

  // TTS commands
  function ttsStop() {
    try {
      if (window.TTSController && typeof window.TTSController.stop === 'function') {
        window.TTSController.stop({ reason: 'keyboard-shortcut', immediate: true });
        if (window.Feedback) {
          window.Feedback.showToast('已停止语音播报', window.Feedback.TOAST_TYPES?.INFO || 'info', 2000);
        }
      }
    } catch (e) { console.error('ttsStop failed', e); }
  }

  // Learning mode commands
  function learningStart() {
    try {
      const stateRes = window.PersistenceService?.getState();
      const words = stateRes && stateRes.success && Array.isArray(stateRes.data?.words) ? stateRes.data.words : [];
      if (!words.length) {
        window.Feedback?.showToast('请先导入单词列表', window.Feedback?.TOAST_TYPES?.INFO || 'info', 3000);
        try { window.showFileUploadPrompt && window.showFileUploadPrompt(); } catch(e) {}
        return;
      }
    } catch (e) {}
    try { window.switchToLearningMode && window.switchToLearningMode(); } catch (e) { console.error('learningStart failed', e); }
  }

  function learningSession(mode, options = {}) {
    try {
      if (!window.LearningMode) {
        throw new Error('LearningMode module not available');
      }
      const result = window.LearningMode.startSession(mode, options);
      if (!result.success) {
        window.Feedback?.showError(result.error);
      }
    } catch (e) { console.error('learningSession failed', e); }
  }

  function learningExit() {
    try {
      if (window.LearningMode) {
        const result = window.LearningMode.exitSession();
        if (!result.success) {
          window.Feedback?.showError(result.error);
        }
      }
    } catch (e) { console.error('learningExit failed', e); }
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
    fullscreenToggle,
    fullscreenExit,
    backOrExitFullscreen,
    // flashcard
    flashcardOpen,
    flashcardFlip,
    flashcardNext,
    flashcardPrev,
    // learning mode
    learningStart,
    learningSession,
    learningExit,
    // tts
    ttsStop
  });

  // 初始化全屏事件同步
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupFullscreenListeners);
  } else {
    setupFullscreenListeners();
  }

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
    // Flashcard events
    window.AppEvents.on('flashcard:open', flashcardOpen);
    window.AppEvents.on('flashcard:flip', flashcardFlip);
    window.AppEvents.on('flashcard:next', flashcardNext);
    window.AppEvents.on('flashcard:prev', flashcardPrev);
    // Learning mode events
    window.AppEvents.on('learning:start', learningStart);
    window.AppEvents.on('learning:session', learningSession);
    window.AppEvents.on('learning:exit', learningExit);
    // TTS events
    window.AppEvents.on('tts:stop', ttsStop);
  }
})();
