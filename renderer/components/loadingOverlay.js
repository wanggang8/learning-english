// 全局 Loading 覆盖层与进度反馈组件
(function(){
  const NS = '[LoadingOverlay]';
  const ID = 'loadingOverlay';

  let overlayEl = null;
  let messageEl = null;
  let progressWrapEl = null;
  let progressBarEl = null;
  let visible = false;

  function ensure() {
    if (overlayEl) return overlayEl;
    overlayEl = document.getElementById(ID);
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.id = ID;
      overlayEl.className = 'loading-overlay';
      overlayEl.setAttribute('aria-hidden', 'true');
      overlayEl.innerHTML = `
        <div class="loading-content">
          <div class="loading-spinner" aria-label="loading"></div>
          <div id="loadingMessage" class="loading-message">处理中...</div>
          <div class="loading-progress" id="loadingProgressWrap" hidden>
            <div class="loading-progress-bar" id="loadingProgressBar" style="width:0%"></div>
          </div>
        </div>
      `;
      document.body.appendChild(overlayEl);
    }
    messageEl = overlayEl.querySelector('#loadingMessage');
    progressWrapEl = overlayEl.querySelector('#loadingProgressWrap');
    progressBarEl = overlayEl.querySelector('#loadingProgressBar');
    return overlayEl;
  }

  function show(message, { determinate = false, progress = 0 } = {}) {
    ensure();
    visible = true;
    overlayEl.classList.add('visible');
    overlayEl.setAttribute('aria-hidden', 'false');
    if (typeof message === 'string' && messageEl) {
      messageEl.textContent = message;
    }
    if (determinate) {
      progressWrapEl?.removeAttribute('hidden');
      setProgress(progress);
    } else {
      progressWrapEl?.setAttribute('hidden', '');
    }
  }

  function setMessage(message) {
    ensure();
    if (messageEl) messageEl.textContent = message;
  }

  function setProgress(value) {
    ensure();
    if (!progressWrapEl || !progressBarEl) return;
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    progressWrapEl.removeAttribute('hidden');
    progressBarEl.style.width = `${Math.round(v * 100)}%`;
  }

  function hide() {
    if (!overlayEl) return;
    visible = false;
    overlayEl.classList.remove('visible');
    overlayEl.setAttribute('aria-hidden', 'true');
    // 复位进度
    if (progressBarEl) progressBarEl.style.width = '0%';
  }

  async function run(task, { message = '处理中...', determinate = false } = {}) {
    try {
      show(message, { determinate });
      return await task();
    } finally {
      hide();
    }
  }

  function isVisible() { return !!visible; }

  // 暴露全局
  window.LoadingOverlay = Object.freeze({ show, hide, setMessage, setProgress, run, isVisible });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ensure(), { once: true });
  } else {
    ensure();
  }

  console.log(NS, 'initialized');
})();
