// static/js/services/projects.js — Operations E25, E26, E27, E28, E29, E30
import { ENDPOINTS } from '../contracts/endpoints.js';
import { adaptListResponse } from '../contracts/adapters.js';
import { buildPatchPayload } from '../contracts/serializers.js';
import { apiRequest } from '../core/http.js';
import { store } from '../core/store.js';

export const projectsService = {
  // E25: POST /api/v1/teams/{team_id}/projects
  async create(teamId, payload, signal) {
    return apiRequest(ENDPOINTS.E25, {
      pathParams: { team_id: teamId },
      body: payload,
      signal,
    });
  },

  // E26: GET /api/v1/teams/{team_id}/projects
  async listByTeam(teamId, { offset = 0, limit = 20, status = '' } = {}, signal) {
    const res = await apiRequest(ENDPOINTS.E26, {
      pathParams: { team_id: teamId },
      query: { offset, limit, status },
      signal,
    });
    return adaptListResponse(res, { offset, limit });
  },

  // E27: GET /api/v1/projects
  async listAll({ offset = 0, limit = 20, status = '', visibility = '' } = {}, signal) {
    const res = await apiRequest(ENDPOINTS.E27, {
      query: { offset, limit, status, visibility },
      signal,
    });
    return adaptListResponse(res, { offset, limit });
  },

  // E28: GET /api/v1/projects/{project_id}
  async getById(projectId, signal) {
    return apiRequest(ENDPOINTS.E28, {
      pathParams: { project_id: projectId },
      signal,
    });
  },

  // E29: PATCH /api/v1/projects/{project_id}
  async update(projectId, originalProject, formValues, signal) {
    const normalizedOriginal = {
      ...originalProject,
      technology_ids: Array.isArray(originalProject?.technologies)
        ? originalProject.technologies.map((t) => Number(t.id))
        : originalProject?.technology_ids || [],
    };
    const patchBody = buildPatchPayload(normalizedOriginal, formValues, 'UpdateProjectRequest');
    if (Object.keys(patchBody).length === 0) {
      return originalProject;
    }
    const updated = await apiRequest(ENDPOINTS.E29, {
      pathParams: { project_id: projectId },
      body: patchBody,
      signal,
    });
    if (updated.is_active === false) {
      store.recordDeactivatedEntity('projects', updated);
    } else if (updated.is_active === true) {
      store.removeDeactivatedEntity('projects', updated.id);
    }
    return updated;
  },

  // E30: DELETE /api/v1/projects/{project_id} (Returns 204 No Content)
  async deactivate(project, signal) {
    const projectId = typeof project === 'object' ? project.id : project;
    await apiRequest(ENDPOINTS.E30, {
      pathParams: { project_id: projectId },
      signal,
    });
    if (typeof project === 'object' && project !== null) {
      store.recordDeactivatedEntity('projects', project);
    } else {
      store.recordDeactivatedEntity('projects', { id: Number(projectId), title: `Project #${projectId}` });
    }
    return null;
  },
};

