// static/js/services/showcase.js — Operations E48, E49, E50, E51, E52
import { ENDPOINTS } from '../contracts/endpoints.js';
import { adaptListResponse } from '../contracts/adapters.js';
import { apiRequest } from '../core/http.js';

export const showcaseService = {
  // E48: GET /api/v1/public/overview
  async getOverview(signal) {
    return apiRequest(ENDPOINTS.E48, { signal });
  },

  // E49: GET /api/v1/public/projects (Query: technology, featured, offset, limit)
  async listProjects({ offset = 0, limit = 12, technology = '', featured = null } = {}, signal) {
    const res = await apiRequest(ENDPOINTS.E49, {
      query: {
        offset,
        limit,
        technology,
        featured: featured === null || featured === '' ? undefined : featured,
      },
      signal,
    });
    return adaptListResponse(res, { offset, limit });
  },

  // E50: GET /api/v1/public/projects/{slug}
  async getProjectBySlug(slug, signal) {
    return apiRequest(ENDPOINTS.E50, {
      pathParams: { slug },
      signal,
    });
  },

  // E51: GET /api/v1/public/members (Query: offset, limit)
  async listMembers({ offset = 0, limit = 12 } = {}, signal) {
    const res = await apiRequest(ENDPOINTS.E51, {
      query: { offset, limit },
      signal,
    });
    return adaptListResponse(res, { offset, limit });
  },

  // E52: GET /api/v1/public/technologies (Returns raw Array of PublicTechnologySummary)
  async listTechnologies(signal) {
    const res = await apiRequest(ENDPOINTS.E52, { signal });
    return Array.isArray(res) ? res : [];
  },
};

