// 全局状态
const bgMusic = document.getElementById('bgMusic');

const AUDIO_DEFAULTS = Object.freeze({
    musicEnabled: true,
    volume: 1,
    playMode: 'loop'
});

const AUDIO_PLAY_MODES = Object.freeze({
    LOOP: 'loop',
    ONCE: 'once'
});

// 抽取模式
const DRAW_MODES = Object.freeze({
    RANDOM: 'random',
    FAIR: 'fair'
});
let currentDrawMode = DRAW_MODES.RANDOM;

let students = [];
let availableStudents = [];
let words = [];
let availableWords = [];
let selectedStudent = null;
let selectedWord = null;
let rollingInterval = null;
let excludedStudentsSet = new Set();

const audioState = {
    musicEnabled: AUDIO_DEFAULTS.musicEnabled,
    volume: AUDIO_DEFAULTS.volume,
    playMode: AUDIO_DEFAULTS.playMode
};

// 工具函数
function clamp(value, min, max) {
    return Math.min(Math.max(Number(value), min), max);
}

function getMusicButton() {
    return document.getElementById('musicBtn');
}

function getVolumeSlider() {
    return document.getElementById('volumeSlider');
}

function getPlayModeSelect() {
    return document.getElementById('playModeSelect');
}

function getDrawModeSelect() {
    return document.getElementById('drawModeSelect');
}

function getModeIndicator() {
    return document.getElementById('modeIndicator');
}

function persistSettings(partial) {
    if (!window.PersistenceService) {
        console.warn('PersistenceService 不可用，无法保存设置');
        return;
    }
    const result = window.PersistenceService.updateSettings(partial);
    if (!result.success) {
        console.warn('保存设置失败:', result.error);
    }
}

function setStudents(list) {
    students = Array.isArray(list) ? Array.from(list) : [];
    // 加载持久化的排除集合，并与当前学生名单对齐
    try {
        const state = window.PersistenceService?.getState();
        const excluded = state && state.success && Array.isArray(state.data?.excludedStudents)
            ? state.data.excludedStudents
            : [];
        // 仅保留仍在当前学生名单中的条目
        excludedStudentsSet = new Set(excluded.filter((name) => students.includes(name)));
    } catch (e) {
        excludedStudentsSet = new Set();
    }
    availableStudents = students.filter((name) => !excludedStudentsSet.has(name));
    ensureStudentStatsDefaults();
}

function ensureStudentStatsDefaults() {
    if (!window.PersistenceService || !Array.isArray(students)) return;
    try {
        const state = window.PersistenceService.getState();
        if (!state.success) return;
        const stats = state.data.studentStats || {};
        let changed = false;
        const next = { ...stats };
        students.forEach((name) => {
            if (!next[name] || typeof next[name] !== 'object') {
                next[name] = { drawCount: 0, lastDrawnAt: null, lastDrawMode: null };
                changed = true;
            } else {
                // 补全缺失字段
                if (typeof next[name].drawCount !== 'number') { next[name].drawCount = 0; changed = true; }
                if (!('lastDrawnAt' in next[name])) { next[name].lastDrawnAt = null; changed = true; }
                if (!('lastDrawMode' in next[name])) { next[name].lastDrawMode = null; changed = true; }
            }
        });
        if (changed) {
            window.PersistenceService.updatePartial({ studentStats: next });
        }
    } catch (e) {
        console.warn('初始化学生统计字段失败:', e);
    }
}

function updateStudentStatsAfterPick(name, mode) {
    if (!name || !window.PersistenceService) return;
    try {
        const state = window.PersistenceService.getState();
        if (!state.success) return;
        const stats = state.data.studentStats || {};
        const prev = stats[name] || { drawCount: 0, lastDrawnAt: null, lastDrawMode: null };
        const next = {
            ...stats,
            [name]: {
                drawCount: (typeof prev.drawCount === 'number' ? prev.drawCount : 0) + 1,
                lastDrawnAt: new Date().toISOString(),
                lastDrawMode: mode || null
            }
        };
        window.PersistenceService.updatePartial({ studentStats: next });
    } catch (e) {
        console.warn('更新学生统计失败:', e);
    }
}

