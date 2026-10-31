// static/js/app.js — Maestro Application Bootstrap & 18-Screen Router Orchestrator
import { store } from './core/store.js';
import { sessionManager } from './core/session.js';
import { capabilities } from './core/capabilities.js';
import { HashRouter } from './core/router.js';
import { ui, escapeHtml } from './core/ui.js';
import { i18n, t } from './core/i18n.js';
import { renderIcon } from './components/icon.js';
import { renderAvatar, initGlobalAvatarFallbackHandler } from './components/avatar.js';
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
  { code: 'P01', pattern: '/', shell: 'public', guard: 'public', titleKey: 'routes.P01', title: 'الرئيسية ونظرة عامة', mount: mountPublicHomePage },
  { code: 'P02', pattern: '/projects', shell: 'public', guard: 'public', titleKey: 'routes.P02', title: 'كتالوج المشاريع العامة', mount: mountPublicProjectsPage },
  { code: 'P03', pattern: '/projects/:slug', shell: 'public', guard: 'public', titleKey: 'routes.P03', title: 'تفاصيل مشروع عام', mount: mountPublicProjectDetailPage },
  { code: 'P04', pattern: '/members', shell: 'public', guard: 'public', titleKey: 'routes.P04', title: 'دليل الكفاءات العام', mount: mountPublicMembersPage },
  { code: 'P05', pattern: '/contact', shell: 'public', guard: 'public', titleKey: 'routes.P05', title: 'تواصل معنا / طلب مشروع', mount: mountPublicContactPage },
  { code: 'P06', pattern: '/login', shell: 'public', guard: 'guestOnly', titleKey: 'routes.P06_LOGIN', title: 'تسجيل الدخول', mount: mountAuthPage },
  { code: 'P06', pattern: '/register', shell: 'public', guard: 'guestOnly', titleKey: 'routes.P06_REGISTER', title: 'إنشاء حساب مطور', mount: mountAuthPage },

  // Authenticated Workspace Shell (P07 - P18)
  { code: 'P07', pattern: '/app/dashboard', shell: 'workspace', guard: 'auth', titleKey: 'routes.P07', title: 'لوحة المطور الرئيسية', mount: mountDashboardPage },
  { code: 'P08', pattern: '/app/teams', shell: 'workspace', guard: 'auth', titleKey: 'routes.P08', title: 'دليل الفرق الهندسية', mount: mountTeamsPage },
  { code: 'P09', pattern: '/app/teams/:teamId', shell: 'workspace', guard: 'auth', titleKey: 'routes.P09', title: 'مساحة عمل الفريق والأعضاء', mount: mountTeamWorkspacePage },
  { code: 'P10', pattern: '/app/projects', shell: 'workspace', guard: 'auth', titleKey: 'routes.P10', title: 'مستكشف المشاريع الموحد', mount: mountProjectsExplorerPage },
  { code: 'P11', pattern: '/app/projects/:projectId', shell: 'workspace', guard: 'auth', titleKey: 'routes.P11', title: 'مساحة عمل المشروع ولوحة كانبان', mount: mountProjectWorkspacePage },
  { code: 'P12', pattern: '/app/my-tasks', shell: 'workspace', guard: 'auth', titleKey: 'routes.P12', title: 'مهامي المسندة عبر المشاريع', mount: mountMyTasksPage },
  { code: 'P13', pattern: '/app/account', shell: 'workspace', guard: 'auth', titleKey: 'routes.P13', title: 'إعدادات الحساب والأمان', mount: mountAccountPage },
  { code: 'P14', pattern: '/app/admin/users', shell: 'workspace', guard: 'adminOrTeamAdmin', titleKey: 'routes.P14', title: 'دليل وإدارة مستخدمي المنصة', mount: mountAdminUsersPage },
  { code: 'P15', pattern: '/app/technologies', shell: 'workspace', guard: 'auth', titleKey: 'routes.P15', title: 'كتالوج التقنيات القياسي', mount: mountTechnologiesCatalogPage },
  { code: 'P16', pattern: '/app/admin/inquiries', shell: 'workspace', guard: 'superAdmin', titleKey: 'routes.P16', title: 'صندوق فرز الاستفسارات', mount: mountAdminInquiriesPage },
  { code: 'P17', pattern: '/app/admin/audit', shell: 'workspace', guard: 'superAdmin', titleKey: 'routes.P17', title: 'سجل التدقيق الجنائي', mount: mountAdminAuditPage },
  { code: 'P18', pattern: '/app/diagnostics', shell: 'workspace', guard: 'auth', titleKey: 'routes.P18', title: 'مختبر العقود والتشخيص', mount: mountDiagnosticsPage },
]);

