// static/js/core/capabilities.js — Global SuperAdmin, Scoped TeamRole & Task ABAC Engine
import { TeamRole, ProjectVisibility } from '../contracts/enums.js';

export const capabilities = {
  isAuthenticated(state) {
    return Boolean(state?.user?.id && state?.session?.accessToken);
  },

  isSuperAdmin(state) {
    return Boolean(state?.user?.is_super_admin);
  },

  getTeamMembership(state, teamId) {
    if (!state?.memberships || !teamId) return null;
    const numericId = Number(teamId);
    return (
      state.memberships.find((m) => Number(m.team_id) === numericId) || null
    );
  },

  getTeamRole(state, teamId) {
    if (this.isSuperAdmin(state)) return TeamRole.ADMIN;
    const membership = this.getTeamMembership(state, teamId);
    return membership ? String(membership.role).toLowerCase() : null;
  },

  isAnyTeamAdmin(state) {
    if (this.isSuperAdmin(state)) return true;
    return (state?.memberships || []).some(
      (m) => String(m.role).toLowerCase() === TeamRole.ADMIN
    );
  },

  // E15 GET /api/v1/users/ is open to Super Admin OR any Team Admin
  canReadUserDirectory(state) {
    return this.isSuperAdmin(state) || this.isAnyTeamAdmin(state);
  },

  // E09 POST /api/v1/users is strictly Super Admin
  canCreatePlatformUser(state) {
    return this.isSuperAdmin(state);
  },

  // E16 POST /api/v1/teams is open to ANY authenticated user
  canCreateTeam(state) {
    return this.isAuthenticated(state);
  },

  // E19, E20, E21, E23, E24, E25, E29, E30 require Super Admin or Team ADMIN
  canManageTeam(state, teamId) {
    if (this.isSuperAdmin(state)) return true;
    return this.getTeamRole(state, teamId) === TeamRole.ADMIN;
  },

  canManageProject(state, teamId) {
    return this.canManageTeam(state, teamId);
  },

  // Project Visibility Governance (RBAC-01):
  // Team Admin can set PRIVATE or PENDING_REVIEW; only Super Admin can set PUBLIC.
  getAllowedProjectVisibilities(state, teamId) {
    if (this.isSuperAdmin(state)) {
      return [
        ProjectVisibility.PRIVATE,
        ProjectVisibility.PENDING_REVIEW,
        ProjectVisibility.PUBLIC,
      ];
    }
    if (this.canManageProject(state, teamId)) {
      return [
        ProjectVisibility.PRIVATE,
        ProjectVisibility.PENDING_REVIEW,
      ];
    }
    return [ProjectVisibility.PRIVATE];
  },

  // E31 POST /api/v1/projects/{project_id}/tasks: Team Admin or Developer
  canCreateTask(state, teamId) {
    if (this.isSuperAdmin(state)) return true;
    const role = this.getTeamRole(state, teamId);
    return role === TeamRole.ADMIN || role === TeamRole.DEVELOPER;
  },

  // E36 PATCH /api/v1/tasks/{task_id} & E38 PATCH /api/v1/tasks/{task_id}/move
  // Developer ABAC: allowed if unassigned (assignee_to_id === null), assigned to self, or created by self
  canModifyOrMoveTask(state, teamId, task) {
    if (!task) return false;
    if (this.isSuperAdmin(state)) return true;
    const role = this.getTeamRole(state, teamId);
    if (role === TeamRole.ADMIN) return true;
    if (role === TeamRole.DEVELOPER) {
      const currentUserId = Number(state?.user?.id);
      return (
        task.assignee_to_id === null ||
        task.assignee_to_id === undefined ||
        Number(task.assignee_to_id) === currentUserId ||
        Number(task.creator_id) === currentUserId
      );
    }
    return false;
  },

  // E37 DELETE /api/v1/tasks/{task_id}: Super Admin or Team Admin
  canDeleteTask(state, teamId) {
    return this.canManageTeam(state, teamId);
  },

  // E39 POST /api/v1/tasks/{task_id}/comments: Super Admin, Team Admin, or Developer
  canCommentOnTask(state, teamId) {
    if (this.isSuperAdmin(state)) return true;
    const role = this.getTeamRole(state, teamId);
    return role === TeamRole.ADMIN || role === TeamRole.DEVELOPER;
  },

  // E40 & E41 DELETE comment: Author (while active in team) OR Team Admin OR Super Admin
  canDeleteComment(state, teamId, comment) {
    if (!comment) return false;
    if (this.canManageTeam(state, teamId)) return true;
    const role = this.getTeamRole(state, teamId);
    if (!role) return false;
    return Number(comment.author_id) === Number(state?.user?.id);
  },

  // E42, E46, E47 Technology Catalog Writes: Super Admin only
  canMutateTechnologyCatalog(state) {
    return this.isSuperAdmin(state);
  },
};

