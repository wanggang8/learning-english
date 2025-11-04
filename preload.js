const { contextBridge, ipcRenderer } = require('electron');
const store = require('./app/store');

// 数据存储 API（原有）
const api = {
  getState: () => store.getState(),
  setState: (state) => store.setState(state),
  updatePartial: (updates) => store.updatePartial(updates),
  // 会话管理
  startNewSession: () => store.startNewSession(),
  clearHistory: (options) => store.clearHistory(options),
  clearSession: () => store.clearSession(),
  addSessionHistory: (entry) => store.addSessionHistory(entry),
  addWordReview: (entry) => store.addWordReview(entry),
  // 设置
  getSettings: () => store.getSettings(),
  updateSettings: (newSettings) => store.updateSettings(newSettings)
};

// 窗口控制 API：封装与主进程通信
const windowControls = Object.freeze({
  // 切换全屏，返回 Promise<boolean> 表示切换后的状态
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  // 退出全屏，返回 Promise<boolean> 表示是否执行了退出
  exitFullscreen: () => ipcRenderer.invoke('exit-fullscreen'),
  // 获取当前是否全屏
  isFullscreen: () => ipcRenderer.invoke('get-fullscreen'),
  // 订阅全屏状态变化
  onFullscreenChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, isFullscreen) => {
      try { callback(Boolean(isFullscreen)); } catch (e) { /* ignore */ }
    };
    ipcRenderer.on('fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('fullscreen-changed', listener);
  }
});

// 资源管理 API：通过 IPC 调用主进程进行本地图片复制与去重
const assetService = Object.freeze({
  copyImage: async (srcPathOrUrl) => {
    try {
      const res = await ipcRenderer.invoke('assets.copyImage', srcPathOrUrl);
      return res;
    } catch (e) {
      return { success: false, error: e?.message || 'ipc-failed' };
    }
  }
});

const templateService = Object.freeze({
  openWordsWorkbook: async () => {
    try {
      return await ipcRenderer.invoke('templates.openWordsWorkbook');
    } catch (e) {
      return { success: false, error: e?.message || 'ipc-failed' };
    }
  }
});

const TTS_STATUS_CHANNEL = 'tts:status';
const MAX_TTS_TEXT_LENGTH = 5000;
const TTS_RATE_MIN = 0.1;
const TTS_RATE_MAX = 3.0;
const UNSAFE_VOICE_PATTERN = /[;&|><`$\\]/;
const VOICE_NEWLINE_PATTERN = /[\r\n]/;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const sanitizeSpeakOptions = (input) => {
  let payload = input;
  if (typeof payload === 'string') {
    payload = { text: payload };
  }

  if (!payload || typeof payload !== 'object') {
    return { success: false, error: 'invalid-arguments' };
  }

  let text = payload.text;
  if (typeof text !== 'string') {
    text = text == null ? '' : String(text);
  }
  text = text.replace(/\r\n/g, '\n').trim();
  if (!text) {
    return { success: false, error: 'empty-text' };
  }
  if (text.length > MAX_TTS_TEXT_LENGTH) {
    return { success: false, error: 'text-too-long', limit: MAX_TTS_TEXT_LENGTH };
  }

  const sanitized = { text };

  if (payload.voice != null) {
    if (typeof payload.voice !== 'string') {
      return { success: false, error: 'invalid-voice' };
    }
    const cleaned = payload.voice.trim();
    if (cleaned) {
      if (UNSAFE_VOICE_PATTERN.test(cleaned) || VOICE_NEWLINE_PATTERN.test(cleaned)) {
        return { success: false, error: 'voice-unsafe' };
      }
      sanitized.voice = cleaned;
    }
  }

  if (payload.rate != null) {
    const numeric = Number(payload.rate);
    if (!Number.isFinite(numeric)) {
      return { success: false, error: 'invalid-rate' };
    }
    const clamped = clamp(numeric, TTS_RATE_MIN, TTS_RATE_MAX);
    sanitized.rate = Math.round(clamped * 1000) / 1000;
  }

  return { success: true, value: sanitized };
};

const sanitizeStopOptions = (input) => {
  if (input !== undefined && input !== null && typeof input !== 'object') {
    return { success: false, error: 'invalid-arguments' };
  }
  return { success: true, value: {} };
};

const ttsApi = Object.freeze({
  speak: async (options) => {
    const sanitized = sanitizeSpeakOptions(options);
    if (!sanitized.success) return sanitized;
    try {
      return await ipcRenderer.invoke('tts:speak', sanitized.value);
    } catch (e) {
      return { success: false, error: e?.message || 'ipc-failed' };
    }
  },
  stop: async (options) => {
    const sanitized = sanitizeStopOptions(options);
    if (!sanitized.success) return sanitized;
    try {
      return await ipcRenderer.invoke('tts:stop', sanitized.value);
    } catch (e) {
      return { success: false, error: e?.message || 'ipc-failed' };
    }
  },
  getVoices: async () => {
    try {
      return await ipcRenderer.invoke('tts:getVoices');
    } catch (e) {
      return { success: false, error: e?.message || 'ipc-failed' };
    }
  },
  onStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => {
      try { callback(payload); } catch (_err) { /* ignore */ }
    };
    ipcRenderer.on(TTS_STATUS_CHANNEL, listener);
    return () => ipcRenderer.removeListener(TTS_STATUS_CHANNEL, listener);
  }
});

contextBridge.exposeInMainWorld('store', Object.freeze(api));
contextBridge.exposeInMainWorld('windowControls', windowControls);
contextBridge.exposeInMainWorld('AssetService', assetService);
contextBridge.exposeInMainWorld('TemplateService', templateService);
contextBridge.exposeInMainWorld('tts', ttsApi);