function decorateShellIcons() {
  // Inject unified Lucide icons into sidebar links once or on language update
  document.querySelectorAll('[data-nav-icon]').forEach((link) => {
    const iconName = link.getAttribute('data-nav-icon');
    const mainSpan = link.querySelector('.sidebar-link-main');
    if (mainSpan && !mainSpan.querySelector('.icon')) {
      mainSpan.insertAdjacentHTML('afterbegin', renderIcon(iconName, { size: 17 }));
    }
  });

  const openBtn = document.getElementById('sidebar-open-btn');
  if (openBtn) {
    openBtn.innerHTML = `${renderIcon('menu', { size: 16 })} <span>${escapeHtml(t('nav.openMenu'))}</span>`;
  }
  const closeBtn = document.getElementById('sidebar-close-btn');
  if (closeBtn) {
    closeBtn.innerHTML = renderIcon('x', { size: 16 });
  }
  const accountLink = document.getElementById('topbar-account-link');
  if (accountLink) {
    accountLink.innerHTML = `${renderIcon('user', { size: 15 })} <span>${escapeHtml(t('nav.myAccount'))}</span>`;
  }
  const logoutBtn = document.getElementById('topbar-logout-btn');
  if (logoutBtn) {
    logoutBtn.innerHTML = `${renderIcon('log-out', { size: 15 })} <span>${escapeHtml(t('nav.logout'))}</span>`;
  }

  ['public-lang-toggle-btn', 'workspace-lang-toggle-btn'].forEach((btnId) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.innerHTML = `
        ${renderIcon('languages', { size: 15 })}
        <span class="lang-switcher-badge">${escapeHtml(t('app.langSwitchShort'))}</span>
        <span>${escapeHtml(t('app.langSwitchLabel'))}</span>
      `;
    }
  });
}

function syncNavigationChrome(activeRoute = null, activePathname = '/') {
  const state = store.getState();
  const isAuth = capabilities.isAuthenticated(state);
  const isSuper = capabilities.isSuperAdmin(state);
  const canReadUsers = capabilities.canReadUserDirectory(state);

  i18n.applyDomTranslations(document);
  decorateShellIcons();

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
      publicCta.innerHTML = `<span>${escapeHtml(t('nav.workspaceReturn'))}</span> ${renderIcon('arrow-right', { size: 15 })}`;
    } else {
      publicCta.href = '#/login';
      publicCta.innerHTML = `${renderIcon('lock', { size: 15 })} <span>${escapeHtml(t('nav.developerPortal'))}</span>`;
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

  // Update User Summary & Avatar in Sidebar & Topbar
  const userSummary = document.getElementById('sidebar-user-summary');
  if (userSummary && state.user) {
    userSummary.innerHTML = `
      <div class="avatar-row">
        ${renderAvatar(state.user, { size: 'md' })}
        <div class="avatar-meta">
          <div class="avatar-name">${escapeHtml(state.user.name || state.user.username)}</div>
          <div class="avatar-sub mono">@${escapeHtml(state.user.username)}</div>
        </div>
      </div>
    `;
  }

  const topbarAvatar = document.getElementById('topbar-user-avatar');
  if (topbarAvatar) {
    topbarAvatar.innerHTML = state.user ? renderAvatar(state.user, { size: 'sm' }) : '';
  }

  const roleBadge = document.getElementById('topbar-role-badge');
  if (roleBadge) {
    roleBadge.textContent = isSuper
      ? t('roles.superAdmin')
      : capabilities.isAnyTeamAdmin(state)
      ? t('roles.teamAdmin')
      : t('roles.developer');
  }

  const breadcrumb = document.getElementById('workspace-breadcrumb');
  if (breadcrumb && activeRoute) {
    const localizedTitle = activeRoute.titleKey ? t(activeRoute.titleKey) : activeRoute.title;
    breadcrumb.textContent = `${activeRoute.code} — ${localizedTitle}`;
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

  i18n.syncDocumentDirection();
  initGlobalAvatarFallbackHandler();

  sessionManager.init((reason) => {
    if (reason && window.location.hash.startsWith('#/app/')) {
      ui.toast(t('errors.sessionExpiredTab'), 'warning');
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

  // Bind Language Switchers (Instant AR/EN Toggle without Page Reload)
  ['public-lang-toggle-btn', 'workspace-lang-toggle-btn'].forEach((btnId) => {
    document.getElementById(btnId)?.addEventListener('click', () => {
      i18n.toggleLanguage();
    });
  });

  i18n.onLanguageChange(async (_lang, restoreForms) => {
    const matched = router.matchRoute(window.location.hash || '#/');
    syncNavigationChrome(matched?.route || null, matched?.pathname || '/');
    refreshPublicHealthStrip();
    await router.resolve({ preserveOverlays: true });
    restoreForms();
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
    ui.toast(t('errors.logoutSuccess'), 'info');
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
