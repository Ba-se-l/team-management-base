// static/js/core/store.js — Reactive Application Store with Zero-Residue Purge
import { APP_CONFIG } from './config.js';

function loadRecentlyDeactivated() {
  try {
    const raw = sessionStorage.getItem(APP_CONFIG.DEACTIVATED_STORAGE_KEY);
    if (!raw) return { teams: [], projects: [] };
    const parsed = JSON.parse(raw);
    return {
      teams: Array.isArray(parsed.teams) ? parsed.teams : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    };
  } catch {
    return { teams: [], projects: [] };
  }
}

function saveRecentlyDeactivated(data) {
  try {
    sessionStorage.setItem(APP_CONFIG.DEACTIVATED_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

const initialState = () => ({
  session: {
    accessToken: null,
    expiresAt: 0,
    generation: 0,
    lastClearReason: null,
  },
  user: null,
  memberships: [],
  recentlyDeactivated: loadRecentlyDeactivated(),
  diagnostics: [],
});

let state = initialState();
const listeners = new Set();

export const store = {
  getState() {
    return state;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  notify() {
    for (const listener of listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('Store listener error:', err);
      }
    }
  },

  setSessionTokens({ accessToken, expiresAt, generation }) {
    state = {
      ...state,
      session: {
        ...state.session,
        accessToken: accessToken || null,
        expiresAt: Number(expiresAt) || 0,
        generation: Number(generation) || 0,
      },
    };
    this.notify();
  },

  setAuthContext({ user, memberships }) {
    state = {
      ...state,
      user: user || null,
      memberships: Array.isArray(memberships) ? memberships : state.memberships,
    };
    this.notify();
  },

  updateUserProfile(user) {
    state = {
      ...state,
      user: user ? { ...(state.user || {}), ...user } : state.user,
    };
    this.notify();
  },

  recordDeactivatedEntity(kind, item) {
    if (!item || !item.id) return;
    const list = state.recentlyDeactivated[kind] || [];
    const filtered = list.filter((entry) => Number(entry.id) !== Number(item.id));
    const updatedList = [
      {
        id: Number(item.id),
        label: item.name || item.title || `#${item.id}`,
        slug: item.slug || null,
        deactivatedAt: new Date().toISOString(),
      },
      ...filtered,
    ].slice(0, 15);

    const nextDeactivated = {
      ...state.recentlyDeactivated,
      [kind]: updatedList,
    };
    saveRecentlyDeactivated(nextDeactivated);
    state = {
      ...state,
      recentlyDeactivated: nextDeactivated,
    };
    this.notify();
  },

  removeDeactivatedEntity(kind, id) {
    const list = state.recentlyDeactivated[kind] || [];
    const nextDeactivated = {
      ...state.recentlyDeactivated,
      [kind]: list.filter((entry) => Number(entry.id) !== Number(id)),
    };
    saveRecentlyDeactivated(nextDeactivated);
    state = {
      ...state,
      recentlyDeactivated: nextDeactivated,
    };
    this.notify();
  },

  recordDiagnosticTrace(trace) {
    // Strictly scrub any accidental sensitive fields
    const safeTrace = {
      code: String(trace.code || 'RAW'),
      method: String(trace.method || 'GET'),
      path: String(trace.path || ''),
      status: Number(trace.status) || 0,
      durationMs: Number(trace.durationMs) || 0,
      requestId: trace.requestId ? String(trace.requestId) : null,
      timestamp: trace.timestamp || new Date().toISOString(),
    };
    const nextDiagnostics = [safeTrace, ...state.diagnostics].slice(
      0,
      APP_CONFIG.MAX_DIAGNOSTIC_TRACES
    );
    state = {
      ...state,
      diagnostics: nextDiagnostics,
    };
  },

  clearDiagnostics() {
    state = {
      ...state,
      diagnostics: [],
    };
    this.notify();
  },

  clearAllProtectedState(reason = 'logout') {
    try {
      sessionStorage.removeItem(APP_CONFIG.DEACTIVATED_STORAGE_KEY);
    } catch {
      // Ignore
    }
    state = {
      session: {
        accessToken: null,
        expiresAt: 0,
        generation: 0,
        lastClearReason: reason,
      },
      user: null,
      memberships: [],
      recentlyDeactivated: { teams: [], projects: [] },
      diagnostics: state.diagnostics,
    };
    this.notify();
  },
};