// 更新排除集合并持久化
function updateExcludedAfterPick(name) {
    if (!name) return;
    try {
        const state = window.PersistenceService?.getState();
        const current = state && state.success && Array.isArray(state.data?.excludedStudents)
            ? state.data.excludedStudents.slice()
            : [];
        if (!current.includes(name)) {
            current.push(name);
            window.PersistenceService?.updatePartial({ excludedStudents: current });
        }
        // 与当前学生名单对齐
        excludedStudentsSet = new Set(current.filter((n) => students.includes(n)));
    } catch (e) {
        // 忽略
    }
}

// 清空排除集合（不影响统计）
function resetExcludedStudents({ silent = false } = {}) {
    try {
        window.PersistenceService?.updatePartial({ excludedStudents: [] });
    } catch (e) {
        // 忽略
    }
    excludedStudentsSet = new Set();
    availableStudents = students.slice();
    if (!silent) {
        window.Feedback?.showSuccess('已重置当前轮的排除列表');
    }
}

function setWords(list) {
    words = Array.isArray(list) ? Array.from(list) : [];
    availableWords = [...words];
}

function hydrateStateFromStore() {
    const restored = {
        hasStudents: false,
        hasWords: false,
        hasSettings: false
    };

    if (!window.PersistenceService) {
        return restored;
    }

    try {
        const result = window.PersistenceService.getState();
        if (result.success && result.data) {
            const data = result.data;

            setStudents(Array.isArray(data.students) ? data.students : []);
            setWords(Array.isArray(data.words) ? data.words : []);

            restored.hasStudents = students.length > 0;
            restored.hasWords = words.length > 0;

            const settings = data.settings || {};
            audioState.musicEnabled = typeof settings.musicEnabled === 'boolean' ? settings.musicEnabled : AUDIO_DEFAULTS.musicEnabled;
            audioState.volume = typeof settings.volume === 'number' ? clamp(settings.volume, 0, 1) : AUDIO_DEFAULTS.volume;
            audioState.playMode = settings.playMode || AUDIO_DEFAULTS.playMode;
            currentDrawMode = (settings.drawMode === DRAW_MODES.FAIR || settings.drawMode === DRAW_MODES.RANDOM) ? settings.drawMode : DRAW_MODES.RANDOM;
            restored.hasSettings = true;
        }
    } catch (error) {
        console.error('读取持久化数据失败:', error);
    }

    return restored;
}

function updateMusicButton(enabled) {
    const musicBtn = getMusicButton();
    if (!musicBtn) return;

    musicBtn.textContent = enabled ? '🔊' : '🔇';
    musicBtn.classList.toggle('muted', !enabled);
}

function setMusicEnabled(enabled, options = {}) {
    const { persist = true, silent = false } = options;
    audioState.musicEnabled = Boolean(enabled);

    if (audioState.musicEnabled) {
        bgMusic.loop = audioState.playMode === AUDIO_PLAY_MODES.LOOP;
        bgMusic.volume = audioState.volume;
        bgMusic.play()
            .then(() => {
                updateMusicButton(true);
                if (persist) {
                    persistSettings({ musicEnabled: true });
                }
            })
            .catch((error) => {
                console.warn('音乐播放失败，可能需要用户交互:', error);
                audioState.musicEnabled = false;
                bgMusic.pause();
                updateMusicButton(false);
                if (persist) {
                    persistSettings({ musicEnabled: false });
                }
                if (!silent && window.Feedback) {
                    window.Feedback.showToast(
                        '音乐播放失败，请点击任意按钮后再试',
                        window.Feedback.TOAST_TYPES.INFO,
                        4000
                    );
                }
            });
    } else {
        bgMusic.pause();
        updateMusicButton(false);
        if (persist) {
            persistSettings({ musicEnabled: false });
        }
    }
}

function updateVolume(value, options = {}) {
    const { persist = true } = options;
    const volume = clamp(value, 0, 1);
    audioState.volume = volume;
    bgMusic.volume = volume;

    const slider = getVolumeSlider();
    if (slider) {
        slider.value = volume;
    }

    if (persist) {
        persistSettings({ volume });
    }
}

