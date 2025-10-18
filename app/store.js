const Store = require('electron-store');

const DEFAULT_STATE = {
  students: [],
  words: [],
  settings: {
    musicEnabled: true,
    animationDuration: 2000,
    lastUpdated: null,
    volume: 1,
    playMode: 'loop'
  },
  sessionHistory: [],
  metadata: {
    lastModified: null,
    version: '1.0.0',
    schemaVersion: 1
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
  }
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
      type: 'string'
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
      }
    },
    additionalProperties: false
  },
  sessionHistory: {
    type: 'array',
    default: [],
    items: {
      type: 'object',
      properties: {
        timestamp: {
          type: 'string'
        },
        student: {
          type: ['string', 'null'],
          default: null
        },
        word: {
          type: ['string', 'null'],
          default: null
        },
        payload: {
          type: ['object', 'null'],
          default: null
        }
      },
      required: ['timestamp'],
      additionalProperties: true
    }
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
        default: '1.0.0'
      },
      schemaVersion: {
        type: 'number',
        default: 1
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
      words: store.get('words', getDefaultValue('words')),
      settings: store.get('settings', getDefaultValue('settings')),
      sessionHistory: store.get('sessionHistory', getDefaultValue('sessionHistory')),
      metadata: store.get('metadata', getDefaultValue('metadata')),
      importMetadata: store.get('importMetadata', getDefaultValue('importMetadata'))
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
          store.set(key, nextState[key]);
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
      const history = store.get('sessionHistory', getDefaultValue('sessionHistory'));
      const newEntry = {
        timestamp: new Date().toISOString(),
        ...entry
      };
      history.push(newEntry);

      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }

      store.set('sessionHistory', history);
      touchMetadata();
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
  clearSession,
  addSessionHistory,
  getSettings,
  updateSettings
};
