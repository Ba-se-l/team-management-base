// static/js/services/tasks.js — Operations E31 through E41 (11 Operations)
import { ENDPOINTS } from '../contracts/endpoints.js';
import { adaptListResponse } from '../contracts/adapters.js';
import { buildPatchPayload } from '../contracts/serializers.js';
import { apiRequest } from '../core/http.js';

export const tasksService = {
  // E31: POST /api/v1/projects/{project_id}/tasks
  async create(projectId, payload, signal) {
    return apiRequest(ENDPOINTS.E31, {
      pathParams: { project_id: projectId },
      body: payload,
      signal,
    });
  },

  // E32: GET /api/v1/projects/{project_id}/tasks
  async listByProject(projectId, { offset = 0, limit = 20, status = '' } = {}, signal) {
    const res = await apiRequest(ENDPOINTS.E32, {
      pathParams: { project_id: projectId },
      query: { offset, limit, status },
      signal,
    });
    return adaptListResponse(res, { offset, limit });
  },

  // E33: GET /api/v1/projects/{project_id}/tasks/kanban
  async getKanban(projectId, signal) {
    return apiRequest(ENDPOINTS.E33, {
      pathParams: { project_id: projectId },
      signal,
    });
  },

  // E34: GET /api/v1/tasks/my
  async listMyTasks({ offset = 0, limit = 50 } = {}, signal) {
    const res = await apiRequest(ENDPOINTS.E34, {
      query: { offset, limit },
      signal,
    });
    return adaptListResponse(res, { offset, limit });
  },

  // E35: GET /api/v1/tasks/{task_id}
  async getById(taskId, signal) {
    return apiRequest(ENDPOINTS.E35, {
      pathParams: { task_id: taskId },
      signal,
    });
  },

  // E36: PATCH /api/v1/tasks/{task_id}
  async update(taskId, originalTask, formValues, signal) {
    const patchBody = buildPatchPayload(originalTask, formValues, 'UpdateTaskRequest');
    if (Object.keys(patchBody).length === 0) {
      return originalTask;
    }
    return apiRequest(ENDPOINTS.E36, {
      pathParams: { task_id: taskId },
      body: patchBody,
      signal,
    });
  },

  // E37: DELETE /api/v1/tasks/{task_id} (Returns 204 No Content)
  async remove(taskId, signal) {
    return apiRequest(ENDPOINTS.E37, {
      pathParams: { task_id: taskId },
      signal,
    });
  },

  // E38: PATCH /api/v1/tasks/{task_id}/move
  async move(taskId, { status, position }, signal) {
    return apiRequest(ENDPOINTS.E38, {
      pathParams: { task_id: taskId },
      body: {
        status,
        position: Math.max(0, Number(position) || 0),
      },
      signal,
    });
  },

  // E39: POST /api/v1/tasks/{task_id}/comments
  async addComment(taskId, content, signal) {
    return apiRequest(ENDPOINTS.E39, {
      pathParams: { task_id: taskId },
      body: { content: String(content || '').trim() },
      signal,
    });
  },

  // E40: DELETE /api/v1/tasks/{task_id}/comments/{comment_id} (Scoped to task_id)
  async deleteTaskComment(taskId, commentId, signal) {
    return apiRequest(ENDPOINTS.E40, {
      pathParams: { task_id: taskId, comment_id: commentId },
      signal,
    });
  },

  // E41: DELETE /api/v1/tasks/comments/{comment_id} (Direct comment_id deletion)
  async deleteCommentById(commentId, signal) {
    return apiRequest(ENDPOINTS.E41, {
      pathParams: { comment_id: commentId },
      signal,
    });
  },
};

