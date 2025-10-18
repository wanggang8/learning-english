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

let students = [];
let availableStudents = [];
let words = [];
let availableWords = [];
let selectedStudent = null;
let selectedWord = null;
let rollingInterval = null;

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
    availableStudents = [...students];
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
        if (window.Feedback) {
            window.Feedback.showError('所有学生都已被抽取，已无可抽取的学生');
        } else {
            alert('所有学生都已被抽取！');
        }
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

        const randomIndex = Math.floor(Math.random() * availableStudents.length);
        selectedStudent = availableStudents[randomIndex];
        availableStudents.splice(randomIndex, 1);

        document.getElementById('selectedName').textContent = selectedStudent;
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

function resetToStart() {
    switchScreen('startScreen');
    selectedStudent = null;
    selectedWord = null;
}

function toggleMusic() {
    setMusicEnabled(!audioState.musicEnabled);
}

function initializeApp() {
    const restored = hydrateStateFromStore();
    bindAudioControls();
    initializeAudio();

    if (!students.length || !words.length) {
        showFileUploadPrompt();
    } else if (window.Feedback && (restored.hasStudents || restored.hasWords)) {
        window.Feedback.showSuccess(
            `✅ 已恢复上次导入的数据：学生 ${students.length} 名 / 单词 ${words.length} 个`
        );
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
    useTestData
});
