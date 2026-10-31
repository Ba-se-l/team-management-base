// static/js/app.js — Maestro Application Bootstrap & 18-Screen Router Orchestrator
import { store } from './core/store.js';
import { sessionManager } from './core/session.js';
import { capabilities } from './core/capabilities.js';
import { HashRouter } from './core/router.js';
import { ui, escapeHtml } from './core/ui.js';
import { authService } from './services/auth.js';

import {
  mountPublicHomePage,
  mountPublicProjectsPage,
  mountPublicProjectDetailPage,
  mountPublicMembersPage,
  mountPublicContactPage,
  mountAuthPage,
  refreshPublicHealthStrip,
} from './pages/public-pages.js';
import {
  mountDashboardPage,
  mountMyTasksPage,
  mountAccountPage,
} from './pages/workspace-home-pages.js';
import {
  mountTeamsPage,
  mountTeamWorkspacePage,
} from './pages/teams-pages.js';
import {
  mountProjectsExplorerPage,
  mountProjectWorkspacePage,
} from './pages/projects-tasks-pages.js';
import {
  mountAdminUsersPage,
  mountTechnologiesCatalogPage,
  mountAdminInquiriesPage,
  mountAdminAuditPage,
} from './pages/admin-pages.js';
import { mountDiagnosticsPage } from './pages/diagnostics-page.js';

export const APP_ROUTES = Object.freeze([
  // Public Portal Shell (P01 - P06)
  { code: 'P01', pattern: '/', shell: 'public', guard: 'public', title: 'الرئيسية ونظرة عامة', mount: mountPublicHomePage },
  { code: 'P02', pattern: '/projects', shell: 'public', guard: 'public', title: 'كتالوج المشاريع العامة', mount: mountPublicProjectsPage },
  { code: 'P03', pattern: '/projects/:slug', shell: 'public', guard: 'public', title: 'تفاصيل مشروع عام', mount: mountPublicProjectDetailPage },
  { code: 'P04', pattern: '/members', shell: 'public', guard: 'public', title: 'دليل الكفاءات العام', mount: mountPublicMembersPage },
  { code: 'P05', pattern: '/contact', shell: 'public', guard: 'public', title: 'تواصل معنا / طلب مشروع', mount: mountPublicContactPage },
  { code: 'P06', pattern: '/login', shell: 'public', guard: 'guestOnly', title: 'تسجيل الدخول', mount: mountAuthPage },
  { code: 'P06', pattern: '/register', shell: 'public', guard: 'guestOnly', title: 'إنشاء حساب مطور', mount: mountAuthPage },

  // Authenticated Workspace Shell (P07 - P18)
  { code: 'P07', pattern: '/app/dashboard', shell: 'workspace', guard: 'auth', title: 'لوحة المطور الرئيسية', mount: mountDashboardPage },
  { code: 'P08', pattern: '/app/teams', shell: 'workspace', guard: 'auth', title: 'دليل الفرق الهندسية', mount: mountTeamsPage },
  { code: 'P09', pattern: '/app/teams/:teamId', shell: 'workspace', guard: 'auth', title: 'مساحة عمل الفريق والأعضاء', mount: mountTeamWorkspacePage },
  { code: 'P10', pattern: '/app/projects', shell: 'workspace', guard: 'auth', title: 'مستكشف المشاريع الموحد', mount: mountProjectsExplorerPage },
  { code: 'P11', pattern: '/app/projects/:projectId', shell: 'workspace', guard: 'auth', title: 'مساحة عمل المشروع ولوحة كانبان', mount: mountProjectWorkspacePage },
  { code: 'P12', pattern: '/app/my-tasks', shell: 'workspace', guard: 'auth', title: 'مهامي المسندة عبر المشاريع', mount: mountMyTasksPage },
  { code: 'P13', pattern: '/app/account', shell: 'workspace', guard: 'auth', title: 'إعدادات الحساب والأمان', mount: mountAccountPage },
  { code: 'P14', pattern: '/app/admin/users', shell: 'workspace', guard: 'adminOrTeamAdmin', title: 'دليل وإدارة مستخدمي المنصة', mount: mountAdminUsersPage },
  { code: 'P15', pattern: '/app/technologies', shell: 'workspace', guard: 'auth', title: 'كتالوج التقنيات القياسي', mount: mountTechnologiesCatalogPage },
  { code: 'P16', pattern: '/app/admin/inquiries', shell: 'workspace', guard: 'superAdmin', title: 'صندوق فرز الاستفسارات', mount: mountAdminInquiriesPage },
  { code: 'P17', pattern: '/app/admin/audit', shell: 'workspace', guard: 'superAdmin', title: 'سجل التدقيق الجنائي', mount: mountAdminAuditPage },
  { code: 'P18', pattern: '/app/diagnostics', shell: 'workspace', guard: 'auth', title: 'مختبر العقود والتشخيص', mount: mountDiagnosticsPage },
]);

