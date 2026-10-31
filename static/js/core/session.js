// static/js/core/session.js — Cross-Tab Synchronized Session & Single-Flight Refresh Mutex
import { APP_CONFIG } from './config.js';
import { store } from './store.js';

let broadcastChannel = null;
if (typeof BroadcastChannel !== 'undefined') {
  try {
    broadcastChannel = new BroadcastChannel(APP_CONFIG.BROADCAST_CHANNEL);
  } catch {
    broadcastChannel = null;
  }
}

let inFlightRefreshPromise = null;

function readPersistedSession() {
  try {
    const raw = localStorage.getItem(APP_CONFIG.SESSION_STORAGE_KEY);
    if (!raw) return { accessToken: null, expiresAt: 0, generation: 0 };
    const parsed = JSON.parse(raw);
    return {
      accessToken: typeof parsed.accessToken === 'string' ? parsed.accessToken : null,
      expiresAt: Number(parsed.expiresAt) || 0,
      generation: Number(parsed.generation) || 0,
    };
  } catch {
    return { accessToken: null, expiresAt: 0, generation: 0 };
  }
}

function writePersistedSession({ accessToken, expiresAt, generation }) {
  const nextState = {
    accessToken: accessToken || null,
    expiresAt: Number(expiresAt) || 0,
    generation: Number(generation) || Date.now(),
  };
  try {
    localStorage.setItem(APP_CONFIG.SESSION_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // Ignore storage quota errors
  }
  store.setSessionTokens(nextState);
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'SESSION_UPDATED', payload: nextState });
    } catch {
      // Ignore broadcast errors
    }
  }
  return nextState;
}

export const sessionManager = {
  init(onExternalClear) {
    const initial = readPersistedSession();
    store.setSessionTokens(initial);

    const handleSync = (payload, reason = 'external_logout') => {
      if (!payload || !payload.accessToken) {
        this.clearSession({ reason, broadcast: false });
        if (typeof onExternalClear === 'function') {
          onExternalClear(reason);
        }
      } else {
        store.setSessionTokens(payload);
      }
    };

    if (broadcastChannel) {
      broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'SESSION_UPDATED') {
          handleSync(event.data.payload);
        } else if (event.data?.type === 'SESSION_CLEARED') {
          handleSync(null, event.data.reason || 'external_logout');
        }
      };
    }

    window.addEventListener('storage', (event) => {
      if (event.key === APP_CONFIG.SESSION_STORAGE_KEY) {
        handleSync(readPersistedSession(), 'storage_sync');
      }
    });
  },

  getAccessToken() {
    const inMemory = store.getState().session.accessToken;
    if (inMemory) return inMemory;
    const persisted = readPersistedSession();
    if (persisted.accessToken) {
      store.setSessionTokens(persisted);
    }
    return persisted.accessToken;
  },

  getGeneration() {
    return readPersistedSession().generation;
  },

  establishSession(tokenResponse) {
    const expiresInSec = Number(tokenResponse?.expires_in) || 1800;
    const expiresAt = Date.now() + expiresInSec * 1000;
    const generation = Date.now();
    const persisted = writePersistedSession({
      accessToken: tokenResponse.access_token,
      expiresAt,
      generation,
    });
    if (tokenResponse?.user) {
      store.updateUserProfile(tokenResponse.user);
    }
    return persisted;
  },

  clearSession({ reason = 'logout', broadcast = true } = {}) {
    try {
      localStorage.removeItem(APP_CONFIG.SESSION_STORAGE_KEY);
    } catch {
      // Ignore
    }
    store.clearAllProtectedState(reason);

    // Purge protected DOM containers immediately to prevent stale sensitive views
    const workspaceRoot = document.getElementById('workspace-view-root');
    if (workspaceRoot) workspaceRoot.innerHTML = '';
    const modalRoot = document.getElementById('modal-root');
    if (modalRoot) modalRoot.innerHTML = '';
    const drawerRoot = document.getElementById('drawer-root');
    if (drawerRoot) drawerRoot.innerHTML = '';

    if (broadcast && broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: 'SESSION_CLEARED', reason });
      } catch {
        // Ignore
      }
    }
  },

  /**
   * Executes POST /api/v1/auth/refresh (E05) inside a cross-tab Web Lock + Singleton Promise
   * so two browser tabs NEVER send the same rotated refresh cookie concurrently.
   */
  async refreshTokenSingleFlight(failedGeneration = 0) {
    if (inFlightRefreshPromise) {
      return inFlightRefreshPromise;
    }

    const performRefresh = async () => {
      // Check if another tab already rotated the token while we waited for the lock
      const latest = readPersistedSession();
      if (latest.accessToken && latest.generation > failedGeneration && failedGeneration > 0) {
        store.setSessionTokens(latest);
        return latest.accessToken;
      }

      const startTime = performance.now();
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: null }),
      });
      const durationMs = Math.round(performance.now() - startTime);

      store.recordDiagnosticTrace({
        code: 'E05',
        method: 'POST',
        path: '/api/v1/auth/refresh',
        status: response.status,
        durationMs,
        requestId: response.headers.get('X-Request-ID') || null,
        timestamp: new Date().toISOString(),
      });

      if (!response.ok) {
        this.clearSession({ reason: 'session_expired', broadcast: true });
        throw new Error('SESSION_REFRESH_FAILED');
      }

      const data = await response.json();
      const updated = this.establishSession(data);
      return updated.accessToken;
    };

    const runLocked = async () => {
      if (typeof navigator !== 'undefined' && navigator.locks?.request) {
        return navigator.locks.request(
          APP_CONFIG.REFRESH_MUTEX_NAME,
          { mode: 'exclusive' },
          performRefresh
        );
      }
      return performRefresh();
    };

    inFlightRefreshPromise = runLocked().finally(() => {
      inFlightRefreshPromise = null;
    });

    return inFlightRefreshPromise;
  },
};

