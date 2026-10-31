// static/js/contracts/enums.js — Exact parity with src/database/enums.py

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

export const ENUM_LABELS = Object.freeze({
  UserStatus: {
    online: 'متصل (Online)',
    offline: 'غير متصل (Offline)',
    busy: 'مشغول (Busy)',
  },
  TeamRole: {
    admin: 'قائد فريق (Team Admin)',
    developer: 'مطور (Developer)',
    viewer: 'مراقب قراءة فقط (Viewer)',
  },
  ProjectStatus: {
    planning: 'تخطيط (Planning)',
    active: 'نشط قيد التنفيذ (Active)',
    on_hold: 'معلق مؤقتاً (On Hold)',
    completed: 'مكتمل (Completed)',
    archived: 'مؤرشف (Archived)',
  },
  ProjectVisibility: {
    private: 'خاص بالفريق (Private)',
    pending_review: 'مرشح للمراجعة العامة (Pending Review)',
    public: 'عام في المعرض (Public Showcase)',
  },
  TaskStatus: {
    todo: 'قائمة الانتظار (To Do)',
    in_progress: 'قيد التنفيذ (In Progress)',
    in_review: 'قيد المراجعة (In Review)',
    done: 'منجزة (Done)',
    archived: 'مؤرشفة (Archived)',
  },
  TaskPriority: {
    low: 'منخفضة (Low)',
    medium: 'متوسطة (Medium)',
    high: 'عالية (High)',
    critical: 'حرجة (Critical)',
  },
  JobTitle: {
    backend_developer: 'مطور واجهات خلفية (Backend Developer)',
    frontend_developer: 'مطور واجهات أمامية (Frontend Developer)',
    fullstack_developer: 'مطور متكامل (Fullstack Developer)',
    mobile_developer: 'مطور تطبيقات جوال (Mobile Developer)',
    ui_ux_designer: 'مصمم تجربة وواجهات (UI/UX Designer)',
    devops_engineer: 'مهندس بنية وأتمتة (DevOps Engineer)',
    software_engineer: 'مهندس برمجيات (Software Engineer)',
    student: 'طالب متدرب (Student)',
  },
  TechnologyCategory: {
    language: 'لغة برمجة (Language)',
    backend: 'إطار خلفي (Backend)',
    frontend: 'إطار أمامي (Frontend)',
    mobile: 'تطوير جوال (Mobile)',
    database: 'قاعدة بيانات (Database)',
    devops: 'بنية وسحابة (DevOps)',
    design: 'تصميم (Design)',
    tool: 'أداة هندسية (Tool)',
  },
  InquiryServiceType: {
    web_app: 'تطبيق ويب متكامل (Web App)',
    mobile_app: 'تطبيق جوال (Mobile App)',
    backend_api: 'منظومة API وخوادم (Backend API)',
    ui_ux: 'تصميم تجربة المستخدم (UI/UX)',
    consultation: 'استشارة معمارية وتقنية (Consultation)',
    join_request: 'طلب انضمام للفريق (Join Request)',
    other: 'أخرى (Other)',
  },
  InquiryStatus: {
    new: 'جديد (New)',
    in_review: 'قيد المراجعة (In Review)',
    responded: 'تم الرد (Responded)',
    converted: 'تم التحويل لمشروع (Converted)',
    closed: 'مغلق (Closed)',
    spam: 'مرفوض / مزعج (Spam)',
  },
});

export function formatEnumLabel(groupName, value) {
  if (!value) return '—';
  const group = ENUM_LABELS[groupName];
  return (group && group[value]) || String(value);
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