function syncNavigationChrome(activeRoute = null, activePathname = '/') {
  const state = store.getState();
  const isAuth = capabilities.isAuthenticated(state);
  const isSuper = capabilities.isSuperAdmin(state);
  const canReadUsers = capabilities.canReadUserDirectory(state);

  const publicShell = document.getElementById('public-shell');
  const workspaceShell = document.getElementById('workspace-shell');

  if (activeRoute?.shell === 'workspace') {
    publicShell?.classList.add('hidden');
    workspaceShell?.classList.remove('hidden');
  } else if (activeRoute?.shell === 'public') {
    workspaceShell?.classList.add('hidden');
    publicShell?.classList.remove('hidden');
  }

  // Update Public Header CTA
  const publicCta = document.getElementById('public-auth-cta');
  if (publicCta) {
    if (isAuth) {
      publicCta.href = '#/app/dashboard';
      publicCta.textContent = 'لوحة العمل الداخلية ←';
    } else {
      publicCta.href = '#/login';
      publicCta.textContent = 'بوابة المطورين';
    }
  }

  // Update Sidebar Admin Group Visibility
  const adminGroup = document.getElementById('sidebar-admin-group');
  const navUsers = document.getElementById('nav-item-users');
  const navInquiries = document.getElementById('nav-item-inquiries');
  const navAudit = document.getElementById('nav-item-audit');

  if (adminGroup) {
    if (canReadUsers || isSuper) {
      adminGroup.classList.remove('hidden');
    } else {
      adminGroup.classList.add('hidden');
    }
  }
  if (navUsers) navUsers.classList.toggle('hidden', !canReadUsers);
  if (navInquiries) navInquiries.classList.toggle('hidden', !isSuper);
  if (navAudit) navAudit.classList.toggle('hidden', !isSuper);

  // Update User Summary in Sidebar & Topbar
  const userSummary = document.getElementById('sidebar-user-summary');
  if (userSummary && state.user) {
    userSummary.innerHTML = `
      <strong>${escapeHtml(state.user.name || state.user.username)}</strong>
      <span class="field-hint mono">@${escapeHtml(state.user.username)} (${escapeHtml(state.user.email)})</span>
    `;
  }

  const roleBadge = document.getElementById('topbar-role-badge');
  if (roleBadge) {
    roleBadge.textContent = isSuper
      ? 'مدير النظام الأعلى (Super Admin)'
      : capabilities.isAnyTeamAdmin(state)
      ? 'قائد فريق (Team Admin)'
      : 'مطور (Developer)';
  }

  const breadcrumb = document.getElementById('workspace-breadcrumb');
  if (breadcrumb && activeRoute) {
    breadcrumb.textContent = `${activeRoute.code} — ${activeRoute.title}`;
  }

  // Highlight Active Sidebar Link
  document.querySelectorAll('[data-route-link]').forEach((link) => {
    const targetHash = link.getAttribute('data-route-link');
    const cleanTarget = (targetHash || '').replace(/^#/, '');
    const isActive =
      activePathname === cleanTarget ||
      (cleanTarget !== '/app/dashboard' && activePathname.startsWith(`${cleanTarget}/`));
    link.classList.toggle('is-active', isActive);
  });

  // Close mobile sidebar drawer upon navigation
  document.getElementById('workspace-sidebar')?.classList.remove('is-open');
  document.getElementById('sidebar-backdrop')?.classList.remove('is-open');
}

async function bootstrapApp() {
  let router = null;

  sessionManager.init((reason) => {
    if (reason && window.location.hash.startsWith('#/app/')) {
      ui.toast('تم إنهاء الجلسة من تبويب آخر أو انتهت صلاحيتها.', 'warning');
      window.location.hash = '#/login';
    }
  });

  // Hydrate authenticated context if access_token exists in localStorage
  if (sessionManager.getAccessToken()) {
    try {
      await authService.getMe();
    } catch {
      sessionManager.clearSession({ reason: 'bootstrap_invalid', broadcast: false });
    }
  }

  router = new HashRouter(APP_ROUTES, (route, pathname) => {
    syncNavigationChrome(route, pathname);
  });

  store.subscribe(() => {
    const matched = router.matchRoute(window.location.hash || '#/');
    syncNavigationChrome(matched?.route || null, matched?.pathname || '/');
  });

  // Global Event Delegation for Smooth Scrolling without breaking Hash Router (`data-scroll-to`)
  document.addEventListener('click', (e) => {
    const scrollTrigger = e.target.closest('[data-scroll-to]');
    if (scrollTrigger) {
      e.preventDefault();
      const targetId = scrollTrigger.getAttribute('data-scroll-to');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // Responsive Mobile Sidebar Toggle
  const sidebar = document.getElementById('workspace-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  document.getElementById('sidebar-open-btn')?.addEventListener('click', () => {
    sidebar?.classList.add('is-open');
    backdrop?.classList.add('is-open');
  });
  const closeSidebar = () => {
    sidebar?.classList.remove('is-open');
    backdrop?.classList.remove('is-open');
  };
  document.getElementById('sidebar-close-btn')?.addEventListener('click', closeSidebar);
  backdrop?.addEventListener('click', closeSidebar);

  // Topbar Logout Button (E06)
  document.getElementById('topbar-logout-btn')?.addEventListener('click', async () => {
    await authService.logout();
    ui.toast('تم تسجيل الخروج بنجاح (E06).', 'info');
    router.navigate('#/login');
  });

  refreshPublicHealthStrip();
  router.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
}
