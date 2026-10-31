// static/js/core/lifecycle.js — Screen Lifecycle, Event Listener Cleanup & AbortController

export function createLifecycleScope() {
  const abortController = new AbortController();
  const cleanupCallbacks = [];

  return {
    get signal() {
      return abortController.signal;
    },

    onCleanup(fn) {
      if (typeof fn === 'function') {
        cleanupCallbacks.push(fn);
      }
    },

    listen(target, eventName, handler, options = {}) {
      if (!target || typeof target.addEventListener !== 'function') return;
      target.addEventListener(eventName, handler, options);
      cleanupCallbacks.push(() => {
        target.removeEventListener(eventName, handler, options);
      });
    },

    setInterval(fn, intervalMs) {
      const id = window.setInterval(fn, intervalMs);
      cleanupCallbacks.push(() => window.clearInterval(id));
      return id;
    },

    dispose() {
      abortController.abort();
      while (cleanupCallbacks.length > 0) {
        const fn = cleanupCallbacks.pop();
        try {
          fn();
        } catch {
          // Ignore cleanup errors
        }
      }
    },
  };
}

