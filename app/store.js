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
  },
  // 会话历史：区分活动会话与归档会话
  sessionHistory: {
    activeSession: {
      id: null,
      startedAt: null,
      events: [],
      // 新增：闪卡复习日志（查看/掌握度变化/收藏变化/编辑）
      wordsReview: [],
      // 学习模式会话记录
      learning: []
    },
    archivedSessions: []
  },
  metadata: {
    lastModified: null,
    version: '2.1.1',
    schemaVersion: 4
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
      },
      flashcard: {
        type: 'object',
        default: DEFAULT_STATE.settings.flashcard,
        properties: {
          order: { type: 'string', default: 'shuffled' },
          defaultFace: { type: 'string', default: 'front' },
          includeImages: { type: 'boolean', default: true },
          filters: {
            type: 'object',
            default: { mode: 'all', masteryMin: 0, masteryMax: 3 },
            properties: {
              mode: { type: 'string', default: 'all' },
              masteryMin: { type: 'number', default: 0 },
              masteryMax: { type: 'number', default: 3 }
            },
            additionalProperties: true
          }
        },
        additionalProperties: true
      },
      tts: {
        type: 'object',
        default: DEFAULT_STATE.settings.tts,
        properties: {
          voice: { type: ['string', 'null'], default: null },
          rate: { type: 'number', minimum: 0.1, maximum: 3, default: 1 },
          pitch: { type: 'number', minimum: 0.5, maximum: 2, default: 1 },
          autoPlayOnAdvance: { type: 'boolean', default: false }
        },
        additionalProperties: true
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
          },
          wordsReview: {
            type: 'array',
            default: [],
            items: {
              type: 'object',
              properties: {
                timestamp: { type: 'string' },
                word: { type: ['string', 'object', 'null'], default: null },
                action: { type: 'string' }, // view|mastery|favorite|edit
                payload: { type: ['object', 'null'], default: null }
              },
              required: ['timestamp', 'action'],
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
            wordsReview: {
              type: 'array',
              default: [],
              items: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string' },
                  word: { type: ['string', 'object', 'null'], default: null },
                  action: { type: 'string' }, // view|mastery|favorite|edit
                  payload: { type: ['object', 'null'], default: null }
                },
                required: ['timestamp', 'action'],
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
const CURRENT_SCHEMA_VERSION = 4;

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

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(Math.max(num, min), max);
}

function normalizeTtsSettings(value) {
  const base = DEFAULT_STATE.settings.tts;
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
  const base = DEFAULT_STATE.settings.flashcard;
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
  const base = DEFAULT_STATE.settings;
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
const MAX_REVIEWS_PER_SESSION = 1000;
let sessionCache = null;

function createSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createNewActiveSession() {
  return {
    id: createSessionId(),
    startedAt: new Date().toISOString(),
    events: [],
    wordsReview: []
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
      if (!Array.isArray(history.activeSession.wordsReview)) {
        history.activeSession.wordsReview = [];
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
    events: Array.isArray(active.events) ? active.events : [],
    wordsReview: Array.isArray(active.wordsReview) ? active.wordsReview : [],
    summary: {
      count: Array.isArray(active.events) ? active.events.length : 0,
      reviewCount: Array.isArray(active.wordsReview) ? active.wordsReview.length : 0
    }
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
      settings: normalizeSettings(store.get('settings', getDefaultValue('settings'))),
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
          } else if (key === 'settings') {
            store.set('settings', normalizeSettings(nextState[key]));
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

        if (key === 'settings' && value && typeof value === 'object') {
          const current = normalizeSettings(store.get('settings', getDefaultValue('settings')));
          const patchSettings = { ...value };
          if (patchSettings.flashcard && typeof patchSettings.flashcard === 'object') {
            const mergedFlashcard = {
              ...current.flashcard,
              ...patchSettings.flashcard
            };
            if (patchSettings.flashcard.filters && typeof patchSettings.flashcard.filters === 'object') {
              mergedFlashcard.filters = {
                ...current.flashcard.filters,
                ...patchSettings.flashcard.filters
              };
            }
            patchSettings.flashcard = mergedFlashcard;
          }
          if (patchSettings.tts && typeof patchSettings.tts === 'object') {
            patchSettings.tts = {
              ...current.tts,
              ...patchSettings.tts
            };
          }
          const merged = normalizeSettings({ ...current, ...patchSettings });
          store.set('settings', merged);
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
        if (Array.isArray(cache.activeSession.wordsReview)) {
          cache.activeSession.wordsReview = [];
        } else {
          cache.activeSession.wordsReview = [];
        }
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

function addWordReview(entry) {
  return runWithFallback(
    'addWordReview',
    (error) => ({ success: false, error: error.message }),
    () => {
      const cache = ensureSessionCache();
      const newEntry = {
        timestamp: new Date().toISOString(),
        word: entry && Object.prototype.hasOwnProperty.call(entry, 'word') ? entry.word : null,
        action: entry && typeof entry.action === 'string' ? entry.action : 'view',
        payload: entry && Object.prototype.hasOwnProperty.call(entry, 'payload') ? entry.payload : null
      };
      if (!Array.isArray(cache.activeSession.wordsReview)) {
        cache.activeSession.wordsReview = [];
      }
      cache.activeSession.wordsReview.push(newEntry);
      if (cache.activeSession.wordsReview.length > MAX_REVIEWS_PER_SESSION) {
        cache.activeSession.wordsReview.splice(0, cache.activeSession.wordsReview.length - MAX_REVIEWS_PER_SESSION);
      }
      flushSessionCache();
      return { success: true };
    }
  );
}

function updateSessionHistory(history) {
  return runWithFallback(
    'updateSessionHistory',
    (error) => ({ success: false, error: error.message }),
    () => {
      if (typeof history !== 'object' || history === null) {
        throw new Error('history must be an object');
      }
      
      const cache = ensureSessionCache();
      if (history.learning && Array.isArray(history.learning)) {
        cache.activeSession.learning = history.learning.slice();
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
    () => normalizeSettings(store.get('settings', getDefaultValue('settings')))
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

      const currentSettings = normalizeSettings(store.get('settings', getDefaultValue('settings')));
      const patch = { ...newSettings };

      if (patch.flashcard && typeof patch.flashcard === 'object') {
        const mergedFlashcard = {
          ...currentSettings.flashcard,
          ...patch.flashcard
        };
        if (patch.flashcard.filters && typeof patch.flashcard.filters === 'object') {
          mergedFlashcard.filters = {
            ...currentSettings.flashcard.filters,
            ...patch.flashcard.filters
          };
        }
        patch.flashcard = mergedFlashcard;
      }

      if (patch.tts && typeof patch.tts === 'object') {
        patch.tts = {
          ...currentSettings.tts,
          ...patch.tts
        };
      }

      const nextSettingsRaw = {
        ...currentSettings,
        ...patch,
        lastUpdated: new Date().toISOString()
      };
      const normalized = normalizeSettings(nextSettingsRaw);
      store.set('settings', normalized);
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
  updateSessionHistory,
  addWordReview,
  // 设置
  getSettings,
  updateSettings
};
