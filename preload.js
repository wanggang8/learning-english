const { contextBridge } = require('electron');
const store = require('./app/store');

const api = {
  getState: () => store.getState(),
  setState: (state) => store.setState(state),
  updatePartial: (updates) => store.updatePartial(updates),
  // 会话管理
  startNewSession: () => store.startNewSession(),
  clearHistory: (options) => store.clearHistory(options),
  clearSession: () => store.clearSession(),
  addSessionHistory: (entry) => store.addSessionHistory(entry),
  // 设置
  getSettings: () => store.getSettings(),
  updateSettings: (newSettings) => store.updateSettings(newSettings)
};

contextBridge.exposeInMainWorld('store', Object.freeze(api));
