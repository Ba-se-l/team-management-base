// static/js/contracts/enums.js — Exact parity with src/database/enums.py + i18n tEnum integration
import { tEnum } from '../core/i18n.js';

export const UserStatus = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline',
  BUSY: 'busy',
});

export const TeamRole = Object.freeze({
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  VIEWER: 'viewer',
});

// Backward compatibility alias matching src/database/enums.py
export const UserRoles = TeamRole;

export const ProjectStatus = Object.freeze({
  PLANNING: 'planning',
  ACTIVE: 'active',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
});

export const ProjectVisibility = Object.freeze({
  PRIVATE: 'private',
  PENDING_REVIEW: 'pending_review',
  PUBLIC: 'public',
});

export const TaskStatus = Object.freeze({
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  IN_REVIEW: 'in_review',
  DONE: 'done',
  ARCHIVED: 'archived',
});

export const TaskPriority = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

export const JobTitle = Object.freeze({
  BACKEND_DEVELOPER: 'backend_developer',
  FRONTEND_DEVELOPER: 'frontend_developer',
  FULLSTACK_DEVELOPER: 'fullstack_developer',
  MOBILE_DEVELOPER: 'mobile_developer',
  UI_UX_DESIGNER: 'ui_ux_designer',
  DEVOPS_ENGINEER: 'devops_engineer',
  SOFTWARE_ENGINEER: 'software_engineer',
  STUDENT: 'student',
});

export const TechnologyCategory = Object.freeze({
  LANGUAGE: 'language',
  BACKEND: 'backend',
  FRONTEND: 'frontend',
  MOBILE: 'mobile',
  DATABASE: 'database',
  DEVOPS: 'devops',
  DESIGN: 'design',
  TOOL: 'tool',
});

export const InquiryServiceType = Object.freeze({
  WEB_APP: 'web_app',
  MOBILE_APP: 'mobile_app',
  BACKEND_API: 'backend_api',
  UI_UX: 'ui_ux',
  CONSULTATION: 'consultation',
  JOIN_REQUEST: 'join_request',
  OTHER: 'other',
});

export const InquiryStatus = Object.freeze({
  NEW: 'new',
  IN_REVIEW: 'in_review',
  RESPONDED: 'responded',
  CONVERTED: 'converted',
  CLOSED: 'closed',
  SPAM: 'spam',
});

export const AuditAction = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  DEACTIVATE: 'deactivate',
  STATUS_CHANGE: 'status_change',
  VISIBILITY_CHANGE: 'visibility_change',
  ROLE_CHANGE: 'role_change',
  MEMBER_ADD: 'member_add',
  MEMBER_REMOVE: 'member_remove',
  LOGIN: 'login',
});

export function formatEnumLabel(groupName, value) {
  if (!value) return '—';
  return tEnum(groupName, value);
}

export function getBadgeVariantForValue(value) {
  const val = String(value || '').toLowerCase();
  if (['online', 'active', 'completed', 'done', 'public', 'converted', 'responded'].includes(val)) {
    return 'badge-success';
  }
  if (['busy', 'on_hold', 'pending_review', 'in_progress', 'in_review', 'high', 'new'].includes(val)) {
    return 'badge-warning';
  }
  if (['critical', 'spam', 'false'].includes(val)) {
    return 'badge-danger';
  }
  if (['admin', 'planning', 'medium', 'developer'].includes(val)) {
    return 'badge-brand';
  }
  return '';
}