function updatePlayMode(mode, options = {}) {
    const { persist = true } = options;
    const values = Object.values(AUDIO_PLAY_MODES);
    const nextMode = values.includes(mode) ? mode : AUDIO_DEFAULTS.playMode;

    audioState.playMode = nextMode;
    bgMusic.loop = nextMode === AUDIO_PLAY_MODES.LOOP;

    const select = getPlayModeSelect();
    if (select) {
        select.value = nextMode;
    }

    if (persist) {
        persistSettings({ playMode: nextMode });
    }
}

function updateDrawMode(mode, options = {}) {
    const { persist = true } = options;
    const values = Object.values(DRAW_MODES);
    const nextMode = values.includes(mode) ? mode : DRAW_MODES.RANDOM;
    currentDrawMode = nextMode;

    const select = getDrawModeSelect();
    if (select) {
        select.value = nextMode;
    }
    const indicator = getModeIndicator();
    if (indicator) {
        indicator.textContent = nextMode === DRAW_MODES.FAIR ? '公平模式' : '完全随机';
    }

    if (persist) {
        persistSettings({ drawMode: nextMode });
    }
}

function bindAudioControls() {
    const slider = getVolumeSlider();
    if (slider) {
        slider.addEventListener('input', (event) => {
            updateVolume(event.target.value);
        });
    }

    const select = getPlayModeSelect();
    if (select) {
        select.addEventListener('change', (event) => {
            updatePlayMode(event.target.value);
        });
    }

    const drawSelect = getDrawModeSelect();
    if (drawSelect) {
        drawSelect.addEventListener('change', (event) => {
            updateDrawMode(event.target.value);
        });
    }
}

function initializeAudio() {
    updateVolume(audioState.volume, { persist: false });
    updatePlayMode(audioState.playMode, { persist: false });
    updateMusicButton(audioState.musicEnabled);

    if (audioState.musicEnabled) {
        setMusicEnabled(true, { persist: false, silent: true });
    } else {
        bgMusic.pause();
    }
}

function showFileUploadPrompt() {
    if (document.getElementById('filePrompt')) {
        return;
    }

    const promptDiv = document.createElement('div');
    promptDiv.id = 'filePrompt';
    promptDiv.className = 'file-upload-prompt';
    promptDiv.innerHTML = `
        <h3 class="prompt-title">请上传 Excel 文件</h3>
        <p class="prompt-subtitle">成功导入后会自动保存，重启应用仍可继续使用</p>
        <div class="prompt-field">
            <label>1. 学生名单 Excel：</label>
            <input type="file" id="studentsFileInput" accept=".xlsx,.xls">
            <small>格式：第一列为“姓名”，第一行为表头</small>
        </div>
        <div class="prompt-field">
            <label>2. 单词列表 Excel：</label>
            <input type="file" id="wordsFileInput" accept=".xlsx,.xls">
            <small>格式：第一列为“单词”，第一行为表头</small>
        </div>
        <div class="prompt-actions">
            <button id="loadExcelBtn" class="btn-primary">确定</button>
            <button id="useTestDataBtn" class="btn-secondary">使用测试数据</button>
        </div>
    `;

    document.body.appendChild(promptDiv);

    document.getElementById('loadExcelBtn').addEventListener('click', loadBothExcelFiles);
    document.getElementById('useTestDataBtn').addEventListener('click', useTestData);
}

