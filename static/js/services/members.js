// static/js/services/members.js — Operations E21, E22, E23, E24
import { ENDPOINTS } from '../contracts/endpoints.js';
import { adaptListResponse } from '../contracts/adapters.js';
import { buildPatchPayload } from '../contracts/serializers.js';
import { apiRequest } from '../core/http.js';

export const membersService = {
  // E21: POST /api/v1/teams/{team_id}/members
  async add(teamId, payload, signal) {
    return apiRequest(ENDPOINTS.E21, {
      pathParams: { team_id: teamId },
      body: {
        user_id: Number(payload.user_id),
        role: payload.role,
      },
      signal,
    });
  },

  // E22: GET /api/v1/teams/{team_id}/members
  async list(teamId, { offset = 0, limit = 50 } = {}, signal) {
    const res = await apiRequest(ENDPOINTS.E22, {
      pathParams: { team_id: teamId },
      query: { offset, limit },
      signal,
    });
    return adaptListResponse(res, { offset, limit });
  },

  // E23: PATCH /api/v1/teams/{team_id}/members/{user_id}
  async updateRole(teamId, userId, originalMember, nextValues, signal) {
    const patchBody = buildPatchPayload(originalMember, nextValues, 'UpdateMemberRoleRequest');
    if (Object.keys(patchBody).length === 0) {
      return originalMember;
    }
    return apiRequest(ENDPOINTS.E23, {
      pathParams: { team_id: teamId, user_id: userId },
      body: patchBody,
      signal,
    });
  },

  // E24: DELETE /api/v1/teams/{team_id}/members/{user_id} (Returns 204 No Content)
  async remove(teamId, userId, signal) {
    return apiRequest(ENDPOINTS.E24, {
      pathParams: { team_id: teamId, user_id: userId },
      signal,
    });
  },
};

