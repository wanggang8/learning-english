// 全局变量
let students = []; // 学生名单
let availableStudents = []; // 可抽取的学生
let words = []; // 单词列表
let availableWords = []; // 可抽取的单词
let selectedStudent = null; // 当前选中的学生
let selectedWord = null; // 当前选中的单词
let rollingInterval = null; // 滚动动画定时器
const bgMusic = document.getElementById('bgMusic');

// 页面加载时初始化
window.addEventListener('DOMContentLoaded', () => {
    showFileUploadPrompt();
    // 尝试自动播放音乐
    bgMusic.play().catch(() => {
        // 自动播放失败，等待用户交互
        console.log('音乐需要用户交互后播放');
    });
});

// 显示文件上传提示
function showFileUploadPrompt() {
    const promptDiv = document.createElement('div');
    promptDiv.id = 'filePrompt';
    promptDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 2rem;
        border-radius: 15px;
        border: 5px solid #ffd700;
        box-shadow: 0 10px 50px rgba(0,0,0,0.5);
        z-index: 3000;
        text-align: center;
        max-width: 600px;
    `;
    
    promptDiv.innerHTML = `
        <h3 style="color: #d32f2f; margin-bottom: 1.5rem; font-size: 1.8rem;">请上传Excel文件</h3>
        
        <div style="margin-bottom: 1.5rem; text-align: left; padding: 0 1rem;">
            <label style="display: block; color: #333; font-weight: bold; margin-bottom: 0.5rem;">1. 学生名单Excel：</label>
            <input type="file" id="studentsFileInput" accept=".xlsx,.xls" style="width: 100%; padding: 0.5rem; border: 2px solid #ddd; border-radius: 5px;">
            <small style="color: #666; display: block; margin-top: 0.3rem;">格式：第一列为"姓名"</small>
        </div>
        
        <div style="margin-bottom: 1.5rem; text-align: left; padding: 0 1rem;">
            <label style="display: block; color: #333; font-weight: bold; margin-bottom: 0.5rem;">2. 单词列表Excel：</label>
            <input type="file" id="wordsFileInput" accept=".xlsx,.xls" style="width: 100%; padding: 0.5rem; border: 2px solid #ddd; border-radius: 5px;">
            <small style="color: #666; display: block; margin-top: 0.3rem;">格式：第一列为"单词"</small>
        </div>
        
        <button onclick="loadBothExcelFiles()" style="padding: 1rem 3rem; font-size: 1.3rem; background: #ff9800; color: white; border: none; border-radius: 10px; cursor: pointer; margin-right: 0.5rem; font-weight: bold;">确定</button>
        <button onclick="useTestData()" style="padding: 1rem 3rem; font-size: 1.3rem; background: #666; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: bold;">使用测试数据</button>
    `;
    
    document.body.appendChild(promptDiv);
}

// 加载两个Excel文件
function loadBothExcelFiles() {
    const studentsFile = document.getElementById('studentsFileInput').files[0];
    const wordsFile = document.getElementById('wordsFileInput').files[0];
    
    if (!studentsFile || !wordsFile) {
        alert('请选择学生名单和单词列表两个Excel文件！');
        return;
    }
    
    // 加载学生名单
    loadExcelFile(studentsFile, 'students', (data) => {
        students = data;
        availableStudents = [...students];
        console.log('成功加载学生名单:', students);
        
        // 加载单词列表
        loadExcelFile(wordsFile, 'words', (data) => {
            words = data;
            availableWords = [...words];
            console.log('成功加载单词列表:', words);
            
            // 移除提示框
            document.getElementById('filePrompt').remove();
            
            alert(`成功加载！\n学生: ${students.length} 名\n单词: ${words.length} 个`);
        });
    });
}

// 通用Excel文件加载函数
function loadExcelFile(file, type, callback) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            // 解析数据（跳过表头）
            const result = [];
            for (let i = 1; i < jsonData.length; i++) {
                if (jsonData[i][0]) {
                    result.push(jsonData[i][0].toString().trim());
                }
            }
            
            if (result.length === 0) {
                alert(`${type === 'students' ? '学生名单' : '单词列表'}Excel文件中没有找到数据！请确保第一列有内容，第一行为表头。`);
                return;
            }
            
            callback(result);
            
        } catch (error) {
            console.error('解析Excel失败:', error);
            alert(`解析${type === 'students' ? '学生名单' : '单词列表'}Excel文件失败，请确保文件格式正确！`);
        }
    };
    
    reader.onerror = function() {
        alert('读取文件失败！');
    };
    
    reader.readAsArrayBuffer(file);
}

// 使用测试数据
function useTestData() {
    students = ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十'];
    availableStudents = [...students];
    
    words = ['apple', 'banana', 'cat', 'dog', 'elephant', 'fish', 'grape', 'house', 'ice', 'juice'];
    availableWords = [...words];
    
    // 移除提示框
    document.getElementById('filePrompt').remove();
    
    console.log('使用测试数据 - 学生:', students);
    console.log('使用测试数据 - 单词:', words);
    alert('已加载测试数据\n学生: 8名\n单词: 10个');
}

// 切换屏幕
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// 开始抽取
function startDrawing() {
    if (availableStudents.length === 0) {
        alert('所有学生都已被抽取！');
        return;
    }
    
    // 切换到抽取中页面
    switchScreen('drawingScreen');
    
    // 开始滚动动画
    const rollingNameEl = document.getElementById('rollingName');
    let currentIndex = 0;
    
    rollingInterval = setInterval(() => {
        currentIndex = Math.floor(Math.random() * availableStudents.length);
        rollingNameEl.textContent = availableStudents[currentIndex];
    }, 100);
    
    // 2秒后停止并显示结果
    setTimeout(() => {
        clearInterval(rollingInterval);
        
        // 随机选择一个学生
        const randomIndex = Math.floor(Math.random() * availableStudents.length);
        selectedStudent = availableStudents[randomIndex];
        
        // 从可抽取列表中移除
        availableStudents.splice(randomIndex, 1);
        
        // 显示结果
        document.getElementById('selectedName').textContent = selectedStudent;
        switchScreen('resultScreen');
    }, 2000);
}

// 抽取单词
function showWordInput() {
    if (availableWords.length === 0) {
        alert('所有单词都已被抽取！');
        return;
    }
    
    // 随机抽取一个单词
    const randomIndex = Math.floor(Math.random() * availableWords.length);
    selectedWord = availableWords[randomIndex];
    
    // 从可抽取列表中移除
    availableWords.splice(randomIndex, 1);
    
    // 显示单词
    displayWord(selectedWord);
}

// 显示单词
function displayWord(word) {
    const wordGrid = document.getElementById('wordGrid');
    wordGrid.innerHTML = '';
    
    const wordItem = document.createElement('div');
    wordItem.className = 'word-item';
    wordItem.textContent = word;
    wordGrid.appendChild(wordItem);
    
    switchScreen('wordScreen');
}

// 重置到开始页面
function resetToStart() {
    switchScreen('startScreen');
    selectedStudent = null;
    selectedWord = null;
}

// 音乐控制
function toggleMusic() {
    const musicBtn = document.getElementById('musicBtn');
    
    if (bgMusic.paused) {
        bgMusic.play();
        musicBtn.textContent = '🔊';
        musicBtn.classList.remove('muted');
    } else {
        bgMusic.pause();
        musicBtn.textContent = '🔇';
        musicBtn.classList.add('muted');
    }
}

