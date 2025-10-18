# Renderer Modules

此目录包含渲染进程使用的模块化组件。

## 模块列表

### dataImporter.js

Excel 数据导入模块，负责读取、解析、验证和自动保存 Excel 数据。

#### 功能

- **读取文件**：使用 FileReader API 读取 Excel 文件
- **解析数据**：使用 SheetJS (XLSX) 解析 Excel 内容
- **数据验证**：验证和清理解析后的数据
- **自动保存**：成功导入后自动保存到持久化存储
- **元数据记录**：保存文件名、导入时间、数据源类型等信息

#### API

```javascript
// 导入单个 Excel 文件
const result = await window.DataImporter.importExcelFile(file, 'students');
// result: { success: boolean, data: string[], count: number, filename: string }

// 导入测试数据
const result = await window.DataImporter.importTestData(data, 'words');
// result: { success: boolean, data: string[], count: number }

// 批量导入学生和单词文件
const results = await window.DataImporter.importBothFiles(studentsFile, wordsFile);
// results: { students: {...}, words: {...}, success: boolean, errors: string[] }

// 获取导入统计信息
const stats = window.DataImporter.getImportStats();
// stats: { students: { count, metadata }, words: { count, metadata } }
```

#### 数据源类型

- `excel`: Excel 文件导入
- `test`: 测试数据
- `manual`: 手动输入

### feedback.js

用户反馈通知模块，提供 Toast 通知功能。

#### 功能

- **Toast 通知**：显示成功、错误、信息提示
- **自动消失**：可配置显示时长
- **样式丰富**：支持不同类型的样式
- **动画效果**：平滑的进入和退出动画

#### API

```javascript
// 显示成功提示（3秒后消失）
window.Feedback.showSuccess('数据已保存！');

// 显示错误提示（5秒后消失）
window.Feedback.showError('导入失败：文件格式不正确');

// 显示信息提示（4秒后消失，默认）
window.Feedback.showToast('正在处理...', window.Feedback.TOAST_TYPES.INFO, 4000);
```

#### Toast 类型

- `SUCCESS`: 成功提示（绿色渐变）
- `ERROR`: 错误提示（红色渐变）
- `INFO`: 信息提示（橙色渐变）

## 使用示例

### 导入 Excel 文件并显示反馈

```javascript
async function handleImport(file) {
  try {
    const result = await window.DataImporter.importExcelFile(file, 'students');
    
    if (result.success) {
      window.Feedback.showSuccess(
        `✅ 成功导入 ${result.count} 条数据！`
      );
    } else {
      window.Feedback.showError(
        `❌ 导入失败：${result.error}`
      );
    }
  } catch (error) {
    window.Feedback.showError(
      `❌ 导入异常：${error.message}`
    );
  }
}
```

### 加载持久化数据

```javascript
function loadPersistedData() {
  const stats = window.DataImporter.getImportStats();
  
  if (stats && stats.students.count > 0) {
    console.log('上次导入:', stats.students.metadata.importedAt);
    console.log('数据源:', stats.students.metadata.sourceType);
    
    window.Feedback.showSuccess(
      `✅ 已恢复数据：${stats.students.count} 名学生`
    );
  }
}
```

## 架构说明

### 职责分离

- **dataImporter.js**: 专注于数据导入和持久化逻辑
- **feedback.js**: 专注于用户界面反馈
- **script.js**: 应用主逻辑和事件处理

### 依赖关系

```
renderer.js (入口)
  ├─> services/persistence.js (持久化服务)
  ├─> renderer/modules/feedback.js (反馈通知)
  ├─> renderer/modules/dataImporter.js (数据导入)
  └─> script.js (主应用逻辑)
```

### 数据流

```
用户选择文件
  ↓
dataImporter.importExcelFile()
  ↓ 读取文件
FileReader API
  ↓ 解析
SheetJS (XLSX.read)
  ↓ 验证
validateAndCleanData()
  ↓ 保存
PersistenceService.updatePartial()
  ↓ 通知
feedback.showSuccess()
  ↓
用户看到成功提示
```

## 扩展性

### 添加新的数据源

可以在 `dataImporter.js` 中添加新的导入函数：

```javascript
async function importFromAPI(url, dataType) {
  const response = await fetch(url);
  const data = await response.json();
  
  const metadata = {
    filename: url,
    sourceType: 'api'
  };
  
  await saveToStore(data, dataType, metadata);
  return { success: true, data };
}
```

### 添加新的反馈类型

可以在 `feedback.js` 中添加新的 Toast 类型：

```javascript
const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning' // 新增
};

function showWarning(message, duration = 4000) {
  showToast(message, TOAST_TYPES.WARNING, duration);
}
```

然后在 CSS 中添加对应样式：

```css
.toast-warning {
  background: linear-gradient(135deg, #ffa500, #ff8c00);
  color: white;
  border: 3px solid #fff;
}
```

## 测试建议

### 单元测试

- 测试 Excel 解析逻辑
- 测试数据验证规则
- 测试错误处理机制

### 集成测试

- 测试完整的导入流程
- 测试持久化存储读写
- 测试 Toast 显示和消失

### E2E 测试

- 模拟用户选择文件
- 验证导入后的数据
- 验证重启后数据恢复
