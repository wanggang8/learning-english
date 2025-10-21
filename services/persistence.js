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

// Normalization helpers for enriched word objects (backward compatible)
const WORD_DEFAULTS = Object.freeze({
  word: '',
  phonetic: null,
  definition: null,
  example: null,
  tags: [],
  imagePath: null,
  mastery: 0,
  lastReviewedAt: null,
  favorite: false
});

function normalizeWordEntry(entry) {
  if (entry == null) return null;
  if (typeof entry === 'string' || typeof entry === 'number') {
    const w = String(entry).trim();
    if (!w) return null;
    return { ...WORD_DEFAULTS, word: w };
  }
  if (typeof entry === 'object') {
    const base = { ...WORD_DEFAULTS };
    const word =
      typeof entry.word === 'string' ? entry.word
      : typeof entry.text === 'string' ? entry.text
      : typeof entry.value === 'string' ? entry.value
      : typeof entry.term === 'string' ? entry.term
      : '';
    const normalized = {
      ...base,
      ...entry,
      word: String(word || '').trim()
    };
    if (!Array.isArray(entry.tags)) {
      normalized.tags = Array.isArray(entry.tags) ? entry.tags : [];
    } else {
      normalized.tags = entry.tags.filter((t) => t != null).map((t) => String(t));
    }
    const m = Number(entry.mastery);
    normalized.mastery = Number.isFinite(m) ? m : 0;
    if (normalized.lastReviewedAt != null) {
      normalized.lastReviewedAt = String(normalized.lastReviewedAt);
    } else {
      normalized.lastReviewedAt = null;
    }
    normalized.favorite = Boolean(entry.favorite);
    ['phonetic','definition','example','imagePath'].forEach((k)=>{
      if (normalized[k] == null) normalized[k] = null; else normalized[k] = String(normalized[k]);
    });
    if (!normalized.word) return null;
    return normalized;
  }
  return null;
}

function normalizeWordsArray(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const n = normalizeWordEntry(item);
    if (n && n.word) out.push(n);
  }
  return out;
}

function getState() {
  return execute('getState', (api) => {
    const state = api.getState();
    if (state && Array.isArray(state.words)) {
      state.words = normalizeWordsArray(state.words);
    }
    return {
      success: true,
      data: state
    };
  });
}

function setState(state) {
  return execute('setState', (api) => {
    const next = (state && typeof state === 'object') ? { ...state } : state;
    if (next && Array.isArray(next.words)) {
      next.words = normalizeWordsArray(next.words);
    }
    return api.setState(next);
  });
}

function updatePartial(updates) {
  return execute('updatePartial', (api) => {
    let patch = updates;
    if (updates && updates.importMetadata && typeof updates.importMetadata === 'object') {
      const currentState = api.getState();
      const currentImportMetadata = currentState.importMetadata || { students: {}, words: {} };
      const mergedImportMetadata = {
        students: { ...currentImportMetadata.students, ...(updates.importMetadata.students || {}) },
        words: { ...currentImportMetadata.words, ...(updates.importMetadata.words || {}) }
      };
      patch = {
        ...updates,
        importMetadata: mergedImportMetadata
      };
    }
    if (patch && Array.isArray(patch.words)) {
      patch = { ...patch, words: normalizeWordsArray(patch.words) };
    }
    return api.updatePartial(patch);
  });
}

function clearSession() {
  return execute('clearSession', (api) => api.clearSession());
}

function addSessionHistory(entry) {
  return execute('addSessionHistory', (api) => api.addSessionHistory(entry));
}

function addWordReview(entry) {
  return execute('addWordReview', (api) => api.addWordReview(entry));
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
    words: Array.isArray(words) ? normalizeWordsArray(words) : []
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
        words: Array.isArray(result.data?.words) ? normalizeWordsArray(result.data.words) : []
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
  addWordReview,
  startNewSession,
  clearHistory,
  getSettings,
  updateSettings,
  saveData,
  loadData
});
