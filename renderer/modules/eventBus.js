// 简易事件总线，集中模块间通信，避免直接耦合
(function(){
  const listeners = new Map();

  function on(event, handler) {
    if (typeof handler !== 'function') return () => {};
    if (!listeners.has(event)) listeners.set(event, new Set());
    const set = listeners.get(event);
    set.add(handler);
    return () => off(event, handler);
  }

  function off(event, handler) {
    const set = listeners.get(event);
    if (!set) return;
    set.delete(handler);
    if (!set.size) listeners.delete(event);
  }

  function emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    // 拷贝一份，避免监听器里修改集合导致遍历异常
    Array.from(set).forEach((fn) => {
      try { fn(payload); } catch (e) { console.error('[EventBus] listener error for', event, e); }
    });
  }

  window.AppEvents = Object.freeze({ on, off, emit });
})();
