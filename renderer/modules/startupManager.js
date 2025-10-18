// 启动管理模块：检查是否存在可恢复的数据并提供恢复/重新导入/新会话入口

const STARTUP_NS = '[StartupManager]';
const STARTUP_DIALOG_ID = 'startup-restore-dialog';

function isStoreAvailable() {
  return typeof window !== 'undefined' && window.PersistenceService && window.PersistenceService.isStoreAvailable();
}

function safeGetState() {
  if (!isStoreAvailable()) {
    return { success: false, error: 'Store API 不可用' };
  }
  try {
    return window.PersistenceService.getState();
  } catch (e) {
    console.error(STARTUP_NS, '读取状态失败:', e);
    return { success: false, error: e?.message || '未知错误' };
  }
}

function validatePersistedState(state) {
  const errors = [];
  const result = {
    hasStudents: false,
    hasWords: false,
    hasSettings: false,
    counts: { students: 0, words: 0 },
    importMetadata: state?.importMetadata || null,
    corrupted: false,
    errors
  };

  if (!state || typeof state !== 'object') {
    result.corrupted = true;
    errors.push('状态对象缺失');
    return result;
  }

  // students
  if (!Array.isArray(state.students)) {
    errors.push('students 不是数组');
  } else {
    result.hasStudents = state.students.length > 0;
    result.counts.students = state.students.length;
  }

  // words
  if (!Array.isArray(state.words)) {
    errors.push('words 不是数组');
  } else {
    result.hasWords = state.words.length > 0;
    result.counts.words = state.words.length;
  }

  // settings
  if (typeof state.settings !== 'object' || state.settings === null) {
    errors.push('settings 缺失或格式错误');
  } else {
    result.hasSettings = true;
  }

  result.corrupted = errors.length > 0 && (result.hasStudents || result.hasWords);
  return result;
}

function removeDialog() {
  const modal = document.getElementById(STARTUP_DIALOG_ID);
  if (modal) modal.remove();
}

function createDialog({ title, description, stats, onRestore, onReimport, onNewSession, showRestore = true }) {
  if (document.getElementById(STARTUP_DIALOG_ID)) return;

  const modal = document.createElement('div');
  modal.id = STARTUP_DIALOG_ID;
  modal.className = 'modal active startup-modal';

  const studentsText = typeof stats?.students === 'number' ? stats.students : 0;
  const wordsText = typeof stats?.words === 'number' ? stats.words : 0;
  const studentsMeta = stats?.meta?.students;
  const wordsMeta = stats?.meta?.words;

  modal.innerHTML = `
    <div class="modal-content startup-dialog">
      <h3 class="startup-title">${title || '继续上次会话'}</h3>
      ${description ? `<p class="startup-desc">${description}</p>` : ''}
      <div class="startup-stats">
        <div class="startup-stat-item">👥 学生：<strong>${studentsText}</strong>${studentsMeta?.filename ? `（${studentsMeta.filename}）` : ''}</div>
        <div class="startup-stat-item">📚 单词：<strong>${wordsText}</strong>${wordsMeta?.filename ? `（${wordsMeta.filename}）` : ''}</div>
      </div>
      <div class="modal-buttons startup-actions">
        ${showRestore ? '<button id="startupRestoreBtn" class="btn-primary">继续会话</button>' : ''}
        <button id="startupReimportBtn" class="btn-secondary">重新导入</button>
        <button id="startupNewSessionBtn" class="btn-back">新建会话</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 非阻塞绑定
  requestAnimationFrame(() => {
    if (showRestore) {
      const restoreBtn = document.getElementById('startupRestoreBtn');
      restoreBtn?.addEventListener('click', () => {
        try { onRestore?.(); } finally { removeDialog(); }
      });
    }

    const reimportBtn = document.getElementById('startupReimportBtn');
    reimportBtn?.addEventListener('click', () => {
      try { onReimport?.(); } finally { removeDialog(); }
    });

    const newSessionBtn = document.getElementById('startupNewSessionBtn');
    newSessionBtn?.addEventListener('click', () => {
      try { onNewSession?.(); } finally { removeDialog(); }
    });
  });
}

function runStartupFlow() {
  // 仅在 DOM 就绪后运行
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', runStartupFlow, { once: true });
    return;
  }

  if (!isStoreAvailable()) {
    return;
  }

  setTimeout(() => {
    const stateResult = safeGetState();
    if (!stateResult.success) {
      console.warn(STARTUP_NS, '无法读取历史状态:', stateResult.error);
      return;
    }

    const info = validatePersistedState(stateResult.data);

    // 如果完全没有数据则不显示对话框
    const hasAnyData = info.hasStudents || info.hasWords;
    if (!hasAnyData) {
      return;
    }

    // 错误容错：如结构异常，直接降级为重新导入模式
    if (info.corrupted) {
      console.warn(STARTUP_NS, '检测到部分历史数据损坏，将降级为重新导入流程:', info.errors);
      if (window.Feedback) {
        window.Feedback.showToast('检测到历史数据不完整，建议重新导入', window.Feedback.TOAST_TYPES.INFO, 5000);
      }
      // 自动降级：清理内存状态并提示导入
      if (window.prepareForReimport) {
        window.prepareForReimport();
      }
      // 依然给用户一个选择是否清空旧数据的入口
      createDialog({
        title: '历史数据异常',
        description: '检测到历史数据不完整或损坏，建议重新导入。你也可以新建会话（将自动归档旧会话数据）。',
        stats: { students: info.counts.students, words: info.counts.words, meta: info.importMetadata },
        showRestore: false,
        onReimport: () => {
          window.prepareForReimport?.();
          window.Feedback?.showSuccess('已进入重新导入模式');
        },
        onNewSession: () => {
          try { window.PersistenceService?.startNewSession(); } catch (e) {}
          window.prepareForReimport?.();
          window.Feedback?.showToast('已新建会话，请导入数据', window.Feedback.TOAST_TYPES.INFO, 4000);
        }
      });
      return;
    }

    // 正常情况：展示恢复对话框
    createDialog({
      title: '继续使用上次数据？',
      description: '检测到上次导入的数据，是否要继续会话或新建会话？',
      stats: { students: info.counts.students, words: info.counts.words, meta: info.importMetadata },
      onRestore: () => {
        // 默认初始化过程已经加载过数据，此处仅提示
        if (window.Feedback) {
          window.Feedback.showSuccess(`✅ 已恢复上次数据：学生 ${info.counts.students} 名 / 单词 ${info.counts.words} 个`);
        }
      },
      onReimport: () => {
        window.prepareForReimport?.();
        window.Feedback?.showToast('请重新导入学生与单词数据', window.Feedback.TOAST_TYPES.INFO, 4000);
      },
      onNewSession: () => {
        try { window.PersistenceService?.startNewSession(); } catch (e) {}
        window.prepareForReimport?.();
        window.Feedback?.showToast('已新建会话，请导入数据', window.Feedback.TOAST_TYPES.INFO, 4000);
      }
    });
  }, 0); // 让出事件循环，避免阻塞
}

window.StartupManager = Object.freeze({
  runStartupFlow
});
