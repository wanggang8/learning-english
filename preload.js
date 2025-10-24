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

contextBridge.exposeInMainWorld('store', Object.freeze(api));
contextBridge.exposeInMainWorld('windowControls', windowControls);
contextBridge.exposeInMainWorld('AssetService', assetService);
