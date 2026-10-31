// static/js/services/users.js — Operations E09, E10, E11, E12, E13, E14, E15
import { ENDPOINTS } from '../contracts/endpoints.js';
import { adaptListResponse } from '../contracts/adapters.js';
import { buildPatchPayload } from '../contracts/serializers.js';
import { apiRequest } from '../core/http.js';
import { sessionManager } from '../core/session.js';
import { store } from '../core/store.js';

export const usersService = {
  // E09: POST /api/v1/users (Super Admin Only)
  async createByAdmin(payload, signal) {
    return apiRequest(ENDPOINTS.E09, { body: payload, signal });
  },

  // E10: GET /api/v1/users/me
  async getProfile(signal) {
    const user = await apiRequest(ENDPOINTS.E10, { signal });
    store.updateUserProfile(user);
    return user;
  },

  // E11: DELETE /api/v1/users/me (Returns 200 OK JSON + increments security_version)
  async deactivateSelf(signal) {
    const res = await apiRequest(ENDPOINTS.E11, { signal, skipAuthRefresh: true });
    sessionManager.clearSession({ reason: 'self_deactivated', broadcast: true });
    return res;
  },

  // E12: PATCH /api/v1/users/me
  async updateProfile(originalUser, formValues, signal) {
    const patchBody = buildPatchPayload(originalUser, formValues, 'UpdateSchemaRequest');
    if (Object.keys(patchBody).length === 0) {
      return originalUser;
    }
    const updated = await apiRequest(ENDPOINTS.E12, { body: patchBody, signal });
    store.updateUserProfile(updated);
    return updated;
  },

  // E13: GET /api/v1/users/me/dashboard
  async getDashboard(signal) {
    return apiRequest(ENDPOINTS.E13, { signal });
  },

  // E14: PATCH /api/v1/users/me/password (Increments security_version & invalidates all tokens)
  async changePassword(payload, signal) {
    const res = await apiRequest(ENDPOINTS.E14, {
      body: {
        old_password: payload.old_password,
        new_password: payload.new_password,
      },
      signal,
      skipAuthRefresh: true,
    });
    sessionManager.clearSession({ reason: 'password_changed', broadcast: true });
    return res;
  },

  // E15: GET /api/v1/users/ (Note trailing slash & skip/limit raw Array response)
  async listDirectory({ skip = 0, limit = 20 } = {}, signal) {
    const rawArray = await apiRequest(ENDPOINTS.E15, {
      query: { skip, limit },
      signal,
    });
    return adaptListResponse(rawArray, { skip, limit });
  },
};

