(function () {
  const IDS = Object.freeze({
    voiceSelect: 'ttsVoiceSelect',
    refreshBtn: 'ttsRefreshVoicesBtn',
    rateSlider: 'ttsRateSlider',
    rateValue: 'ttsRateValue',
    pitchSlider: 'ttsPitchSlider',
    pitchValue: 'ttsPitchValue',
    autoToggle: 'ttsAutoPlayToggle',
    availabilityHint: 'ttsAvailabilityHint'
  });

  const RATE_MIN = 0.1;
  const RATE_MAX = 3;
  const PITCH_MIN = 0.5;
  const PITCH_MAX = 2;

  const DEFAULT_SETTINGS = Object.freeze({
    voice: null,
    rate: 1,
    pitch: 1,
    autoPlayOnAdvance: false
  });

  let settings = { ...DEFAULT_SETTINGS };
  let availableVoices = [];
  let ttsAvailable = false;
  let hasWarnedUnavailable = false;
  let statusUnsubscribe = null;
  const requestBindings = new Map();
  let initialized = false;

  function clamp(value, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return min;
    }
    return Math.min(Math.max(num, min), max);
  }

  function normalizeSettings(value) {
    const input = value && typeof value === 'object' ? value : {};
    const normalized = {
      voice: DEFAULT_SETTINGS.voice,
      rate: DEFAULT_SETTINGS.rate,
      pitch: DEFAULT_SETTINGS.pitch,
      autoPlayOnAdvance: DEFAULT_SETTINGS.autoPlayOnAdvance
    };

    if (Object.prototype.hasOwnProperty.call(input, 'voice')) {
      if (typeof input.voice === 'string') {
        const trimmed = input.voice.trim();
        normalized.voice = trimmed ? trimmed : null;
      } else if (input.voice === null) {
        normalized.voice = null;
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'rate')) {
      const numericRate = Number(input.rate);
      if (Number.isFinite(numericRate)) {
        normalized.rate = Math.round(clamp(numericRate, RATE_MIN, RATE_MAX) * 100) / 100;
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'pitch')) {
      const numericPitch = Number(input.pitch);
      if (Number.isFinite(numericPitch)) {
        normalized.pitch = Math.round(clamp(numericPitch, PITCH_MIN, PITCH_MAX) * 100) / 100;
      }
    }

    if (typeof input.autoPlayOnAdvance === 'boolean') {
      normalized.autoPlayOnAdvance = input.autoPlayOnAdvance;
    }

    return normalized;
  }

  function formatMultiplier(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return '1.0×';
    }
    return `${num
      .toFixed(2)
      .replace(/\.0+$/, '')
      .replace(/\.(\d)0$/, '.$1')}×`;
  }

  function showInfo(message, duration = 3000) {
    if (window.Feedback && typeof window.Feedback.showToast === 'function') {
      window.Feedback.showToast(message, window.Feedback.TOAST_TYPES?.INFO || 'info', duration);
    } else {
      console.log(`[TTS] ${message}`);
    }
  }

  function showWarning(message, duration = 4000) {
    if (window.Feedback && typeof window.Feedback.showWarning === 'function') {
      window.Feedback.showWarning(message, duration);
    } else {
      console.warn(`[TTS] ${message}`);
    }
  }

  function showError(message, duration = 4500) {
    if (window.Feedback && typeof window.Feedback.showError === 'function') {
      window.Feedback.showError(message, duration);
    } else {
      console.error(`[TTS] ${message}`);
    }
  }

  function detectAvailability() {
    ttsAvailable = Boolean(window.tts && typeof window.tts.speak === 'function');
    updateAvailabilityUI();
    return ttsAvailable;
  }

  function updateAvailabilityUI() {
    const voiceSelect = document.getElementById(IDS.voiceSelect);
    const refreshBtn = document.getElementById(IDS.refreshBtn);
    const hint = document.getElementById(IDS.availabilityHint);

    if (voiceSelect) {
      voiceSelect.disabled = !ttsAvailable;
    }
    if (refreshBtn) {
      refreshBtn.disabled = !ttsAvailable;
    }
    if (hint) {
      if (ttsAvailable) {
        hint.style.display = 'none';
        hint.textContent = '';
      } else {
        hint.style.display = 'block';
        hint.textContent = '当前设备暂未启用离线语音播报。';
      }
    }
  }

  function loadSettingsFromStore() {
    try {
      const service = window.PersistenceService;
      if (service && typeof service.getSettings === 'function') {
        const result = service.getSettings();
        if (result && result.success && result.data) {
          settings = normalizeSettings(result.data.tts);
          return;
        }
      }
    } catch (error) {
      console.warn('[TTS] 读取语音设置失败:', error);
    }
    settings = normalizeSettings(null);
  }

  function persistCurrentSettings() {
    if (!window.PersistenceService || typeof window.PersistenceService.updateSettings !== 'function') {
      return;
    }
    try {
      const result = window.PersistenceService.updateSettings({ tts: { ...settings } });
      if (result && result.success === false) {
        showError(`保存语音设置失败：${result.error || '未知错误'}`);
      }
    } catch (error) {
      showError(`保存语音设置失败：${error?.message || '未知错误'}`);
    }
  }

  function updateRateLabel(value) {
    const label = document.getElementById(IDS.rateValue);
    if (label) {
      label.textContent = formatMultiplier(value);
    }
  }

  function updatePitchLabel(value) {
    const label = document.getElementById(IDS.pitchValue);
    if (label) {
      label.textContent = formatMultiplier(value);
    }
  }

  function applySettingsToUI() {
    const voiceSelect = document.getElementById(IDS.voiceSelect);
    if (voiceSelect) {
      const targetValue = settings.voice ?? '';
      if (voiceSelect.value !== targetValue) {
        voiceSelect.value = targetValue;
      }
    }

    const rateSlider = document.getElementById(IDS.rateSlider);
    if (rateSlider) {
      rateSlider.value = String(settings.rate);
    }
    updateRateLabel(settings.rate);

    const pitchSlider = document.getElementById(IDS.pitchSlider);
    if (pitchSlider) {
      pitchSlider.value = String(settings.pitch);
    }
    updatePitchLabel(settings.pitch);

    const autoToggle = document.getElementById(IDS.autoToggle);
    if (autoToggle) {
      autoToggle.checked = Boolean(settings.autoPlayOnAdvance);
    }
  }

  function populateVoiceSelect() {
    const voiceSelect = document.getElementById(IDS.voiceSelect);
    if (!voiceSelect) {
      return;
    }
    const currentValue = settings.voice ?? '';
    voiceSelect.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '系统默认';
    voiceSelect.appendChild(defaultOption);

    if (Array.isArray(availableVoices)) {
      for (const voice of availableVoices) {
        const option = document.createElement('option');
        option.value = voice;
        option.textContent = voice;
        voiceSelect.appendChild(option);
      }
    }

    if (currentValue) {
      voiceSelect.value = currentValue;
      if (voiceSelect.value !== currentValue) {
        voiceSelect.value = '';
      }
    } else {
      voiceSelect.value = '';
    }
  }

  function setVoice(voice, { persist = true, silent = true } = {}) {
    const normalized = typeof voice === 'string' ? voice.trim() : '';
    const nextVoice = normalized ? normalized : null;
    if (settings.voice === nextVoice) {
      return;
    }
    settings = { ...settings, voice: nextVoice };
    applySettingsToUI();
    if (persist) {
      persistCurrentSettings();
    }
    if (!silent && nextVoice) {
      showInfo(`已切换语音：${nextVoice}`, 2200);
    }
  }

  function setRate(value, { persist = true } = {}) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      updateRateLabel(settings.rate);
      return;
    }
    const clamped = Math.round(clamp(numeric, RATE_MIN, RATE_MAX) * 100) / 100;
    if (Math.abs(clamped - settings.rate) < 0.001) {
      updateRateLabel(clamped);
      return;
    }
    settings = { ...settings, rate: clamped };
    updateRateLabel(clamped);
    if (persist) {
      persistCurrentSettings();
    }
  }

  function setPitch(value, { persist = true } = {}) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      updatePitchLabel(settings.pitch);
      return;
    }
    const clamped = Math.round(clamp(numeric, PITCH_MIN, PITCH_MAX) * 100) / 100;
    if (Math.abs(clamped - settings.pitch) < 0.001) {
      updatePitchLabel(clamped);
      return;
    }
    settings = { ...settings, pitch: clamped };
    updatePitchLabel(clamped);
    if (persist) {
      persistCurrentSettings();
    }
  }

  function setAutoPlay(enabled, { persist = true } = {}) {
    const flag = Boolean(enabled);
    if (settings.autoPlayOnAdvance === flag) {
      return;
    }
    settings = { ...settings, autoPlayOnAdvance: flag };
    if (persist) {
      persistCurrentSettings();
    }
  }

  function handleMissingVoice() {
    if (!settings.voice) {
      return;
    }
    const missing = settings.voice;
    setVoice(null, { persist: true, silent: true });
    populateVoiceSelect();
    applySettingsToUI();
    showWarning(`未找到语音“${missing}”，已恢复为系统默认语音。`, 4200);
  }

  async function refreshVoices({ silent = false } = {}) {
    if (!detectAvailability()) {
      if (!silent && !hasWarnedUnavailable) {
        showWarning('语音播报模块不可用，无法刷新语音列表。');
      }
      return { success: false, error: 'tts-unavailable' };
    }

    if (!window.tts || typeof window.tts.getVoices !== 'function') {
      availableVoices = [];
      populateVoiceSelect();
      if (!silent) {
        showWarning('当前平台不支持列出语音列表，将使用系统默认语音。');
      }
      return { success: false, error: 'voice-list-not-supported' };
    }

    const refreshBtn = document.getElementById(IDS.refreshBtn);
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.classList.add('is-busy');
    }

    try {
      const result = await window.tts.getVoices();
      if (!result || !result.success) {
        availableVoices = [];
        populateVoiceSelect();
        if (!silent) {
          showError(result?.error || '刷新语音列表失败');
        }
        return result || { success: false, error: 'voice-refresh-failed' };
      }

      availableVoices = Array.isArray(result.voices) ? result.voices.slice() : [];
      populateVoiceSelect();
      applySettingsToUI();

      if (settings.voice && availableVoices.length && !availableVoices.includes(settings.voice)) {
        handleMissingVoice();
      }

      if (!silent) {
        showInfo(`已加载 ${availableVoices.length} 个语音选项。`, 2200);
      }

      return result;
    } catch (error) {
      availableVoices = [];
      populateVoiceSelect();
      if (!silent) {
        showError(error?.message || '刷新语音列表失败');
      }
      return { success: false, error: error?.message || 'voice-refresh-failed' };
    } finally {
      if (refreshBtn) {
        refreshBtn.classList.remove('is-busy');
        refreshBtn.disabled = !ttsAvailable;
      }
    }
  }

  function setButtonState(button, state) {
    if (!button) return;
    if (state === 'speaking') {
      button.classList.add('is-speaking');
      button.classList.remove('is-queued');
      button.setAttribute('aria-busy', 'true');
    } else if (state === 'queued') {
      button.classList.add('is-queued');
      button.classList.remove('is-speaking');
      button.setAttribute('aria-busy', 'true');
    } else {
      button.classList.remove('is-speaking');
      button.classList.remove('is-queued');
      button.removeAttribute('aria-busy');
    }
  }

  function registerRequestBinding(requestId, binding) {
    if (!requestId) return;
    requestBindings.set(requestId, binding);
  }

  function cleanupBinding(requestId) {
    const binding = requestBindings.get(requestId);
    if (!binding) {
      return;
    }
    const { button } = binding;
    if (button) {
      if (button.dataset.ttsRequestId === requestId) {
        delete button.dataset.ttsRequestId;
      }
      setButtonState(button, 'idle');
    }
    requestBindings.delete(requestId);
  }

  function handleStatus(payload) {
    if (!payload || !payload.requestId) {
      return;
    }
    const binding = requestBindings.get(payload.requestId);
    if (!binding) {
      return;
    }

    if (payload.status === 'started') {
      setButtonState(binding.button, 'speaking');
      return;
    }

    if (payload.status === 'error') {
      if (!binding.suppressErrorToast) {
        showError(payload.error ? `语音播报失败：${payload.error}` : '语音播报失败。');
      }
      cleanupBinding(payload.requestId);
      return;
    }

    if (payload.status === 'finished' || payload.status === 'cancelled') {
      cleanupBinding(payload.requestId);
    }
  }

  function attachStatusListener() {
    if (!window.tts || typeof window.tts.onStatus !== 'function') {
      return;
    }
    if (typeof statusUnsubscribe === 'function') {
      statusUnsubscribe();
    }
    statusUnsubscribe = window.tts.onStatus(handleStatus);
  }

  function mapErrorCodeToMessage(code) {
    switch (code) {
      case 'invalid-arguments':
        return '语音参数无效。';
      case 'empty-text':
        return '没有可朗读的文本。';
      case 'text-too-long':
        return '文本超过了允许的长度限制。';
      case 'invalid-rate':
        return '语速设置无效。';
      case 'invalid-pitch':
        return '音调设置无效。';
      case 'invalid-voice':
      case 'voice-unsafe':
        return '所选语音不可用。';
      case 'ipc-failed':
        return '语音服务通信失败。';
      case 'speak-failed':
        return '语音播报启动失败。';
      case 'tts-unavailable':
        return '当前设备暂不支持语音播报。';
      default:
        return '语音播报失败。';
    }
  }

  async function speakText(text, options = {}) {
    const {
      button = null,
      suppressQueuedToast = false,
      source = 'manual',
      retryOnVoiceFailure = true,
      hasRetried = false,
      suppressErrorToast = false
    } = options;

    const normalizedText = typeof text === 'string' ? text.trim() : (text == null ? '' : String(text).trim());
    if (!normalizedText) {
      if (!suppressErrorToast) {
        showWarning('没有可朗读的文本。', 2200);
      }
      return { success: false, error: 'empty-text', code: 'empty-text' };
    }

    if (!detectAvailability()) {
      if (!hasWarnedUnavailable && !suppressErrorToast) {
        showError('当前设备暂不支持语音播报。');
        hasWarnedUnavailable = true;
      }
      return { success: false, error: 'tts-unavailable', code: 'tts-unavailable' };
    }

    const payload = {
      text: normalizedText,
      rate: settings.rate,
      pitch: settings.pitch
    };
    if (settings.voice) {
      payload.voice = settings.voice;
    }

    try {
      const result = await window.tts.speak(payload);
      if (!result || !result.success) {
        return handleSpeakError(result, {
          ...options,
          text: normalizedText,
          hasRetried,
          retryOnVoiceFailure,
          suppressErrorToast
        });
      }

      const requestId = result.requestId;
      if (button && requestId) {
        button.dataset.ttsRequestId = requestId;
        const initialState = result.status === 'queued' ? 'queued' : 'speaking';
        setButtonState(button, initialState);
      }

      if (requestId) {
        registerRequestBinding(requestId, {
          button,
          suppressQueuedToast,
          source,
          suppressErrorToast
        });
      }

      if (result.status === 'queued' && !suppressQueuedToast) {
        showInfo('语音将在当前播放完成后继续播报。', 2400);
      }

      return result;
    } catch (error) {
      return handleSpeakError(
        { success: false, error: error?.message || 'speak-failed', code: 'speak-failed' },
        {
          ...options,
          text: normalizedText,
          hasRetried,
          retryOnVoiceFailure,
          suppressErrorToast
        }
      );
    }
  }

  async function handleSpeakError(result, context) {
    const {
      button,
      text,
      suppressErrorToast = false,
      retryOnVoiceFailure = true,
      hasRetried = false
    } = context || {};

    const code = result?.code;
    const message = result?.error;

    if ((code === 'invalid-voice' || code === 'voice-unsafe') && settings.voice && retryOnVoiceFailure && !hasRetried) {
      const previousVoice = settings.voice;
      setVoice(null, { persist: true, silent: true });
      populateVoiceSelect();
      applySettingsToUI();
      showWarning(`语音“${previousVoice}”不可用，已恢复为系统默认。`, 4200);
      return speakText(text, { ...context, hasRetried: true });
    }

    if (button) {
      if (button.dataset.ttsRequestId) {
        delete button.dataset.ttsRequestId;
      }
      setButtonState(button, 'idle');
    }

    if (code === 'tts-unavailable') {
      detectAvailability();
      if (!hasWarnedUnavailable && !suppressErrorToast) {
        showError(mapErrorCodeToMessage(code));
        hasWarnedUnavailable = true;
      }
    } else if (!suppressErrorToast) {
      showError(message || mapErrorCodeToMessage(code));
    }

    return {
      success: false,
      error: message || mapErrorCodeToMessage(code),
      code: code || 'speak-failed'
    };
  }

  async function stopSpeech(options) {
    if (!window.tts || typeof window.tts.stop !== 'function') {
      return { success: false, error: 'tts-unavailable', code: 'tts-unavailable' };
    }
    try {
      const result = await window.tts.stop(options);
      Array.from(requestBindings.keys()).forEach((requestId) => cleanupBinding(requestId));
      return result;
    } catch (error) {
      showError(error?.message || '停止语音失败');
      return { success: false, error: error?.message || 'stop-failed', code: 'stop-failed' };
    }
  }

  function initControls() {
    const voiceSelect = document.getElementById(IDS.voiceSelect);
    if (voiceSelect && !voiceSelect._ttsBound) {
      voiceSelect.addEventListener('change', (event) => {
        const value = typeof event.target.value === 'string' ? event.target.value : '';
        setVoice(value || null, { silent: true });
      });
      voiceSelect._ttsBound = true;
    }

    const refreshBtn = document.getElementById(IDS.refreshBtn);
    if (refreshBtn && !refreshBtn._ttsBound) {
      refreshBtn.addEventListener('click', () => {
        refreshVoices({ silent: false });
      });
      refreshBtn._ttsBound = true;
    }

    const rateSlider = document.getElementById(IDS.rateSlider);
    if (rateSlider && !rateSlider._ttsBound) {
      rateSlider.addEventListener('input', (event) => {
        updateRateLabel(event.target.value);
      });
      rateSlider.addEventListener('change', (event) => {
        setRate(event.target.value);
      });
      rateSlider._ttsBound = true;
    }

    const pitchSlider = document.getElementById(IDS.pitchSlider);
    if (pitchSlider && !pitchSlider._ttsBound) {
      pitchSlider.addEventListener('input', (event) => {
        updatePitchLabel(event.target.value);
      });
      pitchSlider.addEventListener('change', (event) => {
        setPitch(event.target.value);
      });
      pitchSlider._ttsBound = true;
    }

    const autoToggle = document.getElementById(IDS.autoToggle);
    if (autoToggle && !autoToggle._ttsBound) {
      autoToggle.addEventListener('change', (event) => {
        setAutoPlay(event.target.checked);
      });
      autoToggle._ttsBound = true;
    }
  }

  function init() {
    if (initialized) {
      return;
    }
    initialized = true;
    detectAvailability();
    loadSettingsFromStore();
    populateVoiceSelect();
    initControls();
    applySettingsToUI();
    attachStatusListener();
    if (ttsAvailable) {
      refreshVoices({ silent: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.TTSManager = Object.freeze({
    speak: speakText,
    speakWord: (text, options = {}) => speakText(text, { ...options, source: options.source || 'word' }),
    speakExample: (text, options = {}) => speakText(text, { ...options, source: options.source || 'example' }),
    stop: stopSpeech,
    refreshVoices,
    getVoices: () => availableVoices.slice(),
    getSettings: () => ({ ...settings }),
    isAutoPlayEnabled: () => Boolean(settings.autoPlayOnAdvance)
  });
})();
