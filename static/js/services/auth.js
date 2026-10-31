// static/js/services/auth.js — Operations E03, E04, E05, E06, E07, E08
import { ENDPOINTS } from '../contracts/endpoints.js';
import { apiRequest } from '../core/http.js';
import { sessionManager } from '../core/session.js';
import { store } from '../core/store.js';

export const authService = {
  // E03: POST /api/v1/auth/register
  async register(payload, signal) {
    return apiRequest(ENDPOINTS.E03, { body: payload, signal });
  },

  // E04: POST /api/v1/auth/login
  async login(credentials, signal) {
    const tokenRes = await apiRequest(ENDPOINTS.E04, {
      body: {
        email: String(credentials.email || '').trim().toLowerCase(),
        password: credentials.password,
      },
      signal,
      skipAuthRefresh: true,
    });
    sessionManager.establishSession(tokenRes);
    await this.getMe(signal);
    return tokenRes;
  },

  // E05: POST /api/v1/auth/refresh (Delegated to single-flight mutex in sessionManager)
  async refresh() {
    const gen = sessionManager.getGeneration();
    const token = await sessionManager.refreshTokenSingleFlight(gen);
    return { access_token: token };
  },

  // E06: POST /api/v1/auth/logout
  async logout() {
    try {
      await apiRequest(ENDPOINTS.E06, { skipAuthRefresh: true });
    } finally {
      sessionManager.clearSession({ reason: 'logout', broadcast: true });
    }
  },

  // E07: POST /api/v1/auth/logout-all
  async logoutAll() {
    try {
      await apiRequest(ENDPOINTS.E07, { skipAuthRefresh: true });
    } finally {
      sessionManager.clearSession({ reason: 'logout_all', broadcast: true });
    }
  },

  // E08: GET /api/v1/auth/me
  async getMe(signal) {
    const meData = await apiRequest(ENDPOINTS.E08, { signal });
    store.setAuthContext({
      user: meData.user,
      memberships: meData.memberships || [],
    });
    return meData;
  },
};

