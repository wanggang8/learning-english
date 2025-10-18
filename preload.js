const { contextBridge } = require('electron');
const store = require('./app/store');

const api = {
  getState: () => store.getState(),
  setState: (state) => store.setState(state),
  updatePartial: (updates) => store.updatePartial(updates),
  clearSession: () => store.clearSession(),
  addSessionHistory: (entry) => store.addSessionHistory(entry),
  getSettings: () => store.getSettings(),
  updateSettings: (newSettings) => store.updateSettings(newSettings)
};

contextBridge.exposeInMainWorld('store', Object.freeze(api));
