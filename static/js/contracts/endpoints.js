// static/js/contracts/endpoints.js — Complete 57-Operation Registry (E01–E57)
// Strictly preserves exact trailing slashes and HTTP methods from FastAPI routers.

export const ENDPOINTS = Object.freeze({
  // 1. Health & Readiness Probes (2)
  E01: { code: 'E01', method: 'GET', path: '/health', auth: 'public', expectedStatus: 200 },
  E02: { code: 'E02', method: 'GET', path: '/health/ready', auth: 'public', expectedStatus: 200 },

  // 2. Authentication & Session Lifecycle (6)
  E03: { code: 'E03', method: 'POST', path: '/api/v1/auth/register', auth: 'public', expectedStatus: 201, schema: 'CreateUserRequest' },
  E04: { code: 'E04', method: 'POST', path: '/api/v1/auth/login', auth: 'public', includeCredentials: true, expectedStatus: 200, schema: 'LoginRequest' },
  E05: { code: 'E05', method: 'POST', path: '/api/v1/auth/refresh', auth: 'public', includeCredentials: true, expectedStatus: 200, schema: 'RefreshRequest' },
  E06: { code: 'E06', method: 'POST', path: '/api/v1/auth/logout', auth: 'bearer', includeCredentials: true, expectedStatus: 200 },
  E07: { code: 'E07', method: 'POST', path: '/api/v1/auth/logout-all', auth: 'bearer', includeCredentials: true, expectedStatus: 200 },
  E08: { code: 'E08', method: 'GET', path: '/api/v1/auth/me', auth: 'bearer', expectedStatus: 200 },

  // 3. Users & Personal Profile (7) — Note: E15 has an explicit trailing slash
  E09: { code: 'E09', method: 'POST', path: '/api/v1/users', auth: 'bearer', expectedStatus: 201, schema: 'CreateUserRequest' },
  E10: { code: 'E10', method: 'GET', path: '/api/v1/users/me', auth: 'bearer', expectedStatus: 200 },
  E11: { code: 'E11', method: 'DELETE', path: '/api/v1/users/me', auth: 'bearer', expectedStatus: 200 },
  E12: { code: 'E12', method: 'PATCH', path: '/api/v1/users/me', auth: 'bearer', expectedStatus: 200, schema: 'UpdateSchemaRequest' },
  E13: { code: 'E13', method: 'GET', path: '/api/v1/users/me/dashboard', auth: 'bearer', expectedStatus: 200 },
  E14: { code: 'E14', method: 'PATCH', path: '/api/v1/users/me/password', auth: 'bearer', expectedStatus: 200, schema: 'ChangePasswordRequest' },
  E15: { code: 'E15', method: 'GET', path: '/api/v1/users/', auth: 'bearer', expectedStatus: 200, listMode: 'skip' },

  // 4. Teams Management (5)
  E16: { code: 'E16', method: 'POST', path: '/api/v1/teams', auth: 'bearer', expectedStatus: 201, schema: 'CreateTeamRequest' },
  E17: { code: 'E17', method: 'GET', path: '/api/v1/teams', auth: 'bearer', expectedStatus: 200, listMode: 'offset' },
  E18: { code: 'E18', method: 'GET', path: '/api/v1/teams/{team_id}', auth: 'bearer', expectedStatus: 200 },
  E19: { code: 'E19', method: 'PATCH', path: '/api/v1/teams/{team_id}', auth: 'bearer', expectedStatus: 200, schema: 'UpdateTeamRequest' },
  E20: { code: 'E20', method: 'DELETE', path: '/api/v1/teams/{team_id}', auth: 'bearer', expectedStatus: 204 },

  // 5. Team Memberships (4)
  E21: { code: 'E21', method: 'POST', path: '/api/v1/teams/{team_id}/members', auth: 'bearer', expectedStatus: 201, schema: 'AddMemberRequest' },
  E22: { code: 'E22', method: 'GET', path: '/api/v1/teams/{team_id}/members', auth: 'bearer', expectedStatus: 200, listMode: 'offset' },
  E23: { code: 'E23', method: 'PATCH', path: '/api/v1/teams/{team_id}/members/{user_id}', auth: 'bearer', expectedStatus: 200, schema: 'UpdateMemberRoleRequest' },
  E24: { code: 'E24', method: 'DELETE', path: '/api/v1/teams/{team_id}/members/{user_id}', auth: 'bearer', expectedStatus: 204 },

  // 6. Projects Management (6)
  E25: { code: 'E25', method: 'POST', path: '/api/v1/teams/{team_id}/projects', auth: 'bearer', expectedStatus: 201, schema: 'CreateProjectRequest' },
  E26: { code: 'E26', method: 'GET', path: '/api/v1/teams/{team_id}/projects', auth: 'bearer', expectedStatus: 200, listMode: 'offset' },
  E27: { code: 'E27', method: 'GET', path: '/api/v1/projects', auth: 'bearer', expectedStatus: 200, listMode: 'offset' },
  E28: { code: 'E28', method: 'GET', path: '/api/v1/projects/{project_id}', auth: 'bearer', expectedStatus: 200 },
  E29: { code: 'E29', method: 'PATCH', path: '/api/v1/projects/{project_id}', auth: 'bearer', expectedStatus: 200, schema: 'UpdateProjectRequest' },
  E30: { code: 'E30', method: 'DELETE', path: '/api/v1/projects/{project_id}', auth: 'bearer', expectedStatus: 204 },

  // 7. Tasks, Kanban & Comments (11)
  E31: { code: 'E31', method: 'POST', path: '/api/v1/projects/{project_id}/tasks', auth: 'bearer', expectedStatus: 201, schema: 'CreateTaskRequest' },
  E32: { code: 'E32', method: 'GET', path: '/api/v1/projects/{project_id}/tasks', auth: 'bearer', expectedStatus: 200, listMode: 'offset' },
  E33: { code: 'E33', method: 'GET', path: '/api/v1/projects/{project_id}/tasks/kanban', auth: 'bearer', expectedStatus: 200 },
  E34: { code: 'E34', method: 'GET', path: '/api/v1/tasks/my', auth: 'bearer', expectedStatus: 200, listMode: 'offset' },
  E35: { code: 'E35', method: 'GET', path: '/api/v1/tasks/{task_id}', auth: 'bearer', expectedStatus: 200 },
  E36: { code: 'E36', method: 'PATCH', path: '/api/v1/tasks/{task_id}', auth: 'bearer', expectedStatus: 200, schema: 'UpdateTaskRequest' },
  E37: { code: 'E37', method: 'DELETE', path: '/api/v1/tasks/{task_id}', auth: 'bearer', expectedStatus: 204 },
  E38: { code: 'E38', method: 'PATCH', path: '/api/v1/tasks/{task_id}/move', auth: 'bearer', expectedStatus: 200, schema: 'MoveTaskRequest' },
  E39: { code: 'E39', method: 'POST', path: '/api/v1/tasks/{task_id}/comments', auth: 'bearer', expectedStatus: 201, schema: 'CreateCommentRequest' },
  E40: { code: 'E40', method: 'DELETE', path: '/api/v1/tasks/{task_id}/comments/{comment_id}', auth: 'bearer', expectedStatus: 204 },
  E41: { code: 'E41', method: 'DELETE', path: '/api/v1/tasks/comments/{comment_id}', auth: 'bearer', expectedStatus: 204 },

  // 8. Technology Catalog (6) — Note: E42 & E43 have an explicit trailing slash
  E42: { code: 'E42', method: 'POST', path: '/api/v1/technologies/', auth: 'bearer', expectedStatus: 201, schema: 'CreateTechnologyRequest' },
  E43: { code: 'E43', method: 'GET', path: '/api/v1/technologies/', auth: 'bearer', expectedStatus: 200, listMode: 'skip' },
  E44: { code: 'E44', method: 'GET', path: '/api/v1/technologies/search', auth: 'bearer', expectedStatus: 200, listMode: 'skip' },
  E45: { code: 'E45', method: 'GET', path: '/api/v1/technologies/{tech_id}', auth: 'bearer', expectedStatus: 200 },
  E46: { code: 'E46', method: 'PATCH', path: '/api/v1/technologies/{tech_id}', auth: 'bearer', expectedStatus: 200, schema: 'UpdateTechnologyRequest' },
  E47: { code: 'E47', method: 'DELETE', path: '/api/v1/technologies/{tech_id}', auth: 'bearer', expectedStatus: 200 },

  // 9. Public Showcase Portal (5)
  E48: { code: 'E48', method: 'GET', path: '/api/v1/public/overview', auth: 'public', expectedStatus: 200 },
  E49: { code: 'E49', method: 'GET', path: '/api/v1/public/projects', auth: 'public', expectedStatus: 200, listMode: 'offset' },
  E50: { code: 'E50', method: 'GET', path: '/api/v1/public/projects/{slug}', auth: 'public', expectedStatus: 200 },
  E51: { code: 'E51', method: 'GET', path: '/api/v1/public/members', auth: 'public', expectedStatus: 200, listMode: 'offset' },
  E52: { code: 'E52', method: 'GET', path: '/api/v1/public/technologies', auth: 'public', expectedStatus: 200, listMode: 'array' },

  // 10. Client Inquiries & Triage (4)
  E53: { code: 'E53', method: 'POST', path: '/api/v1/public/inquiries', auth: 'public', expectedStatus: 201, schema: 'CreateInquiryRequest' },
  E54: { code: 'E54', method: 'GET', path: '/api/v1/inquiries', auth: 'bearer', expectedStatus: 200, listMode: 'offset' },
  E55: { code: 'E55', method: 'GET', path: '/api/v1/inquiries/{inquiry_id}', auth: 'bearer', expectedStatus: 200 },
  E56: { code: 'E56', method: 'PATCH', path: '/api/v1/inquiries/{inquiry_id}', auth: 'bearer', expectedStatus: 200, schema: 'UpdateInquiryStatusRequest' },

  // 11. Forensic Audit Trail (1)
  E57: { code: 'E57', method: 'GET', path: '/api/v1/audit', auth: 'bearer', expectedStatus: 200, listMode: 'offset' },
});

