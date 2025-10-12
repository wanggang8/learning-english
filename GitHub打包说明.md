# GitHub Actions 自动打包说明

## 功能说明

已配置GitHub Actions自动打包，可以在云端同时打包Mac和Windows版本。

## 使用步骤

### 第一步：创建GitHub仓库

1. 访问 https://github.com/new
2. 创建一个新仓库（可以是私有仓库）
3. 仓库名称建议：`word-warrior` 或 `单词小勇士`

### 第二步：上传代码到GitHub

在项目目录打开终端，运行：

```bash
# 初始化Git仓库（如果还没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit"

# 关联远程仓库（替换为你的GitHub用户名和仓库名）
git remote add origin https://github.com/你的用户名/仓库名.git

# 推送到GitHub
git branch -M main
git push -u origin main
```

### 第三步：触发自动打包

有两种方式触发打包：

#### 方式A：创建版本标签（推荐）

```bash
# 创建版本标签
git tag v1.0.0

# 推送标签到GitHub
git push origin v1.0.0
```

推送标签后，GitHub Actions会自动：
1. 在macOS虚拟机上打包Mac版本
2. 在Windows虚拟机上打包Windows版本
3. 创建一个Release发布
4. 自动上传所有安装包

#### 方式B：手动触发

1. 访问你的GitHub仓库
2. 点击 `Actions` 标签
3. 选择 `Build and Release` 工作流
4. 点击 `Run workflow` 按钮
5. 点击绿色的 `Run workflow` 确认

手动触发只会打包，不会创建Release。

### 第四步：下载打包好的文件

#### 如果是通过标签触发：
1. 访问仓库的 `Releases` 页面
2. 找到对应版本（如 v1.0.0）
3. 下载安装包：
   - `单词小勇士-1.0.0.dmg` (Intel Mac)
   - `单词小勇士-1.0.0-arm64.dmg` (Apple Silicon Mac)
   - `单词小勇士 Setup 1.0.0.exe` (Windows)

#### 如果是手动触发：
1. 访问仓库的 `Actions` 标签
2. 点击最新的工作流运行
3. 在 `Artifacts` 部分下载：
   - `macos-build` (Mac安装包)
   - `windows-build` (Windows安装包)

## 打包时间

- 首次打包：约 10-15 分钟
- 后续打包：约 5-10 分钟

可以在 `Actions` 标签中实时查看打包进度。

## 注意事项

### 1. GitHub Actions 免费额度
- 公开仓库：无限制
- 私有仓库：每月 2000 分钟免费

### 2. 文件大小限制
- 单个文件最大 2GB
- Release 总大小最大 10GB

### 3. 更新版本号
每次发布新版本时：
1. 修改 `package.json` 中的 `version` 字段
2. 创建新的标签（如 v1.0.1, v1.1.0）

### 4. 私有仓库
如果使用私有仓库，只有你能访问打包好的文件。
如果需要分享给其他人，可以：
- 下载后手动分享
- 或使用公开仓库

## 常见问题

### Q: 打包失败怎么办？
A: 
1. 访问 `Actions` 标签查看错误日志
2. 检查 `package.json` 配置是否正确
3. 确保所有文件都已提交到GitHub

### Q: 如何删除旧版本？
A: 
1. 访问 `Releases` 页面
2. 点击要删除的版本
3. 点击 `Delete` 按钮

### Q: 可以只打包Windows版本吗？
A: 可以，修改 `.github/workflows/build.yml`：
- 删除 `macos-latest` 相关配置
- 只保留 `windows-latest`

## 本地打包 vs GitHub Actions

| 特性 | 本地打包 | GitHub Actions |
|------|---------|----------------|
| Mac版本 | ✅ 可以 | ✅ 可以 |
| Windows版本 | ❌ 不可以（M芯片Mac） | ✅ 可以 |
| 打包时间 | 10-30分钟 | 5-15分钟 |
| 网络要求 | 需要下载依赖 | 自动处理 |
| 费用 | 免费 | 免费（有额度） |

## 推荐工作流

1. **开发阶段**：本地测试（`npm start`）
2. **准备发布**：推送代码到GitHub
3. **打包发布**：创建版本标签，自动打包
4. **分发**：从GitHub Releases下载安装包分享

这样可以充分利用GitHub的免费资源，同时打包Mac和Windows版本！
