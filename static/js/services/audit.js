// static/js/services/audit.js — Operation E57
import { ENDPOINTS } from '../contracts/endpoints.js';
import { adaptListResponse } from '../contracts/adapters.js';
import { apiRequest } from '../core/http.js';

export const auditService = {
  // E57: GET /api/v1/audit (Query: user_id, action, entity_type, offset, limit)
  async list({ offset = 0, limit = 20, user_id = '', action = '', entity_type = '' } = {}, signal) {
    const res = await apiRequest(ENDPOINTS.E57, {
      query: { offset, limit, user_id, action, entity_type },
      signal,
    });
    return adaptListResponse(res, { offset, limit });
  },
};

