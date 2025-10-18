const TOAST_CONTAINER_ID = 'toast-container';

const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info'
};

function ensureContainer() {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.classList.add('toast-container');
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type = TOAST_TYPES.INFO, duration = 4000) {
  const container = ensureContainer();
  const toast = document.createElement('div');
  toast.classList.add('toast');
  toast.classList.add(`toast-${type}`);
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, { once: true });
  }, duration);
}

function showError(message, duration = 5000) {
  showToast(message, TOAST_TYPES.ERROR, duration);
}

function showSuccess(message, duration = 3000) {
  showToast(message, TOAST_TYPES.SUCCESS, duration);
}

window.Feedback = Object.freeze({
  TOAST_TYPES,
  showToast,
  showError,
  showSuccess
});
