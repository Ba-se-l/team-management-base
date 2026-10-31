// static/js/core/router.js — Hash Router with Dynamic Params, Guards & Stale Request Cancellation
import { store } from './store.js';
import { capabilities } from './capabilities.js';
import { createLifecycleScope } from './lifecycle.js';
import { t } from './i18n.js';
import { ui } from './ui.js';

export class HashRouter {
  constructor(routes, onRouteResolved) {
    this.routes = routes;
    this.onRouteResolved = onRouteResolved;
    this.currentScope = null;
    this.navigationGeneration = 0;
  }

  start() {
    window.addEventListener('hashchange', () => this.resolve());
    this.resolve();
  }

  navigate(hash) {
    const target = hash.startsWith('#') ? hash : `#${hash}`;
    if (window.location.hash === target) {
      this.resolve();
    } else {
      window.location.hash = target;
    }
  }

  matchRoute(rawHash) {
    const clean = (rawHash || '#/').replace(/^#/, '') || '/';
    const [pathnameRaw, queryString] = clean.split('?');
    const pathname = pathnameRaw.startsWith('/') ? pathnameRaw : `/${pathnameRaw}`;
    const query = Object.fromEntries(new URLSearchParams(queryString || ''));

    for (const route of this.routes) {
      const paramNames = [];
      const patternRegex =
        '^' +
        route.pattern.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
          paramNames.push(paramName);
          return '([^/]+)';
        }) +
        '$';

      const match = pathname.match(new RegExp(patternRegex));
      if (match) {
        const params = {};
        paramNames.forEach((name, idx) => {
          params[name] = decodeURIComponent(match[idx + 1]);
        });
        return { route, params, query, pathname };
      }
    }

    return null;
  }

  async resolve(options = {}) {
    const { preserveOverlays = false } = options;
    const navGen = ++this.navigationGeneration;
    if (this.currentScope) {
      this.currentScope.dispose();
      this.currentScope = null;
    }

    if (!preserveOverlays) {
      ui.closeModal();
      ui.closeDrawer();
    }

    const matched = this.matchRoute(window.location.hash || '#/');
    if (!matched) {
      this.navigate('#/');
      return;
    }

    const { route, params, query, pathname } = matched;
    const state = store.getState();

    // Enforce Route Guards
    if (route.guard === 'auth' && !capabilities.isAuthenticated(state)) {
      ui.toast(t('errors.guardAuth'), 'warning');
      this.navigate('#/login');
      return;
    }
    if (route.guard === 'guestOnly' && capabilities.isAuthenticated(state)) {
      this.navigate('#/app/dashboard');
      return;
    }
    if (route.guard === 'superAdmin' && !capabilities.isSuperAdmin(state)) {
      if (!capabilities.isAuthenticated(state)) {
        this.navigate('#/login');
      } else {
        ui.toast(t('errors.guardSuperAdmin'), 'error');
        this.navigate('#/app/dashboard');
      }
      return;
    }
    if (route.guard === 'adminOrTeamAdmin' && !capabilities.canReadUserDirectory(state)) {
      if (!capabilities.isAuthenticated(state)) {
        this.navigate('#/login');
      } else {
        ui.toast(t('errors.guardUserDirectory'), 'error');
        this.navigate('#/app/dashboard');
      }
      return;
    }

    if (typeof this.onRouteResolved === 'function') {
      this.onRouteResolved(route, pathname);
    }

    const scope = createLifecycleScope();
    this.currentScope = scope;

    const rootContainer =
      route.shell === 'workspace'
        ? document.getElementById('workspace-view-root')
        : document.getElementById('public-view-root');

    try {
      await route.mount({
        container: rootContainer,
        params,
        query,
        scope,
        router: this,
        isStale: () => navGen !== this.navigationGeneration || scope.signal.aborted,
      });
    } catch (error) {
      if (scope.signal.aborted || navGen !== this.navigationGeneration) {
        return;
      }
      if (rootContainer) {
        rootContainer.innerHTML = ui.renderErrorState(
          error?.message || t('common.errorPrefix'),
          true
        );
        ui.bindRetryButtons(rootContainer, () => this.resolve());
      }
    }
  }
}
