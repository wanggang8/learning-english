# Phase 2.1.1 – 词汇存储结构升级（向后兼容）

本阶段将 `words` 从原先的字符串数组升级为“富对象”数组，支持更丰富的词汇信息，并保证对历史数据与现有会话的兼容。

## 变更概述

- `words` 字段由 `Array<string>` 迁移为 `Array<Word>`，新的 `Word` 结构如下：
  - `word: string`
  - `phonetic: string | null`
  - `definition: string | null`
  - `example: string | null`
  - `tags: string[]`（默认空数组）
  - `imagePath: string | null`
  - `mastery: number`（默认 0）
  - `lastReviewedAt: string | null`
  - `favorite: boolean`（默认 false）
- `sessionHistory.*.events[].word` 字段支持 `string | object | null`，以兼容旧记录与新对象。
- `metadata.schemaVersion` 升级至 `3`，`metadata.version` 升级至 `2.1.1`。

## 向后兼容策略

- Schema 允许 `words.items` 同时接受 `string` 与 `object`，避免 electron-store 在加载旧配置时直接清空。
- 在以下时机进行规范化/迁移：
  - Store 初始化完成后（preload -> app/store.js），自动检测并将旧的字符串数组或不完整对象升级为完整的 `Word` 对象数组；
  - `store.getState()/setState()/updatePartial()` 针对 `words` 字段均会做规范化；
  - 渲染层的 `PersistenceService.getState()/setState()/updatePartial()/saveData()/loadData()` 同步做规范化，保证在任何入口传入旧数据都不会破坏状态；
  - 历史面板渲染时，对 `event.word` 兼容 string/object 两种形态展示。

## 对前端逻辑的影响

- 抽取/展示逻辑保持不变：
  - `setWords/availableWords/word selection` 现在以 `Word` 对象为元素，但仍然随机抽取并显示 `word` 字段文本；
  - 历史记录中 `word` 可为对象或字符串，面板会自动取文本展示；
  - 测试数据仍可传入字符串数组，会自动升级为 `Word` 对象。

## 开发注意

- 如需使用词汇的其他字段（如 `definition`、`example` 等），直接从 `Word` 对象上读取；
- 对外 API（PersistenceService）已做兼容处理，调用方可继续传入字符串数组或部分字段对象；
- 请避免直接依赖 `words` 为 `Array<string>` 的假设。

## 手动测试要点

1. 旧数据（字符串数组）升级后不丢失：
   - 启动应用，观察 `words` 仍可正常加载与抽取；
2. 历史面板兼容：
   - 触发一次抽取，确认历史中 `word` 正常显示；
3. 导入流程：
   - 导入字符串形式的词表，确认自动保存与再次加载后 `words` 已为对象数组；
4. API 兼容：
   - 通过 `window.PersistenceService.saveData([...], ['apple','banana'])` 保存；
   - 通过 `window.PersistenceService.loadData()` 读取，`words` 为对象数组。

## 相关文件

- `app/store.js`：Schema 与迁移/规范化逻辑（初始化与读写时）
- `services/persistence.js`：渲染层持久化服务（读写时规范化）
- `script.js`：前端抽取与展示逻辑（支持对象词条）
- `renderer/components/historyPanel.js`：历史展示兼容对象/字符串词条

