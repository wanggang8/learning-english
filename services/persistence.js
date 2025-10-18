// 渲染进程持久化服务：封装 window.store API，并提供统一的错误处理钩子

const SERVICE_NAMESPACE = '[PersistenceService]';

const defaultErrorHandler = (operation, error) => {
  console.error(`${SERVICE_NAMESPACE} ${operation} 失败:`, error);
};

let currentErrorHandler = defaultErrorHandler;

function isStoreAvailable() {
  return typeof window !== 'undefined' && typeof window.store !== 'undefined';
}

function setErrorHandler(handler) {
  if (typeof handler === 'function') {
    currentErrorHandler = handler;
    return;
  }
  currentErrorHandler = defaultErrorHandler;
}

function resetErrorHandler() {
  currentErrorHandler = defaultErrorHandler;
}

function notifyError(operation, error) {
  try {
    currentErrorHandler(operation, error);
  } catch (handlerError) {
    console.error(`${SERVICE_NAMESPACE} 错误处理钩子执行异常:`, handlerError);
    defaultErrorHandler(operation, error);
  }
}

function createErrorResult(error) {
  return {
    success: false,
    error: error && error.message ? error.message : '未知错误'
  };
}

function ensureStore(operation) {
  if (!isStoreAvailable()) {
    throw new Error('Store API 不可用，请检查 preload 配置');
  }
  return window.store;
}

function execute(operation, handler, fallback) {
  try {
    const api = ensureStore(operation);
    return handler(api);
  } catch (error) {
    notifyError(operation, error);
    if (fallback !== undefined) {
      return typeof fallback === 'function' ? fallback(error) : fallback;
    }
    return createErrorResult(error);
  }
}

function getState() {
  return execute('getState', (api) => {
    const state = api.getState();
    return {
      success: true,
      data: state
    };
  });
}

function setState(state) {
  return execute('setState', (api) => api.setState(state));
}

function updatePartial(updates) {
  return execute('updatePartial', (api) => {
    if (updates.importMetadata && typeof updates.importMetadata === 'object') {
      const currentState = api.getState();
      const currentImportMetadata = currentState.importMetadata || { students: {}, words: {} };
      const mergedImportMetadata = {
        students: { ...currentImportMetadata.students, ...(updates.importMetadata.students || {}) },
        words: { ...currentImportMetadata.words, ...(updates.importMetadata.words || {}) }
      };
      const mergedUpdates = {
        ...updates,
        importMetadata: mergedImportMetadata
      };
      return api.updatePartial(mergedUpdates);
    }
    return api.updatePartial(updates);
  });
}

function clearSession() {
  return execute('clearSession', (api) => api.clearSession());
}

function addSessionHistory(entry) {
  return execute('addSessionHistory', (api) => api.addSessionHistory(entry));
}

function startNewSession() {
  return execute('startNewSession', (api) => api.startNewSession());
}

function clearHistory(options = { scope: 'current' }) {
  return execute('clearHistory', (api) => api.clearHistory(options));
}

function getSettings() {
  return execute('getSettings', (api) => {
    const settings = api.getSettings();
    return {
      success: true,
      data: settings
    };
  });
}

function updateSettings(newSettings) {
  return execute('updateSettings', (api) => api.updateSettings(newSettings));
}

function saveData(students, words) {
  return execute('saveData', () => updatePartial({
    students: Array.isArray(students) ? students : [],
    words: Array.isArray(words) ? words : []
  }));
}

function loadData() {
  return execute('loadData', () => {
    const result = getState();
    if (!result.success) {
      return result;
    }
    return {
      success: true,
      data: {
        students: Array.isArray(result.data?.students) ? result.data.students : [],
        words: Array.isArray(result.data?.words) ? result.data.words : []
      }
    };
  });
}

window.PersistenceService = Object.freeze({
  isStoreAvailable,
  setErrorHandler,
  resetErrorHandler,
  getState,
  setState,
  updatePartial,
  clearSession,
  addSessionHistory,
  startNewSession,
  clearHistory,
  getSettings,
  updateSettings,
  saveData,
  loadData
});
