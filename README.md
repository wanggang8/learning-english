# 各位徒儿请背书 - 抽学生背单词系统

一个具有中国风界面的随机抽取学生背单词网页应用。

## 功能特点

- ✅ 从Excel文件读取学生名单
- ✅ 通过URL参数切换不同班级
- ✅ 滚动动画抽取效果
- ✅ 已抽取学生不会重复
- ✅ 手动输入单词让学生背诵
- ✅ 中国风红色主题界面
- ✅ 背景音乐支持

## 文件结构

```
word-warrior/
├── main.js             # Electron 主进程入口
├── preload.js          # 预加载脚本，向渲染进程暴露持久化 API
├── renderer.js         # 渲染进程入口模块
├── index.html          # 主页面
├── style.css           # 样式文件
├── script.js           # 页面逻辑（由 renderer.js 加载）
├── app/
│   └── store.js        # electron-store 包装与数据 Schema
├── services/
│   └── persistence.js  # 渲染层持久化服务封装
├── data/               # Excel 数据文件夹
│   ├── 二一班.xlsx
│   ├── 二二班.xlsx
│   └── ...
├── assets/             # 资源文件夹（图片、音乐、依赖库）
├── package.json        # 项目依赖与构建配置
└── README.md           # 说明文档
```

## 使用方法

### 1. 准备Excel文件

在 `data/` 文件夹中创建Excel文件，命名格式：`班级名.xlsx`

Excel格式要求：
- 第一行：表头（姓名）
- 第二行开始：学生姓名（每行一个）

示例：
```
| 姓名   |
|--------|
| 张三   |
| 李四   |
| 王五   |
```

### 2. 添加背景音乐（可选）

将音乐文件命名为 `music.mp3`，放入 `assets/` 文件夹。

### 3. 打开网页

#### 方式一：直接打开
双击 `index.html` 文件（默认加载"二一班"）

#### 方式二：指定班级
在浏览器地址栏输入：
```
file:///路径/index.html?class=二二班
```

#### 方式三：使用本地服务器（推荐）
```bash
# 使用Python启动服务器
python3 -m http.server 8000

# 或使用Node.js
npx http-server
```

然后访问：
- 默认班级：`http://localhost:8000/`
- 指定班级：`http://localhost:8000/?class=二二班`

## 操作流程

1. **开始抽人**：点击"开始抽人"按钮
2. **滚动动画**：名字快速滚动2秒
3. **显示结果**：显示被抽中的学生
4. **点此抽题**：点击按钮，输入要背的单词
5. **显示单词**：单词以网格形式展示
6. **返回抽人**：继续抽取下一个学生

## 快捷键

- `ESC`：关闭单词输入框
- `Ctrl + Enter`：确认输入的单词

## 注意事项

1. **Excel文件命名**：必须与URL参数中的班级名一致
2. **文件编码**：Excel文件建议使用UTF-8编码
3. **浏览器兼容**：建议使用Chrome、Edge、Firefox等现代浏览器
4. **本地文件限制**：直接打开HTML可能无法加载Excel，建议使用本地服务器
5. **音乐播放**：部分浏览器需要用户交互后才能播放音乐

## 自定义

### 修改颜色主题
编辑 `style.css` 中的颜色变量：
```css
background: linear-gradient(135deg, #d32f2f 0%, #e91e63 50%, #d32f2f 100%);
```

### 修改动画时长
编辑 `script.js` 中的时间参数：
```javascript
setTimeout(() => {
    // 修改这里的2000（毫秒）
}, 2000);
```

### 添加更多班级
在 `data/` 文件夹中添加新的Excel文件即可。

## 技术栈

- HTML5
- CSS3（动画、渐变、响应式）
- JavaScript（ES6+）
- SheetJS（xlsx.js）- Excel文件解析
- Electron + electron-store（持久化存储）

## Electron 桌面应用打包

项目使用 [electron-builder](https://www.electron.build/) 进行跨平台打包，支持 macOS DMG 与 Windows NSIS 安装包。

### 离线依赖

- 所有依赖（包括 `electron-store`）均已锁定在 `package-lock.json` 中。
- 在无网络环境下可使用 `npm ci --offline`（需提前准备好 npm 缓存）或自建离线 npm 仓库进行安装。
- 需要的静态数据文件位于 `data/` 目录，打包时会一并包含。

### 打包与发布

```bash
# 开发调试
npm start

# 全量打包（mac + win）
npm run build:all

# macOS 单独打包    npm run build:mac
# Windows 单独打包    npm run build:win
```

## 数据与持久化

- `data/` 目录用于存放 Excel 数据源（学生名单、单词列表）。
- Electron 进程通过 `electron-store` 在本地持久化存储以下数据结构：
  - `students`：学生列表
  - `words`：单词列表
  - `settings`：应用设置（音乐开关、动画时长等）
  - `sessionHistory`：历史抽取记录
  - `metadata`：版本与修改时间信息
- 预加载脚本（`preload.js`）通过 `contextBridge` 向渲染进程暴露 `window.store` API，渲染层可以通过 `services/persistence.js` 统一访问并处理错误。
- 可通过 `window.PersistenceService.setErrorHandler(fn)` 注册统一错误提示钩子。

## 手动测试清单

### 基础测试

1. **启动应用**
   ```bash
   npm start
   ```
   - 确认主界面正常加载
   - 背景音乐可播放/暂停
   - 开发者工具（F12）无 JavaScript 错误

2. **持久化 API 可用性**  
   在开发者控制台执行：
   ```javascript
   console.log('Store API:', typeof window.store);
   console.log('PersistenceService:', typeof window.PersistenceService);
   ```
   预期输出：两者均为 `object`

3. **基本读写操作**
   ```javascript
   // 读取状态
   const state = window.store.getState();
   console.log('当前状态:', state);
   
   // 写入数据
   window.store.setState({
     students: ['测试学生'],
     words: ['apple']
   });
   
   // 验证写入
   console.log('新状态:', window.store.getState());
   ```

4. **数据持久化验证**
   - 执行保存：`window.PersistenceService.saveData(['学生A'], ['hello']);`
   - 关闭应用
   - 重新启动：`npm start`
   - 在控制台执行：`window.PersistenceService.loadData();`
   - 确认数据与保存前一致

### 打包与发布测试

5. **本地打包**
   ```bash
   npm run build        # 当前平台
   npm run build:mac    # macOS
   npm run build:win    # Windows
   ```
   - 确认 `dist/` 目录生成安装包
   - 无构建错误

6. **安装包测试**
   - 安装生成的应用
   - 启动后执行上述第 2-4 项测试
   - 确认持久化 API 正常工作
   - 验证 `data/` 目录中的 Excel 文件可正常读取

### 高级测试

7. **离线构建验证**
   ```bash
   npm ci --offline
   npm run build
   ```
   - 确认可从 `package-lock.json` 离线安装依赖

8. **错误回退机制**
   - 在控制台执行 `window.PersistenceService.setState('invalid');`
   - 确认控制台显示错误信息且应用不崩溃

9. **会话历史记录**
   ```javascript
   window.store.addSessionHistory({
     student: '张三',
     word: 'apple'
   });
   console.log(window.store.getState().sessionHistory);
   ```
   - 确认历史记录包含时间戳

10. **清除会话**
    ```javascript
    window.store.clearSession();
    ```
    - 确认 `students` 和 `words` 被清空
    - `settings` 保持不变

## 浏览器支持

- Chrome 90+
- Edge 90+
- Firefox 88+
- Safari 14+

## 许可证

MIT License
