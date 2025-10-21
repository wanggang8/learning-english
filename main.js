const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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

    // 资源管理：复制本地图片到 assets/user 并返回相对路径
    ipcMain.handle('assets.copyImage', async (_event, src) => {
        try {
            if (!src || typeof src !== 'string') {
                return { success: false, error: 'invalid-arg' };
            }
            // 支持 file:// URL
            let srcPath = src;
            try {
                if (/^file:\/\//i.test(src)) {
                    const u = new URL(src);
                    srcPath = u.pathname || '';
                    if (process.platform === 'win32' && srcPath.startsWith('/')) {
                        srcPath = decodeURIComponent(srcPath.slice(1));
                    } else {
                        srcPath = decodeURIComponent(srcPath);
                    }
                }
            } catch (_) {}

            // 仅处理本地文件路径
            if (/^https?:\/\//i.test(srcPath)) {
                // 远程 URL：直接返回原始 URL
                return { success: true, url: srcPath, kind: 'remote' };
            }

            const absSrc = path.isAbsolute(srcPath)
                ? srcPath
                : path.resolve(srcPath);

            if (!fs.existsSync(absSrc) || !fs.statSync(absSrc).isFile()) {
                return { success: false, error: 'not-found' };
            }

            const destDir = path.join(__dirname, 'assets', 'user');
            fs.mkdirSync(destDir, { recursive: true });

            const base = path.basename(absSrc);
            const ext = path.extname(base);
            const nameOnly = base.slice(0, base.length - ext.length);

            const srcHash = crypto.createHash('sha256').update(fs.readFileSync(absSrc)).digest('hex');

            // 如果同名文件已存在且内容相同，直接复用
            const candidate = path.join(destDir, base);
            if (fs.existsSync(candidate)) {
                try {
                    const existHash = crypto.createHash('sha256').update(fs.readFileSync(candidate)).digest('hex');
                    if (existHash === srcHash) {
                        const rel = path.join('assets', 'user', base).replace(/\\/g, '/');
                        return { success: true, url: rel, existed: true, deduped: true };
                    }
                } catch (_) {}
            }

            // 查找可用文件名（避免覆盖不同内容）
            let idx = 1;
            let target = candidate;
            while (fs.existsSync(target)) {
                const nextName = `${nameOnly}-${idx}${ext}`;
                target = path.join(destDir, nextName);
                idx += 1;
            }

            fs.copyFileSync(absSrc, target);
            const rel = path.join('assets', 'user', path.basename(target)).replace(/\\/g, '/');
            return { success: true, url: rel, existed: false, deduped: false };
        } catch (e) {
            return { success: false, error: e?.message || 'copy-failed' };
        }
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