async function loadBothExcelFiles() {
    const loadButton = document.getElementById('loadExcelBtn');
    if (loadButton) {
        loadButton.disabled = true;
        loadButton.classList.add('loading');
        loadButton.textContent = '导入中...';
    }

    const studentsFile = document.getElementById('studentsFileInput')?.files[0];
    const wordsFile = document.getElementById('wordsFileInput')?.files[0];

    const resetButtonState = () => {
        if (loadButton) {
            loadButton.disabled = false;
            loadButton.classList.remove('loading');
            loadButton.textContent = '确定';
        }
    };

    if (!studentsFile || !wordsFile) {
        resetButtonState();
        if (window.Feedback) {
            window.Feedback.showError('请同时选择学生名单和单词列表两个 Excel 文件');
        } else {
            alert('请选择学生名单和单词列表两个 Excel 文件！');
        }
        return;
    }

    if (!window.DataImporter) {
        resetButtonState();
        const message = '数据导入模块未加载，请重试';
        if (window.Feedback) {
            window.Feedback.showError(message);
        } else {
            alert(message);
        }
        return;
    }

    try {
        const results = await window.DataImporter.importBothFiles(studentsFile, wordsFile);

        if (results.success) {
            if (results.students?.success) {
                setStudents(results.students.data);
            }
            if (results.words?.success) {
                setWords(results.words.data);
            }

            const prompt = document.getElementById('filePrompt');
            if (prompt) {
                prompt.remove();
            }

            if (window.Feedback) {
                window.Feedback.showSuccess(
                    `✅ 数据已自动保存！\n学生: ${students.length} 名\n单词: ${words.length} 个`
                );
            } else {
                alert(`成功加载并保存！\n学生: ${students.length} 名\n单词: ${words.length} 个`);
            }

            console.log('成功导入并保存数据:', {
                students: students.length,
                words: words.length
            });
        } else {
            const errorMsg = results.errors?.length ? results.errors.join('\n') : '导入失败';
            if (window.Feedback) {
                window.Feedback.showError(`❌ 导入失败：\n${errorMsg}`);
            } else {
                alert(`导入失败：\n${errorMsg}`);
            }
        }
    } catch (error) {
        console.error('导入异常:', error);
        if (window.Feedback) {
            window.Feedback.showError(`❌ 导入异常：${error.message}`);
        } else {
            alert(`导入异常：${error.message}`);
        }
    } finally {
        resetButtonState();
    }
}

