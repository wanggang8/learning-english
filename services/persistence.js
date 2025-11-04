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

const SETTINGS_DEFAULTS = Object.freeze({
  musicEnabled: true,
  animationDuration: 2000,
  lastUpdated: null,
  volume: 1,
  playMode: 'loop',
  drawMode: 'random',
  flashcard: {
    order: 'shuffled',
    defaultFace: 'front',
    includeImages: true,
    filters: { mode: 'all', masteryMin: 0, masteryMax: 3 }
  },
  tts: {
    voice: null,
    rate: 1,
    pitch: 1,
    autoPlayOnAdvance: false
  }
});

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(Math.max(num, min), max);
}

function normalizeTtsSettings(value) {
  const base = SETTINGS_DEFAULTS.tts;
  if (!value || typeof value !== 'object') {
    return { ...base };
  }

  const result = {
    voice: base.voice,
    rate: clampNumber(value.rate, 0.1, 3, base.rate),
    pitch: clampNumber(value.pitch, 0.5, 2, base.pitch),
    autoPlayOnAdvance: typeof value.autoPlayOnAdvance === 'boolean' ? value.autoPlayOnAdvance : base.autoPlayOnAdvance
  };

  if (Object.prototype.hasOwnProperty.call(value, 'voice')) {
    if (typeof value.voice === 'string') {
      const trimmed = value.voice.trim();
      result.voice = trimmed ? trimmed : null;
    } else if (value.voice === null) {
      result.voice = null;
    }
  }

  return result;
}

function normalizeFlashcardSettings(value) {
  const base = SETTINGS_DEFAULTS.flashcard;
  const input = value && typeof value === 'object' ? value : {};
  const baseFilters = base.filters || { mode: 'all', masteryMin: 0, masteryMax: 3 };
  const rawFilters = input.filters && typeof input.filters === 'object' ? input.filters : {};
  const modeCandidates = ['favorites', 'mastery', 'all'];
  const mode = modeCandidates.includes(rawFilters.mode) ? rawFilters.mode : baseFilters.mode;
  const min = clampNumber(rawFilters.masteryMin, 0, 3, baseFilters.masteryMin);
  const max = clampNumber(rawFilters.masteryMax, 0, 3, baseFilters.masteryMax);
  const rangeMin = Math.min(min, max);
  const rangeMax = Math.max(min, max);

  return {
    ...base,
    ...input,
    order: input.order === 'ordered' ? 'ordered' : 'shuffled',
    defaultFace: input.defaultFace === 'back' ? 'back' : 'front',
    includeImages: typeof input.includeImages === 'boolean' ? input.includeImages : base.includeImages,
    filters: {
      ...baseFilters,
      ...rawFilters,
      mode,
      masteryMin: rangeMin,
      masteryMax: rangeMax
    }
  };
}

function normalizeSettings(value) {
  const base = SETTINGS_DEFAULTS;
  const input = value && typeof value === 'object' ? value : {};

  const normalized = {
    ...base,
    ...input,
    flashcard: normalizeFlashcardSettings(input.flashcard),
    tts: normalizeTtsSettings(input.tts)
  };

  normalized.volume = clampNumber(input.volume, 0, 1, base.volume);
  normalized.musicEnabled = typeof input.musicEnabled === 'boolean' ? input.musicEnabled : base.musicEnabled;
  normalized.animationDuration = clampNumber(input.animationDuration, 0, Number.MAX_SAFE_INTEGER, base.animationDuration);
  normalized.playMode = typeof input.playMode === 'string' ? input.playMode : base.playMode;
  normalized.drawMode = typeof input.drawMode === 'string' ? input.drawMode : base.drawMode;

  if (Object.prototype.hasOwnProperty.call(input, 'lastUpdated')) {
    normalized.lastUpdated = input.lastUpdated;
  }

  return normalized;
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

function normalizeWhitespace(value, { preserveNewlines = false } = {}) {
  if (value == null) return '';
  let str = String(value);
  str = str.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ');
  if (!preserveNewlines) {
    return str.replace(/\s+/g, ' ').trim();
  }
  const lines = str.split('\n').map((line) => line.replace(/\s+/g, ' ').trim());
  return lines.join('\n').trim();
}

function sanitizeTags(value) {
  if (value == null) return [];
  const queue = Array.isArray(value) ? value.slice() : [value];
  const result = [];
  const seen = new Set();
  while (queue.length) {
    const item = queue.shift();
    if (item == null) continue;
    if (Array.isArray(item)) {
      queue.push(...item);
      continue;
    }
    const raw = normalizeWhitespace(item, { preserveNewlines: true });
    if (!raw) continue;
    const parts = raw.split(/[\n,，;；|｜\/\\]+/);
    for (const part of parts) {
      const cleaned = normalizeWhitespace(part);
      if (!cleaned) continue;
      const tag = cleaned.replace(/^#/, '').trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(tag);
    }
  }
  return result;
}

function normalizeWordEntry(entry) {
  if (entry == null) return null;
  if (typeof entry === 'string' || typeof entry === 'number') {
    const w = normalizeWhitespace(entry);
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
      word: normalizeWhitespace(word)
    };
    normalized.tags = sanitizeTags(entry.tags ?? entry.tag ?? entry.category ?? entry.categories);
    const m = Number(entry.mastery);
    normalized.mastery = Number.isFinite(m) ? m : 0;
    if (normalized.lastReviewedAt != null) {
      normalized.lastReviewedAt = String(normalized.lastReviewedAt);
    } else {
      normalized.lastReviewedAt = null;
    }
    normalized.favorite = Boolean(entry.favorite);
    normalized.phonetic = normalized.phonetic == null ? null : normalizeWhitespace(normalized.phonetic);
    normalized.definition = normalized.definition == null ? null : normalizeWhitespace(normalized.definition, { preserveNewlines: true });
    normalized.example = normalized.example == null ? null : normalizeWhitespace(normalized.example, { preserveNewlines: true });
    const imageSource = entry.imagePath ?? entry.image ?? entry.img ?? entry.picture ?? entry['image path'];
    normalized.imagePath = imageSource == null ? null : normalizeWhitespace(imageSource);
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
    if (state && typeof state === 'object') {
      if (Array.isArray(state.words)) {
        state.words = normalizeWordsArray(state.words);
      }
      state.settings = normalizeSettings(state.settings);
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
    if (next && next.settings) {
      next.settings = normalizeSettings(next.settings);
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
    if (patch && patch.settings && typeof patch.settings === 'object') {
      const currentSettings = normalizeSettings(api.getSettings());
      const patchSettings = { ...patch.settings };
      if (patchSettings.flashcard && typeof patchSettings.flashcard === 'object') {
        const mergedFlashcard = {
          ...currentSettings.flashcard,
          ...patchSettings.flashcard
        };
        if (patchSettings.flashcard.filters && typeof patchSettings.flashcard.filters === 'object') {
          mergedFlashcard.filters = {
            ...currentSettings.flashcard.filters,
            ...patchSettings.flashcard.filters
          };
        }
        patchSettings.flashcard = mergedFlashcard;
      }
      if (patchSettings.tts && typeof patchSettings.tts === 'object') {
        patchSettings.tts = {
          ...currentSettings.tts,
          ...patchSettings.tts
        };
      }
      const mergedSettings = normalizeSettings({ ...currentSettings, ...patchSettings });
      patch = { ...patch, settings: mergedSettings };
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
    const settings = normalizeSettings(api.getSettings());
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
