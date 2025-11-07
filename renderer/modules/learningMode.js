// Learning Mode Controller: manages deck selection, review sessions, and metrics
(function(){
    'use strict';

    const LEARNING_MODES = Object.freeze({
        ALL: 'all',
        FAVORITES: 'favorites', 
        MASTERY: 'mastery',
        TAGS: 'tags'
    });

    let currentMode = null;
    let sessionActive = false;
    let sessionMetrics = null;
    let learningHistory = [];

    // Initialize learning history from persistence
    function initializeLearningHistory() {
        try {
            const stateRes = window.PersistenceService?.getState();
            if (stateRes && stateRes.success && stateRes.data.sessionHistory) {
                learningHistory = Array.isArray(stateRes.data.sessionHistory.learning) 
                    ? stateRes.data.sessionHistory.learning 
                    : [];
            }
        } catch (e) {
            console.warn('Failed to load learning history:', e);
            learningHistory = [];
        }
    }

    // Save learning history to persistence
    function saveLearningHistory() {
        try {
            const result = window.PersistenceService?.updateSessionHistory({
                learning: learningHistory
            });
            if (result && !result.success) {
                console.warn('Failed to save learning history:', result.error);
            }
        } catch (e) {
            console.warn('Failed to save learning history:', e);
        }
    }

    // Get available words based on mode
    function getWordsForMode(mode, options = {}) {
        try {
            const stateRes = window.PersistenceService?.getState();
            const allWords = stateRes && stateRes.success && Array.isArray(stateRes.data?.words) 
                ? stateRes.data.words 
                : [];

            if (!allWords.length) {
                return { success: false, error: '没有可用的单词数据' };
            }

            let filteredWords = [];

            switch (mode) {
                case LEARNING_MODES.ALL:
                    filteredWords = allWords.slice();
                    break;

                case LEARNING_MODES.FAVORITES:
                    filteredWords = allWords.filter(word => Boolean(word.favorite));
                    break;

                case LEARNING_MODES.MASTERY:
                    const minLevel = options.masteryMin !== undefined ? options.masteryMin : 0;
                    const maxLevel = options.masteryMax !== undefined ? options.masteryMax : 3;
                    filteredWords = allWords.filter(word => {
                        const mastery = Number(word.mastery) || 0;
                        return mastery >= minLevel && mastery <= maxLevel;
                    });
                    break;

                case LEARNING_MODES.TAGS:
                    const selectedTags = options.tags || [];
                    if (selectedTags.length === 0) {
                        return { success: false, error: '请选择至少一个标签' };
                    }
                    filteredWords = allWords.filter(word => {
                        const wordTags = Array.isArray(word.tags) ? word.tags : [];
                        return selectedTags.some(tag => wordTags.includes(tag));
                    });
                    break;

                default:
                    return { success: false, error: '不支持的学习模式' };
            }

            if (filteredWords.length === 0) {
                return { success: false, error: '没有符合条件的学习内容' };
            }

            return { success: true, words: filteredWords };
        } catch (e) {
            return { success: false, error: `获取单词失败: ${e.message}` };
        }
    }

    // Start a learning session
    function startSession(mode, options = {}) {
        if (sessionActive) {
            return { success: false, error: '已有学习会话进行中' };
        }

        const wordsResult = getWordsForMode(mode, options);
        if (!wordsResult.success) {
            return wordsResult;
        }

        currentMode = mode;
        sessionActive = true;
        sessionMetrics = {
            startTime: new Date().toISOString(),
            mode: mode,
            options: options,
            totalCards: wordsResult.words.length,
            cardsReviewed: 0,
            autoRead: options.autoRead || false,
            completedAt: null
        };

        // Initialize flashcard with the filtered words
        try {
            if (window.Flashcard && window.Flashcard.loadDeck) {
                window.Flashcard.loadDeck(wordsResult.words, {
                    ...options,
                    sessionMode: true,
                    onCardAdvance: handleCardAdvance,
                    onSessionEnd: handleSessionEnd
                });
            }

            // Switch to flashcard screen
            if (window.switchScreen) {
                window.switchScreen('flashcardScreen');
            }

            return { success: true, session: sessionMetrics };
        } catch (e) {
            sessionActive = false;
            currentMode = null;
            sessionMetrics = null;
            return { success: false, error: `启动学习会话失败: ${e.message}` };
        }
    }

    // Handle card advancement during session
    function handleCardAdvance(cardData) {
        if (!sessionActive || !sessionMetrics) return;

        sessionMetrics.cardsReviewed++;
        
        // Update progress in UI
        updateSessionProgress();
    }

    // Handle session completion
    function handleSessionEnd() {
        if (!sessionActive || !sessionMetrics) return;

        sessionMetrics.completedAt = new Date().toISOString();
        sessionMetrics.duration = new Date(sessionMetrics.completedAt) - new Date(sessionMetrics.startTime);

        // Add to learning history
        learningHistory.unshift({
            ...sessionMetrics,
            id: Date.now().toString()
        });

        // Keep only last 50 sessions
        if (learningHistory.length > 50) {
            learningHistory = learningHistory.slice(0, 50);
        }

        // Save to persistence
        saveLearningHistory();

        // Reset session state
        sessionActive = false;
        currentMode = null;
        const completedSession = sessionMetrics;
        sessionMetrics = null;

        // Show completion message
        if (window.Feedback) {
            window.Feedback.showSuccess(
                `学习会话完成！\n复习卡片: ${completedSession.cardsReviewed}/${completedSession.totalCards}\n用时: ${Math.round(completedSession.duration / 1000)}秒`
            );
        }
    }

    // Update session progress display
    function updateSessionProgress() {
        if (!sessionMetrics) return;

        const progressEl = document.getElementById('fcLearningProgress');
        if (progressEl) {
            const percentage = Math.round((sessionMetrics.cardsReviewed / sessionMetrics.totalCards) * 100);
            progressEl.textContent = `学习进度: ${sessionMetrics.cardsReviewed}/${sessionMetrics.totalCards} (${percentage}%)`;
        }
    }

    // Get current session metrics
    function getCurrentSession() {
        return sessionActive ? { ...sessionMetrics } : null;
    }

    // Get learning history
    function getLearningHistory(limit = 10) {
        return learningHistory.slice(0, limit);
    }

    // Exit current session
    function exitSession() {
        if (!sessionActive) return { success: true };

        try {
            handleSessionEnd();
            
            // Return to start screen
            if (window.switchScreen) {
                window.switchScreen('startScreen');
            }

            return { success: true };
        } catch (e) {
            return { success: false, error: `退出学习会话失败: ${e.message}` };
        }
    }

    // Show tag selection dialog
    function showTagSelectionDialog(callback) {
        try {
            const stateRes = window.PersistenceService?.getState();
            const allWords = stateRes && stateRes.success && Array.isArray(stateRes.data?.words) 
                ? stateRes.data.words 
                : [];

            // Extract all unique tags
            const allTags = new Set();
            allWords.forEach(word => {
                if (Array.isArray(word.tags)) {
                    word.tags.forEach(tag => allTags.add(tag));
                }
            });

            if (allTags.size === 0) {
                if (window.Feedback) {
                    window.Feedback.showToast('当前单词没有标签', 'info', 3000);
                }
                return;
            }

            // Create modal
            const modal = document.createElement('div');
            modal.id = 'tagSelectionModal';
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>选择标签</h3>
                    <div class="tag-selection-list">
                        ${Array.from(allTags).map(tag => `
                            <label class="tag-checkbox">
                                <input type="checkbox" value="${tag}">
                                <span>${tag}</span>
                            </label>
                        `).join('')}
                    </div>
                    <div class="modal-buttons">
                        <button id="confirmTagSelectionBtn" class="btn-primary">确认</button>
                        <button id="cancelTagSelectionBtn" class="btn-secondary">取消</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const cleanup = () => { modal.remove(); };

            document.getElementById('confirmTagSelectionBtn')?.addEventListener('click', () => {
                const selectedTags = Array.from(modal.querySelectorAll('input[type="checkbox"]:checked'))
                    .map(cb => cb.value);
                cleanup();
                if (callback) callback(selectedTags);
            });

            document.getElementById('cancelTagSelectionBtn')?.addEventListener('click', cleanup);
        } catch (e) {
            console.error('Failed to show tag selection dialog:', e);
        }
    }

    // Show mastery range dialog
    function showMasteryRangeDialog(callback) {
        const modal = document.createElement('div');
        modal.id = 'masteryRangeModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>选择掌握度范围</h3>
                <div class="mastery-range-selector">
                    <div class="range-row">
                        <label>最低掌握度:</label>
                        <select id="masteryMinSelect">
                            <option value="0">M0 (未掌握)</option>
                            <option value="1">M1 (初步掌握)</option>
                            <option value="2">M2 (基本掌握)</option>
                            <option value="3">M3 (完全掌握)</option>
                        </select>
                    </div>
                    <div class="range-row">
                        <label>最高掌握度:</label>
                        <select id="masteryMaxSelect">
                            <option value="0">M0 (未掌握)</option>
                            <option value="1">M1 (初步掌握)</option>
                            <option value="2">M2 (基本掌握)</option>
                            <option value="3" selected>M3 (完全掌握)</option>
                        </select>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button id="confirmMasteryRangeBtn" class="btn-primary">确认</button>
                    <button id="cancelMasteryRangeBtn" class="btn-secondary">取消</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const cleanup = () => { modal.remove(); };

        document.getElementById('confirmMasteryRangeBtn')?.addEventListener('click', () => {
            const minLevel = parseInt(document.getElementById('masteryMinSelect').value);
            const maxLevel = parseInt(document.getElementById('masteryMaxSelect').value);
            cleanup();
            if (callback) callback({ masteryMin: minLevel, masteryMax: maxLevel });
        });

        document.getElementById('cancelMasteryRangeBtn')?.addEventListener('click', cleanup);
    }

    // Initialize on load
    function initialize() {
        initializeLearningHistory();
    }

    // Expose API
    window.LearningMode = Object.freeze({
        LEARNING_MODES,
        startSession,
        exitSession,
        getCurrentSession,
        getLearningHistory,
        showTagSelectionDialog,
        showMasteryRangeDialog,
        initialize
    });

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();