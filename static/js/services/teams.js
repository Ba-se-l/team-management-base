// static/js/services/teams.js — Operations E16, E17, E18, E19, E20
import { ENDPOINTS } from '../contracts/endpoints.js';
import { adaptListResponse } from '../contracts/adapters.js';
import { buildPatchPayload } from '../contracts/serializers.js';
import { apiRequest } from '../core/http.js';
import { store } from '../core/store.js';
import { authService } from './auth.js';

export const teamsService = {
  // E16: POST /api/v1/teams (Automatically refreshes /auth/me so creator gets ADMIN role in store)
  async create(payload, signal) {
    const created = await apiRequest(ENDPOINTS.E16, { body: payload, signal });
    await authService.getMe(signal);
    return created;
  },

  // E17: GET /api/v1/teams
  async list({ offset = 0, limit = 20 } = {}, signal) {
    const res = await apiRequest(ENDPOINTS.E17, {
      query: { offset, limit },
      signal,
    });
    return adaptListResponse(res, { offset, limit });
  },

  // E18: GET /api/v1/teams/{team_id}
  async getById(teamId, signal) {
    return apiRequest(ENDPOINTS.E18, {
      pathParams: { team_id: teamId },
      signal,
    });
  },

  // E19: PATCH /api/v1/teams/{team_id}
  async update(teamId, originalTeam, formValues, signal) {
    const patchBody = buildPatchPayload(originalTeam, formValues, 'UpdateTeamRequest');
    if (Object.keys(patchBody).length === 0) {
      return originalTeam;
    }
    const updated = await apiRequest(ENDPOINTS.E19, {
      pathParams: { team_id: teamId },
      body: patchBody,
      signal,
    });
    if (updated.is_active === false) {
      store.recordDeactivatedEntity('teams', updated);
    } else if (updated.is_active === true) {
      store.removeDeactivatedEntity('teams', updated.id);
    }
    return updated;
  },

  // E20: DELETE /api/v1/teams/{team_id} (Returns 204 No Content)
  async deactivate(team, signal) {
    const teamId = typeof team === 'object' ? team.id : team;
    await apiRequest(ENDPOINTS.E20, {
      pathParams: { team_id: teamId },
      signal,
    });
    if (typeof team === 'object' && team !== null) {
      store.recordDeactivatedEntity('teams', team);
    } else {
      store.recordDeactivatedEntity('teams', { id: Number(teamId), name: `Team #${teamId}` });
    }
    return null;
  },
};