async function useTestData() {
    const testStudents = ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十'];
    const testWords = ['apple', 'banana', 'cat', 'dog', 'elephant', 'fish', 'grape', 'house', 'ice', 'juice'];

    if (!window.DataImporter) {
        setStudents(testStudents);
        setWords(testWords);
        const prompt = document.getElementById('filePrompt');
        if (prompt) {
            prompt.remove();
        }
        alert('已加载测试数据\n学生: 8名\n单词: 10个');
        return;
    }

    try {
        const [studentsResult, wordsResult] = await Promise.all([
            window.DataImporter.importTestData(testStudents, window.DataImporter.DATA_TYPES.STUDENTS),
            window.DataImporter.importTestData(testWords, window.DataImporter.DATA_TYPES.WORDS)
        ]);

        if (studentsResult.success && wordsResult.success) {
            setStudents(testStudents);
            setWords(testWords);

            const prompt = document.getElementById('filePrompt');
            if (prompt) {
                prompt.remove();
            }

            if (window.Feedback) {
                window.Feedback.showSuccess('✅ 测试数据已自动保存！\n学生: 8名\n单词: 10个');
            } else {
                alert('已加载测试数据并保存\n学生: 8名\n单词: 10个');
            }

            console.log('成功导入测试数据');
        } else {
            throw new Error('保存测试数据失败');
        }
    } catch (error) {
        console.error('导入测试数据异常:', error);
        if (window.Feedback) {
            window.Feedback.showError(`❌ 导入测试数据失败：${error.message}`);
        } else {
            alert(`导入测试数据失败：${error.message}`);
        }
    }
}

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach((screen) => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function startDrawing() {
    if (availableStudents.length === 0) {
        window.Feedback?.showToast('本轮所有学生已被抽到，点击“重新开始本轮”即可继续', window.Feedback.TOAST_TYPES.INFO, 5000);
        showResetRoundDialog();
        return;
    }

    switchScreen('drawingScreen');

    const rollingNameEl = document.getElementById('rollingName');
    let currentIndex = 0;

    rollingInterval = setInterval(() => {
        currentIndex = Math.floor(Math.random() * availableStudents.length);
        rollingNameEl.textContent = availableStudents[currentIndex];
    }, 100);

    setTimeout(() => {
        clearInterval(rollingInterval);

        let pickIndex = 0;
        let pickValue = null;
        try {
            const state = window.PersistenceService?.getState();
            const stats = state && state.success ? (state.data.studentStats || {}) : {};
            if (window.DrawStrategy) {
                const picked = window.DrawStrategy.pickStudent(availableStudents, { mode: currentDrawMode, stats });
                pickIndex = picked.index;
                pickValue = picked.value;
            } else {
                pickIndex = Math.floor(Math.random() * availableStudents.length);
                pickValue = availableStudents[pickIndex];
            }
        } catch (e) {
            console.warn('抽取策略失败，退化为随机:', e);
            pickIndex = Math.floor(Math.random() * availableStudents.length);
            pickValue = availableStudents[pickIndex];
        }

        selectedStudent = pickValue;
        availableStudents.splice(pickIndex, 1);
        updateExcludedAfterPick(selectedStudent);

        document.getElementById('selectedName').textContent = selectedStudent;
        updateDrawMode(currentDrawMode, { persist: false }); // 刷新模式指示
        updateStudentStatsAfterPick(selectedStudent, currentDrawMode);
        if (availableStudents.length === 0) {
            window.Feedback?.showToast('🎉 本轮所有学生已抽完！可选择“重新开始本轮”继续', window.Feedback.TOAST_TYPES.INFO, 4500);
        }
        switchScreen('resultScreen');
    }, 2000);
}

function showWordInput() {
    if (availableWords.length === 0) {
        if (window.Feedback) {
            window.Feedback.showError('所有单词都已被抽取，已无可抽取的单词');
        } else {
            alert('所有单词都已被抽取！');
        }
        return;
    }

    const randomIndex = Math.floor(Math.random() * availableWords.length);
    selectedWord = availableWords[randomIndex];
    availableWords.splice(randomIndex, 1);

    displayWord(selectedWord);
    // 记录并持久化本次抽取
    persistCurrentDrawEvent();
}

function displayWord(word) {
    const wordGrid = document.getElementById('wordGrid');
    wordGrid.innerHTML = '';

    const wordItem = document.createElement('div');
    wordItem.className = 'word-item';
    wordItem.textContent = word;
    wordGrid.appendChild(wordItem);

    switchScreen('wordScreen');
}

// 公平模式指标快照
function createFairnessSnapshot() {
    return {
        mode: currentDrawMode || DRAW_MODES.RANDOM,
        remainingStudents: Array.isArray(availableStudents) ? availableStudents.length : 0,
        remainingWords: Array.isArray(availableWords) ? availableWords.length : 0
    };
}

// 持久化当前抽取事件
function persistCurrentDrawEvent() {
    if (!window.PersistenceService) return;
    try {
        const entry = {
            student: selectedStudent || null,
            word: selectedWord || null,
            fairness: createFairnessSnapshot()
        };
        const result = window.PersistenceService.addSessionHistory(entry);
        if (!result.success) {
            console.warn('保存抽取历史失败:', result.error);
        } else {
            try { window.HistoryPanel && window.HistoryPanel.refresh && window.HistoryPanel.refresh(); } catch (e) {}
        }
    } catch (e) {
        console.warn('保存抽取历史异常:', e);
    }
}

function resetToStart() {
    switchScreen('startScreen');
    selectedStudent = null;
    selectedWord = null;
    if (availableStudents.length === 0) {
        window.Feedback?.showToast('本轮所有学生已抽完，是否重新开始本轮？', window.Feedback.TOAST_TYPES.INFO, 4500);
        showResetRoundDialog();
    }
}

function toggleMusic() {
    setMusicEnabled(!audioState.musicEnabled);
}

// 清空历史确认弹窗
function showClearHistoryDialog() {
    if (document.getElementById('clearHistoryModal')) return;

    const modal = document.createElement('div');
    modal.id = 'clearHistoryModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>清空历史</h3>
            <p>请选择清空范围：</p>
            <div class="modal-buttons">
                <button id="clearCurrentSessionBtn" class="btn-secondary">清空当前会话</button>
                <button id="clearAllHistoryBtn" class="btn-back">清空全部历史</button>
                <button id="cancelClearHistoryBtn" class="btn-primary">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const cleanup = () => {
        modal.remove();
    };

    document.getElementById('clearCurrentSessionBtn')?.addEventListener('click', () => {
        try {
            const result = window.PersistenceService?.clearHistory({ scope: 'current' });
            if (result && result.success) {
                window.Feedback?.showSuccess('已清空当前会话历史');
                try { window.HistoryPanel && window.HistoryPanel.refresh && window.HistoryPanel.refresh(); } catch (e) {}
            } else if (result && !result.success) {
                window.Feedback?.showError(`清空失败：${result.error || '未知错误'}`);
            }
        } catch (e) {
            window.Feedback?.showError(`清空失败：${e.message}`);
        } finally {
            cleanup();
        }
    });

    document.getElementById('clearAllHistoryBtn')?.addEventListener('click', () => {
        try {
            const result = window.PersistenceService?.clearHistory({ scope: 'all' });
            if (result && result.success) {
                window.Feedback?.showSuccess('已清空全部历史');
                try { window.HistoryPanel && window.HistoryPanel.refresh && window.HistoryPanel.refresh(); } catch (e) {}
            } else if (result && !result.success) {
                window.Feedback?.showError(`清空失败：${result.error || '未知错误'}`);
            }
        } catch (e) {
            window.Feedback?.showError(`清空失败：${e.message}`);
        } finally {
            cleanup();
        }
    });

    document.getElementById('cancelClearHistoryBtn')?.addEventListener('click', cleanup);
}

// 抽完所有学生后的自动提示模态
function showResetRoundDialog() {
    if (document.getElementById('resetRoundModal')) return;
    const modal = document.createElement('div');
    modal.id = 'resetRoundModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>重新开始本轮</h3>
            <p>已抽到所有学生。是否清空本轮排除列表并重新开始？（不影响统计）</p>
            <div class="modal-buttons">
                <button id="confirmResetRoundBtn" class="btn-secondary">重新开始本轮</button>
                <button id="cancelResetRoundBtn" class="btn-primary">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const cleanup = () => { modal.remove(); };
    document.getElementById('confirmResetRoundBtn')?.addEventListener('click', () => {
        resetExcludedStudents({ silent: true });
        window.Feedback?.showSuccess('已重新开始本轮');
        cleanup();
    });
    document.getElementById('cancelResetRoundBtn')?.addEventListener('click', cleanup);
}

// 设置面板：手动重置排除列表
function showResetExclusionDialog() {
    if (document.getElementById('resetExcludedModal')) return;
    const modal = document.createElement('div');
    modal.id = 'resetExcludedModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>手动重置排除列表</h3>
            <p>确定要清空本轮“已抽学生”的排除列表吗？（不会影响统计）</p>
            <div class="modal-buttons">
                <button id="confirmResetExcludedBtn" class="btn-back">确认重置</button>
                <button id="cancelResetExcludedBtn" class="btn-primary">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const cleanup = () => { modal.remove(); };
    document.getElementById('confirmResetExcludedBtn')?.addEventListener('click', () => {
        resetExcludedStudents({ silent: true });
        window.Feedback?.showSuccess('已清空本轮排除列表');
        cleanup();
    });
    document.getElementById('cancelResetExcludedBtn')?.addEventListener('click', cleanup);
}

// 仅重置“统计”到初始状态（对当前学生名单），不动名单与历史
function resetAllStats({ silent = false } = {}) {
    try {
        const res = window.PersistenceService?.setState({ studentStats: {} });
        if (res && res.success === false) {
            throw new Error(res.error || '写入存储失败');
        }
        if (!silent) {
            window.Feedback?.showSuccess('已重置所有学生的抽取统计');
        }
        return true;
    } catch (e) {
        if (!silent) {
            window.Feedback?.showError(`重置统计失败：${e.message}`);
        }
        return false;
    }
}

// 开始新会话：保留学生与单词，清空统计、历史与当前轮排除
function resetSession() {
    try {
        resetAllStats({ silent: true });
        try { window.PersistenceService?.clearHistory({ scope: 'all' }); } catch (e) {}
        resetExcludedStudents({ silent: true });
        selectedStudent = null;
        selectedWord = null;
        availableStudents = students.slice();
        updateDrawMode(currentDrawMode, { persist: false });
        try { window.HistoryPanel && window.HistoryPanel.refresh && window.HistoryPanel.refresh(); } catch (e) {}
        window.Feedback?.showSuccess('已开始新会话：统计与历史已清空，名单已保留');
        return true;
    } catch (e) {
        window.Feedback?.showError(`开始新会话失败：${e.message}`);
        return false;
    }
}

// 完全重置：清空所有数据（学生、单词、历史、统计、排除、导入记录），保留设置
function fullReset() {
    try {
        const emptyMeta = { filename: null, filepath: null, importedAt: null, sourceType: null, count: 0 };
        const setRes = window.PersistenceService?.setState({
            students: [],
            words: [],
            studentStats: {},
            excludedStudents: [],
            importMetadata: { students: emptyMeta, words: emptyMeta }
        });
        if (setRes && setRes.success === false) {
            throw new Error(setRes.error || '写入存储失败');
        }
        try { window.PersistenceService?.clearHistory({ scope: 'all' }); } catch (e) {}
        prepareForReimport();
        try { window.HistoryPanel && window.HistoryPanel.refresh && window.HistoryPanel.refresh(); } catch (e) {}
        window.Feedback?.showSuccess('已完成完全重置，请重新导入学生与单词数据');
        return true;
    } catch (e) {
        window.Feedback?.showError(`完全重置失败：${e.message}`);
        return false;
    }
}

// 确认对话：开始新会话
function showNewSessionDialog() {
    if (document.getElementById('newSessionModal')) return;
    const modal = document.createElement('div');
    modal.id = 'newSessionModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>开始新会话</h3>
            <p>将清空：抽取历史（当前与归档）、所有学生的抽取统计、当前轮排除列表。\n保留：学生名单与单词列表、导入记录与设置。</p>
            <div class="modal-buttons">
                <button id="confirmNewSessionBtn" class="btn-secondary">确认开始</button>
                <button id="cancelNewSessionBtn" class="btn-primary">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const cleanup = () => { modal.remove(); };
    document.getElementById('confirmNewSessionBtn')?.addEventListener('click', () => {
        resetSession();
        cleanup();
    });
    document.getElementById('cancelNewSessionBtn')?.addEventListener('click', cleanup);
}

// 确认对话：完全重置
function showFullResetDialog() {
    if (document.getElementById('fullResetModal')) return;
    const modal = document.createElement('div');
    modal.id = 'fullResetModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>完全重置</h3>
            <p>将删除所有数据：学生名单、单词列表、抽取历史（含归档）、学生抽取统计、当前轮排除列表以及导入记录。\n保留：音乐/抽取模式等设置。重置后需要重新导入数据。</p>
            <div class="modal-buttons">
                <button id="confirmFullResetBtn" class="btn-back">确认重置</button>
                <button id="cancelFullResetBtn" class="btn-primary">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const cleanup = () => { modal.remove(); };
    document.getElementById('confirmFullResetBtn')?.addEventListener('click', () => {
        fullReset();
        cleanup();
    });
    document.getElementById('cancelFullResetBtn')?.addEventListener('click', cleanup);
}

function prepareForReimport() {
    setStudents([]);
    setWords([]);
    selectedStudent = null;
    selectedWord = null;
    switchScreen('startScreen');
    if (!document.getElementById('filePrompt')) {
        showFileUploadPrompt();
    }
}

function bindHistoryControls() {
    const btn = document.getElementById('clearHistoryBtn');
    if (btn) {
        btn.addEventListener('click', showClearHistoryDialog);
    }
    const resetBtn = document.getElementById('resetExcludedBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', showResetExclusionDialog);
    }
    const nsBtn = document.getElementById('newSessionBtn');
    if (nsBtn) {
        nsBtn.addEventListener('click', showNewSessionDialog);
    }
    const frBtn = document.getElementById('fullResetBtn');
    if (frBtn) {
        frBtn.addEventListener('click', showFullResetDialog);
    }
}

function initializeApp() {
    const restored = hydrateStateFromStore();
    bindAudioControls();
    bindHistoryControls();
    initializeAudio();
    updateDrawMode(currentDrawMode, { persist: false });

    try { window.DrawStrategy && window.DrawStrategy.runAssertions && window.DrawStrategy.runAssertions(); } catch (e) { console.warn('抽取策略断言未通过:', e); }

    if (!students.length || !words.length) {
        showFileUploadPrompt();
    }
}

// 初始化入口
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// 暴露全局函数
Object.assign(window, {
    startDrawing,
    showWordInput,
    resetToStart,
    toggleMusic,
    loadBothExcelFiles,
    useTestData,
    showFileUploadPrompt,
    prepareForReimport,
    showClearHistoryDialog,
    showResetExclusionDialog,
    showResetRoundDialog,
    resetExcludedStudents,
    // 新增：会话控制
    resetAllStats,
    resetSession,
    showNewSessionDialog,
    showFullResetDialog,
    fullReset
});
