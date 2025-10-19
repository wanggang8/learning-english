// 统一的 Notification/Toast 组件（支持成功/警告/错误/信息 + 多语言）
(function(){
  const NS = '[Toast]';
  const CONTAINER_ID = 'toast-container';

  const TYPES = Object.freeze({
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
    INFO: 'info'
  });

  // 简单的多语言字典与占位符替换
  const DICT = {
    'zh-CN': {
      'import.header.missing.students': '未检测到表头“姓名”。请确认第一行第一列为“姓名”。',
      'import.header.missing.words': '未检测到表头“单词”。请确认第一行第一列为“单词”。',
      'import.data.empty.students': '学生名单中没有找到有效数据',
      'import.data.empty.words': '单词列表中没有找到有效数据',
      'import.duplicates.removed': '已去重 {count} 个重复项',
      'import.invalid.rows': '检测到 {count} 行格式异常，已跳过',
      'import.empty.rows': '检测到 {count} 行空白，已跳过',
      'store.operation.failed': '存储操作失败：{op}（{msg}）'
    },
    'en': {
      'import.header.missing.students': 'Header "Name" not found. Please ensure A1 is "Name".',
      'import.header.missing.words': 'Header "Word" not found. Please ensure A1 is "Word".',
      'import.data.empty.students': 'No valid student data found',
      'import.data.empty.words': 'No valid word data found',
      'import.duplicates.removed': '{count} duplicate item(s) removed',
      'import.invalid.rows': '{count} invalid row(s) skipped',
      'import.empty.rows': '{count} empty row(s) skipped',
      'store.operation.failed': 'Persistence failed: {op} ({msg})'
    }
  };

  let currentLang = 'zh-CN';

  function setLang(lang) {
    if (typeof lang === 'string' && DICT[lang]) currentLang = lang;
  }

  function format(str, params) {
    if (!params) return str;
    return String(str).replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
  }

  function t(key, params, fallback) {
    const langPack = DICT[currentLang] || {};
    const msg = langPack[key] || DICT['en'][key] || fallback || key;
    return format(msg, params);
  }

  function ensureContainer() {
    let container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function show(messageOrKey, type = TYPES.INFO, duration = 4000, params) {
    const container = ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.role = 'status';
    toast.ariaLive = 'polite';

    const text = (typeof messageOrKey === 'string' && messageOrKey.indexOf('.') !== -1 && DICT[currentLang][messageOrKey])
      ? t(messageOrKey, params)
      : (typeof messageOrKey === 'string' ? messageOrKey : String(messageOrKey));
    toast.textContent = text;

    // 点击立即关闭
    toast.addEventListener('click', () => {
      try { toast.classList.remove('toast-visible'); } catch (e) {}
      setTimeout(() => toast.remove(), 200);
    });

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    const timeout = Number.isFinite(duration) ? duration : 4000;
    if (timeout > 0) {
      setTimeout(() => {
        toast.classList.remove('toast-visible');
        toast.addEventListener('transitionend', () => {
          toast.remove();
          if (container.children.length === 0) container.remove();
        }, { once: true });
      }, timeout);
    }
  }

  function success(msg, duration = 3000) { show(msg, TYPES.SUCCESS, duration); }
  function warning(msg, duration = 4500) { show(msg, TYPES.WARNING, duration); }
  function error(msg, duration = 5000) { show(msg, TYPES.ERROR, duration); }
  function info(msg, duration = 3500) { show(msg, TYPES.INFO, duration); }

  // 暴露全局 API
  window.Toast = Object.freeze({ TYPES, setLang, t, show, success, warning, error, info });

  // 兼容旧的 Feedback API
  if (!window.Feedback) {
    window.Feedback = Object.freeze({
      TOAST_TYPES: TYPES,
      showToast: show,
      showSuccess: success,
      showError: error,
      showWarning: warning
    });
  }

  console.log(NS, 'initialized');
})();
