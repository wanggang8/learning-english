const Store = require('electron-store');

const DEFAULT_STATE = {
  students: [],
  words: [],
  studentStats: {},
  settings: {
    musicEnabled: true,
    animationDuration: 2000,
    lastUpdated: null,
    volume: 1,
    playMode: 'loop',
    drawMode: 'random'
  },
  // 会话历史：区分活动会话与归档会话
  sessionHistory: {
    activeSession: {
      id: null,
      startedAt: null,
      events: []
    },
    archivedSessions: []
  },
  metadata: {
    lastModified: null,
    version: '2.1.1',
    schemaVersion: 3
  },
  importMetadata: {
    students: {
      filename: null,
      filepath: null,
      importedAt: null,
      sourceType: null,
      count: 0
    },
    words: {
      filename: null,
      filepath: null,
      importedAt: null,
      sourceType: null,
      count: 0
    }
  },
  excludedStudents: []
};

const schema = {
  students: {
    type: 'array',
    default: [],
    items: {
      type: 'string'
    }
  },
  words: {
    type: 'array',
    default: [],
    items: {
      type: ['object', 'string'],
      properties: {
        word: { type: 'string' },
        phonetic: { type: ['string', 'null'], default: null },
        definition: { type: ['string', 'null'], default: null },
        example: { type: ['string', 'null'], default: null },
        tags: { type: 'array', default: [], items: { type: 'string' } },
        imagePath: { type: ['string', 'null'], default: null },
        mastery: { type: 'number', default: 0 },
        lastReviewedAt: { type: ['string', 'null'], default: null },
        favorite: { type: 'boolean', default: false }
      },
      required: ['word'],
      additionalProperties: true
    }
  },
  studentStats: {
    type: 'object',
    default: {},
    additionalProperties: {
      type: 'object',
      properties: {
        drawCount: { type: 'number', default: 0 },
        lastDrawnAt: { type: ['string', 'null'], default: null },
        lastDrawMode: { type: ['string', 'null'], default: null }
      },
      additionalProperties: true
    }
  },
  settings: {
    type: 'object',
    default: DEFAULT_STATE.settings,
    properties: {
      musicEnabled: {
        type: 'boolean',
        default: true
      },
      animationDuration: {
        type: 'number',
        minimum: 0,
        default: 2000
      },
      lastUpdated: {
        type: ['string', 'null'],
        default: null
      },
      volume: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        default: 1
      },
      playMode: {
        type: 'string',
        default: 'loop'
      },
      drawMode: {
        type: 'string',
        default: 'random'
      }
    },
    additionalProperties: false
  },
  sessionHistory: {
    type: 'object',
    default: DEFAULT_STATE.sessionHistory,
    properties: {
      activeSession: {
        type: 'object',
        default: DEFAULT_STATE.sessionHistory.activeSession,
        properties: {
          id: { type: ['string', 'null'], default: null },
          startedAt: { type: ['string', 'null'], default: null },
          events: {
            type: 'array',
            default: [],
            items: {
              type: 'object',
              properties: {
                timestamp: { type: 'string' },
                student: { type: ['string', 'null'], default: null },
                word: { type: ['string', 'object', 'null'], default: null },
                fairness: {
                  type: ['object', 'null'],
                  default: null,
                  properties: {
                    mode: { type: 'string' },
                    remainingStudents: { type: 'number' },
                    remainingWords: { type: 'number' }
                  },
                  additionalProperties: true
                },
                payload: { type: ['object', 'null'], default: null }
              },
              required: ['timestamp'],
              additionalProperties: true
            }
          }
        },
        additionalProperties: true
      },
      archivedSessions: {
        type: 'array',
        default: [],
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            startedAt: { type: 'string' },
            endedAt: { type: ['string', 'null'], default: null },
            events: {
              type: 'array',
              default: [],
              items: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string' },
                  student: { type: ['string', 'null'], default: null },
                  word: { type: ['string', 'object', 'null'], default: null },
                  fairness: {
                    type: ['object', 'null'],
                    default: null,
                    properties: {
                      mode: { type: 'string' },
                      remainingStudents: { type: 'number' },
                      remainingWords: { type: 'number' }
                    },
                    additionalProperties: true
                  },
                  payload: { type: ['object', 'null'], default: null }
                },
                required: ['timestamp'],
                additionalProperties: true
              }
            },
            summary: { type: ['object', 'null'], default: null }
          },
          required: ['id', 'startedAt'],
          additionalProperties: true
        }
      }
    },
    additionalProperties: false
  },
  metadata: {
    type: 'object',
    default: DEFAULT_STATE.metadata,
    properties: {
      lastModified: {
        type: ['string', 'null'],
        default: null
      },
      version: {
        type: 'string',
        default: '2.1.1'
      },
      schemaVersion: {
        type: 'number',
        default: 3
      }
    },
    additionalProperties: true
  },
  importMetadata: {
    type: 'object',
    default: DEFAULT_STATE.importMetadata,
    properties: {
      students: {
        type: 'object',
        default: DEFAULT_STATE.importMetadata.students,
        properties: {
          filename: {
            type: ['string', 'null'],
            default: null
          },
          filepath: {
            type: ['string', 'null'],
            default: null
          },
          importedAt: {
            type: ['string', 'null'],
            default: null
          },
          sourceType: {
            type: ['string', 'null'],
            default: null
          },
          count: {
            type: 'number',
            default: 0
          }
        },
        additionalProperties: false
      },
      words: {
        type: 'object',
        default: DEFAULT_STATE.importMetadata.words,
        properties: {
          filename: {
            type: ['string', 'null'],
            default: null
          },
          filepath: {
            type: ['string', 'null'],
            default: null
          },
          importedAt: {
            type: ['string', 'null'],
            default: null
          },
          sourceType: {
            type: ['string', 'null'],
            default: null
          },
          count: {
            type: 'number',
            default: 0
          }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  excludedStudents: {
    type: 'array',
    default: [],
    items: {
      type: 'string'
    }
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultState() {
  return clone(DEFAULT_STATE);
}

function getDefaultValue(key) {
  return clone(DEFAULT_STATE[key]);
}

// Schema migration constants and helpers for enriched word objects
const CURRENT_SCHEMA_VERSION = 3;

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
    // normalize tags
    if (!Array.isArray(entry.tags)) {
      normalized.tags = Array.isArray(entry.tags) ? entry.tags : [];
    } else {
      normalized.tags = entry.tags.filter((t) => t != null).map((t) => String(t));
    }
    // coerce mastery
    const m = Number(entry.mastery);
    normalized.mastery = Number.isFinite(m) ? m : 0;
    // lastReviewedAt as string or null
    if (normalized.lastReviewedAt != null) {
      normalized.lastReviewedAt = String(normalized.lastReviewedAt);
    } else {
      normalized.lastReviewedAt = null;
    }
    // favorite boolean
    normalized.favorite = Boolean(entry.favorite);
    // normalize optional string fields
    ['phonetic', 'definition', 'example', 'imagePath'].forEach((k) => {
      if (normalized[k] == null) normalized[k] = null;
      else normalized[k] = String(normalized[k]);
    });
    if (!normalized.word) {
      return null;
    }
    return normalized;
  }
  return null;
}

function normalizeWordsArray(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const n = normalizeWordEntry(item);
    if (n && n.word) {
      out.push(n);
    }
  }
  return out;
}

function migrateWordsIfNeeded() {
  try {
    const raw = store.get('words', getDefaultValue('words'));
    const normalized = normalizeWordsArray(raw);
    const need = !Array.isArray(raw)
      || raw.length !== normalized.length
      || raw.some((it) => typeof it === 'string' || typeof it === 'number' || (typeof it === 'object' && (it.word == null || it.phonetic === undefined || it.mastery === undefined || it.favorite === undefined)));
    if (need) {
      store.set('words', normalized);
      const meta = store.get('metadata', getDefaultValue('metadata'));
      const nextMeta = {
        ...meta,
        schemaVersion: Math.max(Number(meta?.schemaVersion || 1), CURRENT_SCHEMA_VERSION),
        lastModified: new Date().toISOString()
      };
      store.set('metadata', nextMeta);
    }
  } catch (e) {
    console.warn('words 迁移失败:', e);
  }
}

function createFallbackStore() {
  const state = getDefaultState();

  return {
    get(key, fallbackValue) {
      if (Object.prototype.hasOwnProperty.call(state, key)) {
        return clone(state[key]);
      }
      return fallbackValue;
    },
    set(key, value) {
      state[key] = clone(value);
    },
    delete(key) {
      delete state[key];
    },
    clear() {
      const defaults = getDefaultState();
      Object.keys(defaults).forEach((k) => {
        state[k] = defaults[k];
      });
    },
    has(key) {
      return Object.prototype.hasOwnProperty.call(state, key);
    }
  };
}

function createStore() {
  try {
    return new Store({
      name: 'word-warrior-store',
      schema,
      defaults: getDefaultState(),
      clearInvalidConfig: true,
      accessPropertiesByDotNotation: false
    });
  } catch (error) {
    console.error('初始化 electron-store 失败，使用内存回退:', error);
    return createFallbackStore();
  }
}

const store = createStore();

// Migrate words schema to enriched objects on initialization
migrateWordsIfNeeded();

// 会话缓存与辅助方法
const MAX_EVENTS_PER_SESSION = 100;
let sessionCache = null;

function createSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createNewActiveSession() {
  return {
    id: createSessionId(),
    startedAt: new Date().toISOString(),
    events: []
  };
}

function ensureSessionCache() {
  if (!sessionCache) {
    let history = store.get('sessionHistory', getDefaultValue('sessionHistory'));
    if (!history || typeof history !== 'object') {
      history = clone(DEFAULT_STATE.sessionHistory);
    }
    if (!history.activeSession || !Array.isArray(history.activeSession.events)) {
      history.activeSession = createNewActiveSession();
    } else {
      if (!history.activeSession.id || !history.activeSession.startedAt) {
        history.activeSession.id = history.activeSession.id || createSessionId();
        history.activeSession.startedAt = history.activeSession.startedAt || new Date().toISOString();
      }
    }
    if (!Array.isArray(history.archivedSessions)) {
      history.archivedSessions = [];
    }
    sessionCache = history;
    // 同步到持久化，确保结构正确
    store.set('sessionHistory', sessionCache);
  }
  return sessionCache;
}

function flushSessionCache() {
  if (sessionCache) {
    store.set('sessionHistory', sessionCache);
    touchMetadata();
  }
}

function archiveActiveSessionInternal() {
  const cache = ensureSessionCache();
  const active = cache.activeSession;
  if (!active || !Array.isArray(active.events) || active.events.length === 0) {
    // 无事件则直接创建新的活动会话
    cache.activeSession = createNewActiveSession();
    flushSessionCache();
    return;
  }
  const endedAt = new Date().toISOString();
  cache.archivedSessions.push({
    id: active.id || createSessionId(),
    startedAt: active.startedAt || endedAt,
    endedAt,
    events: active.events,
    summary: { count: Array.isArray(active.events) ? active.events.length : 0 }
  });
  cache.activeSession = createNewActiveSession();
  flushSessionCache();
}

function runWithFallback(operation, fallback, executor) {
  try {
    return executor();
  } catch (error) {
    console.error(`持久化操作失败 [${operation}]:`, error);
    if (typeof fallback === 'function') {
      return fallback(error);
    }
    return fallback;
  }
}

function getState() {
  return runWithFallback(
    'getState',
    getDefaultState(),
    () => ({
      students: store.get('students', getDefaultValue('students')),
      words: normalizeWordsArray(store.get('words', getDefaultValue('words'))),
      studentStats: store.get('studentStats', getDefaultValue('studentStats')),
      settings: store.get('settings', getDefaultValue('settings')),
      sessionHistory: store.get('sessionHistory', getDefaultValue('sessionHistory')),
      metadata: store.get('metadata', getDefaultValue('metadata')),
      importMetadata: store.get('importMetadata', getDefaultValue('importMetadata')),
      excludedStudents: store.get('excludedStudents', getDefaultValue('excludedStudents'))
    })
  );
}

function setState(nextState) {
  return runWithFallback(
    'setState',
    (error) => ({ success: false, error: error.message }),
    () => {
      if (typeof nextState !== 'object' || nextState === null) {
        throw new Error('state 必须为对象');
      }

      Object.keys(DEFAULT_STATE).forEach((key) => {
        if (nextState[key] !== undefined) {
          if (key === 'words') {
            store.set('words', normalizeWordsArray(nextState[key]));
          } else {
            store.set(key, nextState[key]);
          }
        }
      });

      touchMetadata();
      return { success: true };
    }
  );
}

function updatePartial(updates) {
  return runWithFallback(
    'updatePartial',
    (error) => ({ success: false, error: error.message }),
    () => {
      if (typeof updates !== 'object' || updates === null) {
        throw new Error('updates 必须为对象');
      }

      Object.entries(updates).forEach(([key, value]) => {
        if (!Object.prototype.hasOwnProperty.call(DEFAULT_STATE, key) || value === undefined) {
          return;
        }

        if (key === 'words') {
          store.set('words', normalizeWordsArray(value));
          return;
        }

        const currentValue = store.get(key, getDefaultValue(key));
        if (Array.isArray(currentValue) || Array.isArray(value)) {
          store.set(key, value);
        } else if (typeof currentValue === 'object' && typeof value === 'object') {
          store.set(key, { ...currentValue, ...value });
        } else {
          store.set(key, value);
        }
      });

      touchMetadata();
      return { success: true };
    }
  );
}

// 归档当前会话并启动新会话，同时清空学生和单词数据
function startNewSession() {
  return runWithFallback(
    'startNewSession',
    (error) => ({ success: false, error: error.message }),
    () => {
      archiveActiveSessionInternal();
      store.set('students', getDefaultValue('students'));
      store.set('words', getDefaultValue('words'));
      touchMetadata();
      return { success: true };
    }
  );
}

// 清空历史：支持清空当前会话或全部历史
function clearHistory(options = {}) {
  return runWithFallback(
    'clearHistory',
    (error) => ({ success: false, error: error.message }),
    () => {
      const scope = options.scope === 'all' ? 'all' : 'current';
      const cache = ensureSessionCache();
      if (scope === 'all') {
        cache.archivedSessions = [];
        cache.activeSession = createNewActiveSession();
      } else {
        cache.activeSession.events = [];
      }
      flushSessionCache();
      return { success: true };
    }
  );
}

function clearSession() {
  return runWithFallback(
    'clearSession',
    (error) => ({ success: false, error: error.message }),
    () => {
      store.set('students', getDefaultValue('students'));
      store.set('words', getDefaultValue('words'));
      store.set('sessionHistory', getDefaultValue('sessionHistory'));
      touchMetadata();
      return { success: true };
    }
  );
}

function addSessionHistory(entry) {
  return runWithFallback(
    'addSessionHistory',
    (error) => ({ success: false, error: error.message }),
    () => {
      const cache = ensureSessionCache();
      const newEntry = {
        timestamp: new Date().toISOString(),
        student: entry && Object.prototype.hasOwnProperty.call(entry, 'student') ? entry.student : null,
        word: entry && Object.prototype.hasOwnProperty.call(entry, 'word') ? entry.word : null,
        fairness: entry && Object.prototype.hasOwnProperty.call(entry, 'fairness') ? entry.fairness : null,
        payload: entry && Object.prototype.hasOwnProperty.call(entry, 'payload') ? entry.payload : null
      };
      cache.activeSession.events.push(newEntry);

      if (Array.isArray(cache.activeSession.events) && cache.activeSession.events.length > MAX_EVENTS_PER_SESSION) {
        cache.activeSession.events.splice(0, cache.activeSession.events.length - MAX_EVENTS_PER_SESSION);
      }

      flushSessionCache();
      return { success: true };
    }
  );
}

function getSettings() {
  return runWithFallback(
    'getSettings',
    getDefaultValue('settings'),
    () => store.get('settings', getDefaultValue('settings'))
  );
}

function updateSettings(newSettings) {
  return runWithFallback(
    'updateSettings',
    (error) => ({ success: false, error: error.message }),
    () => {
      if (typeof newSettings !== 'object' || newSettings === null) {
        throw new Error('newSettings 必须为对象');
      }

      const currentSettings = store.get('settings', getDefaultValue('settings'));
      const nextSettings = {
        ...currentSettings,
        ...newSettings,
        lastUpdated: new Date().toISOString()
      };
      store.set('settings', nextSettings);
      touchMetadata();
      return { success: true };
    }
  );
}

function touchMetadata() {
  const metadata = store.get('metadata', getDefaultValue('metadata'));
  store.set('metadata', {
    ...metadata,
    lastModified: new Date().toISOString()
  });
}

module.exports = {
  getState,
  setState,
  updatePartial,
  // 会话管理
  startNewSession,
  clearHistory,
  clearSession,
  addSessionHistory,
  // 设置
  getSettings,
  updateSettings
};
