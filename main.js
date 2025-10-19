const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function registerIpcHandlers() {
    ipcMain.handle('toggle-fullscreen', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return false;
        const next = !win.isFullScreen();
        win.setFullScreen(next);
        return next;
    });

    ipcMain.handle('exit-fullscreen', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return false;
        if (win.isFullScreen()) {
            win.setFullScreen(false);
            return true;
        }
        return false;
    });

    ipcMain.handle('get-fullscreen', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return win ? win.isFullScreen() : false;
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: '🌟 单词小勇士',
        icon: path.join(__dirname, 'assets/icon.png'),
        backgroundColor: '#000000'
    });

    // 转发全屏状态变化到渲染进程
    win.on('enter-full-screen', () => {
        win.webContents.send('fullscreen-changed', true);
    });
    win.on('leave-full-screen', () => {
        win.webContents.send('fullscreen-changed', false);
    });

    // 加载index.html
    win.loadFile('index.html');

    // 开发时打开开发者工具（可选）
    // win.webContents.openDevTools();
}

app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
