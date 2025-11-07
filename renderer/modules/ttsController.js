// TTSController: Manages TTS playback lifecycle, serialization, and integration with learning flows
(function() {
  'use strict';

  // Playback states
  const PLAYBACK_STATES = Object.freeze({
    IDLE: 'idle',
    QUEUED: 'queued', 
    SPEAKING: 'speaking',
    SUSPENDED: 'suspended',
    ERROR: 'error'
  });

  // Request priorities for future extensibility
  const PRIORITIES = Object.freeze({
    CRITICAL: 0,    // Stop commands, errors
    HIGH: 1,       // Navigation cancellations
    NORMAL: 2,     // Regular TTS requests
    LOW: 3         // Background/auto-play
  });

  // Controller state
  let state = {
    playbackState: PLAYBACK_STATES.IDLE,
    currentRequest: null,
    requestQueue: [],
    suspendedReason: null,
    isAppFocused: true,
    isModalVisible: false,
    activeMode: null, // 'flashcard', 'word', 'drawing', etc.
    sessionHooks: new Map(),
    errorCount: 0,
    lastError: null
  };

  // Generate unique request IDs
  let requestIdCounter = 0;
  function generateRequestId() {
    return `tts_req_${++requestIdCounter}_${Date.now()}`;
  }

  // Request structure
  function createRequest(text, options = {}) {
    return {
      id: generateRequestId(),
      text: String(text || '').trim(),
      priority: options.priority || PRIORITIES.NORMAL,
      source: options.source || 'manual',
      button: options.button || null,
      onSuccess: options.onSuccess || null,
      onError: options.onError || null,
      onCancel: options.onCancel || null,
      suppressErrorToast: options.suppressErrorToast || false,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries || 1
    };
  }

  // Check if TTS is available
  function isTTSAvailable() {
    return window.TTSManager && typeof window.TTSManager.speak === 'function';
  }

  // Check if any blocking overlay is visible
  function isBlockingOverlayVisible() {
    if (document.getElementById('filePrompt')) return true;
    if (document.querySelector('.modal.active')) return true;
    return false;
  }

  // Update controller state
  function updateState(newState) {
    const prevState = { ...state };
    state = { ...state, ...newState };
    
    // Trigger state change hooks if needed
    if (prevState.playbackState !== newState.playbackState) {
      triggerSessionHooks('stateChange', {
        from: prevState.playbackState,
        to: newState.playbackState,
        request: state.currentRequest
      });
    }
  }

  // Register session hooks
  function registerSessionHook(event, callback) {
    if (!state.sessionHooks.has(event)) {
      state.sessionHooks.set(event, []);
    }
    state.sessionHooks.get(event).push(callback);
  }

  // Trigger session hooks
  function triggerSessionHooks(event, data) {
    const hooks = state.sessionHooks.get(event);
    if (hooks) {
      hooks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[TTSController] Hook error:', error);
        }
      });
    }
  }

  // Handle TTS errors with session hooks
  function handleTTSError(error, request) {
    state.errorCount++;
    state.lastError = error;
    
    triggerSessionHooks('error', {
      error,
      request,
      errorCount: state.errorCount,
      consecutiveErrors: state.errorCount
    });

    // Reset error count on successful playback after retries
    setTimeout(() => {
      if (state.errorCount > 0) {
        state.errorCount = 0;
        state.lastError = null;
      }
    }, 5000);
  }

  // Add request to queue with priority ordering
  function enqueueRequest(request) {
    if (!request || !request.text) {
      return false;
    }

    // Insert based on priority (lower number = higher priority)
    let insertIndex = state.requestQueue.length;
    for (let i = 0; i < state.requestQueue.length; i++) {
      if (request.priority < state.requestQueue[i].priority) {
        insertIndex = i;
        break;
      }
    }
    
    state.requestQueue.splice(insertIndex, 0, request);
    return true;
  }

  // Remove request from queue
  function dequeueRequest(requestId) {
    const index = state.requestQueue.findIndex(req => req.id === requestId);
    if (index !== -1) {
      return state.requestQueue.splice(index, 1)[0];
    }
    return null;
  }

  // Process next request in queue
  async function processQueue() {
    // Don't process if suspended or already speaking
    if (state.playbackState === PLAYBACK_STATES.SUSPENDED || 
        state.playbackState === PLAYBACK_STATES.SPEAKING) {
      return;
    }

    // Check if we should be suspended
    if (shouldSuspend()) {
      updateState({ 
        playbackState: PLAYBACK_STATES.SUSPENDED,
        suspendedReason: getSuspendReason()
      });
      return;
    }

    // Get next request
    const request = state.requestQueue.shift();
    if (!request) {
      updateState({ playbackState: PLAYBACK_STATES.IDLE, currentRequest: null });
      return;
    }

    // Check TTS availability
    if (!isTTSAvailable()) {
      handleTTSError(new Error('TTS not available'), request);
      if (request.onError) {
        request.onError('tts-unavailable');
      }
      // Continue processing next request
      setTimeout(processQueue, 100);
      return;
    }

    // Start speaking
    updateState({ 
      playbackState: PLAYBACK_STATES.SPEAKING, 
      currentRequest: request 
    });

    try {
      const result = await window.TTSManager.speak(request.text, {
        button: request.button,
        source: request.source,
        suppressErrorToast: request.suppressErrorToast
      });

      if (result.success) {
        // Reset error count on success
        if (state.errorCount > 0) {
          state.errorCount = 0;
          state.lastError = null;
        }

        if (request.onSuccess) {
          request.onSuccess(result);
        }

        triggerSessionHooks('requestCompleted', {
          request,
          result
        });

        // Continue to next request after a short delay
        setTimeout(processQueue, 100);
      } else {
        throw new Error(result.error || 'TTS playback failed');
      }
    } catch (error) {
      handleTTSError(error, request);

      // Retry logic
      if (request.retryCount < request.maxRetries) {
        request.retryCount++;
        console.warn(`[TTSController] Retrying request ${request.id} (attempt ${request.retryCount})`);
        state.requestQueue.unshift(request); // Put back at front
        setTimeout(processQueue, 1000); // Wait before retry
      } else {
        if (request.onError) {
          request.onError(error.message || 'playback-failed');
        }

        triggerSessionHooks('requestFailed', {
          request,
          error
        });

        // Continue to next request
        setTimeout(processQueue, 100);
      }
    }
  }

  // Check if playback should be suspended
  function shouldSuspend() {
    return !state.isAppFocused || isBlockingOverlayVisible();
  }

  // Get reason for suspension
  function getSuspendReason() {
    if (!state.isAppFocused) return 'app-unfocused';
    if (isBlockingOverlayVisible()) return 'modal-visible';
    return 'unknown';
  }

  // Resume playback if conditions allow
  function resumePlayback() {
    if (state.playbackState === PLAYBACK_STATES.SUSPENDED && !shouldSuspend()) {
      updateState({ 
        playbackState: PLAYBACK_STATES.IDLE,
        suspendedReason: null 
      });
      processQueue();
    }
  }

  // Suspend playback immediately
  function suspendPlayback(reason = 'manual') {
    if (state.playbackState === PLAYBACK_STATES.SPEAKING) {
      // Stop current playback
      stopImmediate();
    }
    
    updateState({ 
      playbackState: PLAYBACK_STATES.SUSPENDED,
      suspendedReason: reason 
    });
  }

  // Stop all playback immediately
  async function stopImmediate() {
    try {
      if (isTTSAvailable()) {
        await window.TTSManager.stop();
      }
    } catch (error) {
      console.warn('[TTSController] Stop error:', error);
    }

    // Clear current request
    const currentRequest = state.currentRequest;
    if (currentRequest && currentRequest.onCancel) {
      currentRequest.onCancel('manual-stop');
    }

    updateState({ 
      playbackState: PLAYBACK_STATES.IDLE,
      currentRequest: null,
      requestQueue: []
    });

    triggerSessionHooks('playbackStopped', {
      reason: 'manual',
      previousRequest: currentRequest
    });
  }

  // Public API: Speak text with lifecycle management
  async function speak(text, options = {}) {
    const request = createRequest(text, options);
    
    if (!request.text) {
      return { success: false, error: 'empty-text' };
    }

    // Cancel current playback if this is a high priority request
    if (options.priority === PRIORITIES.HIGH || options.priority === PRIORITIES.CRITICAL) {
      if (state.playbackState === PLAYBACK_STATES.SPEAKING) {
        await stopImmediate();
      }
      // Clear queue for critical priority
      if (options.priority === PRIORITIES.CRITICAL) {
        state.requestQueue = [];
      }
    }

    // Add to queue
    if (enqueueRequest(request)) {
      // Start processing if idle
      if (state.playbackState === PLAYBACK_STATES.IDLE) {
        setTimeout(processQueue, 0);
      }
      return { success: true, requestId: request.id };
    }

    return { success: false, error: 'queue-failed' };
  }

  // Public API: Stop all playback
  async function stop(options = {}) {
    const reason = options.reason || 'manual';
    
    if (options.immediate) {
      return await stopImmediate();
    }

    // Clear queue
    state.requestQueue = [];
    
    // Stop current if speaking
    if (state.playbackState === PLAYBACK_STATES.SPEAKING) {
      return await stopImmediate();
    }

    updateState({ 
      playbackState: PLAYBACK_STATES.IDLE,
      currentRequest: null 
    });

    return { success: true };
  }

  // Public API: Cancel navigation-related speech
  async function cancelNavigationSpeech() {
    // Cancel any ongoing speech when navigating
    if (state.playbackState === PLAYBACK_STATES.SPEAKING) {
      await stopImmediate();
    }
    
    // Clear queued speech from non-critical sources
    state.requestQueue = state.requestQueue.filter(req => 
      req.priority === PRIORITIES.CRITICAL
    );
  }

  // Set active learning mode
  function setActiveMode(mode) {
    state.activeMode = mode;
    
    // Cancel speech when switching modes
    if (mode && mode !== state.activeMode) {
      cancelNavigationSpeech();
    }
  }

  // Event listeners for focus and modal detection
  function setupEventListeners() {
    // App focus/blur
    window.addEventListener('blur', () => {
      state.isAppFocused = false;
      if (state.playbackState === PLAYBACK_STATES.SPEAKING) {
        suspendPlayback('app-unfocused');
      }
    });

    window.addEventListener('focus', () => {
      state.isAppFocused = true;
      resumePlayback();
    });

    // Modal detection
    const modalObserver = new MutationObserver(() => {
      const wasModalVisible = state.isModalVisible;
      state.isModalVisible = isBlockingOverlayVisible();
      
      if (!wasModalVisible && state.isModalVisible) {
        // Modal just appeared
        if (state.playbackState === PLAYBACK_STATES.SPEAKING) {
          suspendPlayback('modal-visible');
        }
      } else if (wasModalVisible && !state.isModalVisible) {
        // Modal just disappeared
        resumePlayback();
      }
    });

    modalObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  // Initialize controller
  function init() {
    setupEventListeners();
    
    // Register default error handling hook
    registerSessionHook('error', (data) => {
      const { error, errorCount } = data;
      
      // Show user feedback for persistent errors
      if (errorCount >= 3) {
        if (window.Feedback) {
          window.Feedback.showWarning(
            '语音播报连续失败，请检查语音设置或稍后重试',
            5000
          );
        }
      }
    });

    console.log('[TTSController] Initialized');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose public API
  window.TTSController = Object.freeze({
    // Core methods
    speak,
    stop,
    cancelNavigationSpeech,
    setActiveMode,
    
    // State access
    getState: () => ({ ...state }),
    getPlaybackState: () => state.playbackState,
    isSpeaking: () => state.playbackState === PLAYBACK_STATES.SPEAKING,
    isSuspended: () => state.playbackState === PLAYBACK_STATES.SUSPENDED,
    
    // Hooks and configuration
    registerSessionHook,
    
    // Constants
    PLAYBACK_STATES,
    PRIORITIES
  });

})();