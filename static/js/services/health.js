// static/js/services/health.js — Operations E01 & E02
import { ENDPOINTS } from '../contracts/endpoints.js';
import { apiRequest } from '../core/http.js';

export const healthService = {
  // E01: GET /health
  async checkLiveness(signal) {
    return apiRequest(ENDPOINTS.E01, { signal });
  },

  // E02: GET /health/ready
  async checkReadiness(signal) {
    return apiRequest(ENDPOINTS.E02, { signal });
  },
};

