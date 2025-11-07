// TTS Controller Extensions Demo: Shows how to extend for spelling/dictation modes
(function() {
  'use strict';

  // This file demonstrates the extensibility of TTSController for future learning modes
  // It's not meant to be used in production but shows integration patterns

  // Example: Spelling Mode Integration
  function createSpellingModeController() {
    // Register session hooks for spelling-specific behavior
    if (window.TTSController && window.TTSController.registerSessionHook) {
      
      // Hook for handling spelling errors
      window.TTSController.registerSessionHook('requestCompleted', (data) => {
        const { request, result } = data;
        if (request.source && request.source.startsWith('spelling-')) {
          console.log(`[SpellingMode] Completed spelling TTS: ${request.text}`);
          // Could trigger spelling validation, UI updates, etc.
        }
      });

      // Hook for handling spelling errors
      window.TTSController.registerSessionHook('error', (data) => {
        const { error, request } = data;
        if (request && request.source && request.source.startsWith('spelling-')) {
          console.warn(`[SpellingMode] TTS error for spelling:`, error);
          // Could show spelling-specific error UI, retry logic, etc.
        }
      });
    }

    return {
      // Speak a word for spelling practice with high priority
      speakForSpelling(word, options = {}) {
        if (!word || !window.TTSController) return;

        return window.TTSController.speak(word, {
          source: 'spelling-practice',
          priority: window.TTSController.PRIORITIES.HIGH,
          onSuccess: () => {
            console.log(`[SpellingMode] Started spelling practice for: ${word}`);
            // Could start spelling timer, show input field, etc.
          },
          onError: (error) => {
            console.error(`[SpellingMode] Failed to speak for spelling:`, error);
            // Could show error message, fallback to visual cue, etc.
          },
          ...options
        });
      },

      // Speak a sentence for dictation with normal priority
      speakForDictation(sentence, options = {}) {
        if (!sentence || !window.TTSController) return;

        return window.TTSController.speak(sentence, {
          source: 'dictation-practice',
          priority: window.TTSController.PRIORITIES.NORMAL,
          onSuccess: () => {
            console.log(`[DictationMode] Started dictation for: ${sentence}`);
            // Could show dictation input, start recording, etc.
          },
          onComplete: () => {
            console.log(`[DictationMode] Finished dictation: ${sentence}`);
            // Could trigger validation, show results, etc.
          },
          ...options
        });
      },

      // Cancel all spelling/dictation speech
      cancelSpellingSpeech() {
        if (window.TTSController) {
          return window.TTSController.cancelNavigationSpeech();
        }
      }
    };
  }

  // Example: Sentence Queue Management for Dictation
  function createSentenceQueueManager() {
    let sentenceQueue = [];
    let currentIndex = 0;

    return {
      // Add sentences to queue
      enqueueSentences(sentences) {
        sentenceQueue = Array.isArray(sentences) ? sentences.slice() : [];
        currentIndex = 0;
        console.log(`[SentenceQueue] Enqueued ${sentenceQueue.length} sentences`);
      },

      // Speak next sentence in queue
      speakNext() {
        if (currentIndex >= sentenceQueue.length) {
          console.log('[SentenceQueue] No more sentences in queue');
          return { success: false, error: 'queue-empty' };
        }

        const sentence = sentenceQueue[currentIndex];
        currentIndex++;

        if (window.TTSController) {
          return window.TTSController.speak(sentence, {
            source: 'dictation-queue',
            priority: window.TTSController.PRIORITIES.NORMAL,
            onSuccess: () => {
              console.log(`[SentenceQueue] Speaking sentence ${currentIndex}/${sentenceQueue.length}`);
            },
            onComplete: () => {
              // Auto-advance to next sentence after completion
              setTimeout(() => {
                if (currentIndex < sentenceQueue.length) {
                  this.speakNext();
                } else {
                  console.log('[SentenceQueue] Completed all sentences');
                }
              }, 1000);
            }
          });
        }

        return { success: false, error: 'tts-unavailable' };
      },

      // Reset queue
      reset() {
        sentenceQueue = [];
        currentIndex = 0;
        console.log('[SentenceQueue] Reset queue');
      },

      // Get queue status
      getStatus() {
        return {
          total: sentenceQueue.length,
          current: currentIndex,
          remaining: Math.max(0, sentenceQueue.length - currentIndex)
        };
      }
    };
  }

  // Demo: Initialize extensions when TTSController is available
  function initExtensions() {
    if (!window.TTSController) {
      console.warn('[TTSExtensions] TTSController not available');
      return;
    }

    // Create and expose extension APIs
    window.SpellingMode = createSpellingModeController();
    window.SentenceQueue = createSentenceQueueManager();

    console.log('[TTSExtensions] Initialized spelling and dictation extensions');
    
    // Demo: Register a global session hook for all TTS activity
    window.TTSController.registerSessionHook('stateChange', (data) => {
      const { from, to, request } = data;
      console.log(`[TTSExtensions] State change: ${from} -> ${to}`, request ? `(${request.text.substring(0, 20)}...)` : '');
    });

    // Demo: Show error handling integration
    window.TTSController.registerSessionHook('error', (data) => {
      const { error, errorCount } = data;
      if (errorCount >= 5) {
        console.warn('[TTSExtensions] High error count detected, suggesting fallback');
        // Could suggest visual-only mode, different TTS engine, etc.
      }
    });
  }

  // Initialize when DOM is ready and TTSController is available
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Wait a bit for TTSController to initialize
      setTimeout(initExtensions, 100);
    });
  } else {
    setTimeout(initExtensions, 100);
  }

  // Expose demo functions for testing
  window.TTSExtensionsDemo = {
    initExtensions,
    createSpellingModeController,
    createSentenceQueueManager
  };

})();