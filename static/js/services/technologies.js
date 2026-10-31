// static/js/services/technologies.js — Operations E42, E43, E44, E45, E46, E47
import { ENDPOINTS } from '../contracts/endpoints.js';
import { adaptListResponse } from '../contracts/adapters.js';
import { buildPatchPayload } from '../contracts/serializers.js';
import { apiRequest } from '../core/http.js';

export const technologiesService = {
  // E42: POST /api/v1/technologies/ (Trailing slash required)
  async create(payload, signal) {
    return apiRequest(ENDPOINTS.E42, {
      body: payload,
      signal,
    });
  },

  // E43: GET /api/v1/technologies/ (Trailing slash + skip/limit raw Array)
  async list({ skip = 0, limit = 50 } = {}, signal) {
    const rawArray = await apiRequest(ENDPOINTS.E43, {
      query: { skip, limit },
      signal,
    });
    return adaptListResponse(rawArray, { skip, limit });
  },

  // E44: GET /api/v1/technologies/search (q, category, skip, limit -> raw Array)
  async search({ q = '', category = '', skip = 0, limit = 50 } = {}, signal) {
    const rawArray = await apiRequest(ENDPOINTS.E44, {
      query: { q, category, skip, limit },
      signal,
    });
    return adaptListResponse(rawArray, { skip, limit });
  },

  // E45: GET /api/v1/technologies/{tech_id}
  async getById(techId, signal) {
    return apiRequest(ENDPOINTS.E45, {
      pathParams: { tech_id: techId },
      signal,
    });
  },

  // E46: PATCH /api/v1/technologies/{tech_id}
  async update(techId, originalTech, formValues, signal) {
    const patchBody = buildPatchPayload(originalTech, formValues, 'UpdateTechnologyRequest');
    if (Object.keys(patchBody).length === 0) {
      return originalTech;
    }
    return apiRequest(ENDPOINTS.E46, {
      pathParams: { tech_id: techId },
      body: patchBody,
      signal,
    });
  },

  // E47: DELETE /api/v1/technologies/{tech_id} (Returns 200 OK JSON)
  async deactivate(techId, signal) {
    return apiRequest(ENDPOINTS.E47, {
      pathParams: { tech_id: techId },
      signal,
    });
  },
};

