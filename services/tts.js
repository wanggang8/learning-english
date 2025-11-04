const { EventEmitter } = require('events');
const crypto = require('crypto');

let say;
try {
    // Lazy require to surface a clear error when native binaries are missing.
    say = require('say');
} catch (error) {
    say = null;
    console.warn('[TTS] Failed to load say module – offline TTS will be unavailable.', error);
}

const RATE_MIN = 0.1;
const RATE_MAX = 3.0;
const TEXT_LIMIT = 5000;
const DISALLOWED_VOICE_CHARS = /[;&|><`$\\]/;
const NEWLINE_PATTERN = /[\r\n]/;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function createRequestId() {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return crypto.randomBytes(16).toString('hex');
}

class OfflineTTS extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
        this.currentTask = null;
        this.isSpeaking = false;
        this.platform = process.platform;
        this.available = Boolean(say && typeof say.speak === 'function' && typeof say.stop === 'function');
        this.capabilities = Object.freeze({
            platform: this.platform,
            available: this.available,
            canQueue: true,
            canStop: this.available,
            canSelectVoice: this.available,
            canListVoices: this.available && typeof (say && say.getInstalledVoices) === 'function'
        });
    }

    speak(input) {
        if (!this.available) {
            return {
                success: false,
                error: 'Text-to-speech is unavailable on this platform.',
                code: 'tts-unavailable',
                platform: this.platform
            };
        }

        const normalized = this._normalizeOptions(input);
        if (!normalized.success) {
            return {
                success: false,
                error: normalized.error,
                code: normalized.code,
                platform: this.platform,
                limit: normalized.limit
            };
        }

        const { requestId, text, voice, rate, textLength } = normalized;
        const queued = Boolean(this.isSpeaking || this.currentTask);
        const task = {
            id: requestId,
            text,
            voice,
            rate,
            textLength,
            createdAt: Date.now(),
            finalized: false
        };

        this.queue.push(task);
        this._processQueue();

        return {
            success: true,
            requestId,
            status: queued ? 'queued' : 'playing',
            queued,
            voice: voice ?? null,
            rate,
            textLength,
            platform: this.platform,
            capabilities: this.capabilities
        };
    }

    stop(options = {}) {
        if (!this.available) {
            return {
                success: true,
                interrupted: false,
                clearedQueue: false,
                clearedCount: 0,
                platform: this.platform,
                capabilities: this.capabilities
            };
        }

        let flushQueue = true;
        if (options && typeof options === 'object' && Object.prototype.hasOwnProperty.call(options, 'flushQueue')) {
            flushQueue = options.flushQueue !== false;
        }

        let clearedCount = 0;
        if (flushQueue && this.queue.length > 0) {
            const dropped = this.queue.splice(0);
            clearedCount = dropped.length;
            if (clearedCount > 0) {
                const timestamp = Date.now();
                for (const task of dropped) {
                    this._emitStatus({
                        requestId: task.id,
                        status: 'cancelled',
                        reason: 'flushed',
                        textLength: task.textLength,
                        rate: task.rate,
                        voice: task.voice ?? null,
                        timestamp
                    });
                }
            }
        }

        const activeTask = this.currentTask;
        const interrupted = Boolean(activeTask && !activeTask.finalized);

        if (!interrupted) {
            try {
                say.stop();
            } catch (_error) {
                // No-op: nothing was playing.
            }
            return {
                success: true,
                interrupted: false,
                clearedQueue: clearedCount > 0,
                clearedCount,
                platform: this.platform,
                capabilities: this.capabilities
            };
        }

        try {
            say.stop();
        } catch (error) {
            return {
                success: false,
                error: error?.message || 'Unable to stop speech.',
                code: 'stop-failed',
                platform: this.platform
            };
        }

        this._finalizeTask(activeTask, 'cancelled', { reason: 'manual-stop' });

        return {
            success: true,
            interrupted: true,
            clearedQueue: clearedCount > 0,
            clearedCount,
            platform: this.platform,
            capabilities: this.capabilities
        };
    }

    async getVoices() {
        if (!this.available) {
            return {
                success: false,
                error: 'Text-to-speech is unavailable on this platform.',
                code: 'tts-unavailable',
                platform: this.platform
            };
        }

        if (typeof (say && say.getInstalledVoices) !== 'function') {
            return {
                success: false,
                error: 'Listing voices is not supported on this platform.',
                code: 'voice-list-not-supported',
                platform: this.platform
            };
        }

        return new Promise((resolve) => {
            say.getInstalledVoices((error, voices) => {
                if (error) {
                    resolve({
                        success: false,
                        error: error?.message || 'Unable to retrieve voices.',
                        code: 'voice-query-failed',
                        platform: this.platform
                    });
                    return;
                }

                const list = Array.isArray(voices)
                    ? voices
                        .filter((name) => typeof name === 'string')
                        .map((name) => name.trim())
                        .filter((name) => name.length > 0)
                    : [];

                const unique = Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));

                resolve({
                    success: true,
                    voices: unique,
                    platform: this.platform,
                    capabilities: this.capabilities
                });
            });
        });
    }

    getCapabilities() {
        return this.capabilities;
    }

    _processQueue() {
        if (!this.available || this.isSpeaking) {
            return;
        }

        const next = this.queue.shift();
        if (!next) {
            return;
        }

        this.isSpeaking = true;
        const taskWrapper = { ...next, finalized: false };
        this.currentTask = taskWrapper;

        this._emitStatus({
            requestId: taskWrapper.id,
            status: 'started',
            voice: taskWrapper.voice ?? null,
            rate: taskWrapper.rate,
            textLength: taskWrapper.textLength,
            timestamp: Date.now(),
            queueLength: this.queue.length
        });

        const finalize = (status, extra = {}) => {
            this._finalizeTask(taskWrapper, status, extra);
        };

        try {
            say.speak(
                taskWrapper.text,
                taskWrapper.voice || undefined,
                taskWrapper.rate,
                (error) => {
                    if (error) {
                        finalize('error', { error: error?.message || 'playback-error' });
                    } else {
                        finalize('finished');
                    }
                }
            );
        } catch (error) {
            finalize('error', { error: error?.message || 'playback-error' });
        }
    }

    _finalizeTask(taskWrapper, status, extra = {}) {
        if (!taskWrapper || taskWrapper.finalized) {
            return;
        }

        taskWrapper.finalized = true;
        if (this.currentTask && this.currentTask.id === taskWrapper.id) {
            this.currentTask = null;
            this.isSpeaking = false;
        }

        this._emitStatus({
            requestId: taskWrapper.id,
            status,
            voice: taskWrapper.voice ?? null,
            rate: taskWrapper.rate,
            textLength: taskWrapper.textLength,
            timestamp: Date.now(),
            ...extra
        });

        setImmediate(() => this._processQueue());
    }

    _emitStatus(payload) {
        this.emit('status', {
            ...payload,
            platform: this.platform,
            capabilities: this.capabilities
        });
    }

    _normalizeOptions(input) {
        let value = input;
        if (typeof value === 'string') {
            value = { text: value };
        }

        if (!value || typeof value !== 'object') {
            return {
                success: false,
                error: 'Invalid argument. Expected an object with a text property.',
                code: 'invalid-arguments'
            };
        }

        let text = value.text;
        if (typeof text !== 'string') {
            text = text == null ? '' : String(text);
        }
        text = text.replace(/\r\n/g, '\n').trim();
        if (!text) {
            return {
                success: false,
                error: 'Text is required for speech synthesis.',
                code: 'empty-text'
            };
        }
        if (text.length > TEXT_LIMIT) {
            return {
                success: false,
                error: `Text exceeds maximum length of ${TEXT_LIMIT} characters.`,
                code: 'text-too-long',
                limit: TEXT_LIMIT
            };
        }

        let voice = null;
        if (value.voice != null) {
            if (typeof value.voice !== 'string') {
                return {
                    success: false,
                    error: 'Voice must be a string.',
                    code: 'invalid-voice'
                };
            }
            const cleaned = value.voice.trim();
            if (cleaned) {
                if (DISALLOWED_VOICE_CHARS.test(cleaned) || NEWLINE_PATTERN.test(cleaned)) {
                    return {
                        success: false,
                        error: 'Voice contains unsupported characters.',
                        code: 'invalid-voice'
                    };
                }
                voice = cleaned;
            }
        }

        let rate = 1.0;
        if (value.rate != null) {
            const numeric = Number(value.rate);
            if (!Number.isFinite(numeric)) {
                return {
                    success: false,
                    error: 'Rate must be a finite number.',
                    code: 'invalid-rate'
                };
            }
            rate = clamp(numeric, RATE_MIN, RATE_MAX);
        }

        return {
            success: true,
            requestId: createRequestId(),
            text,
            voice,
            rate,
            textLength: text.length
        };
    }
}

module.exports = function createOfflineTTS() {
    return new OfflineTTS();
};
