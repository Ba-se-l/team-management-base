// static/js/services/inquiries.js — Operations E53, E54, E55, E56
import { ENDPOINTS } from '../contracts/endpoints.js';
import { adaptListResponse } from '../contracts/adapters.js';
import { buildPatchPayload } from '../contracts/serializers.js';
import { apiRequest } from '../core/http.js';

export const inquiriesService = {
  // E53: POST /api/v1/public/inquiries
  async submitPublic(payload, signal) {
    return apiRequest(ENDPOINTS.E53, {
      body: payload,
      signal,
    });
  },

  // E54: GET /api/v1/inquiries (Query: status, service_type, offset, limit)
  async list({ offset = 0, limit = 20, status = '', service_type = '' } = {}, signal) {
    const res = await apiRequest(ENDPOINTS.E54, {
      query: { offset, limit, status, service_type },
      signal,
    });
    return adaptListResponse(res, { offset, limit });
  },

  // E55: GET /api/v1/inquiries/{inquiry_id}
  async getById(inquiryId, signal) {
    return apiRequest(ENDPOINTS.E55, {
      pathParams: { inquiry_id: inquiryId },
      signal,
    });
  },

  // E56: PATCH /api/v1/inquiries/{inquiry_id}
  async update(inquiryId, originalInquiry, formValues, signal) {
    const patchBody = buildPatchPayload(
      originalInquiry,
      formValues,
      'UpdateInquiryStatusRequest'
    );
    // UpdateInquiryStatusRequest requires `status` in payload even if only admin_notes changed
    const body = {
      status: formValues.status || originalInquiry.status,
      ...(patchBody.admin_notes !== undefined ? { admin_notes: patchBody.admin_notes } : {}),
    };
    return apiRequest(ENDPOINTS.E56, {
      pathParams: { inquiry_id: inquiryId },
      body,
      signal,
    });
  },
};

