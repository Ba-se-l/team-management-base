// static/js/core/ui.js — Safe DOM Escaping, Accessible Modals, Drawers, Toasts & Pagination
import { formatEnumLabel, getBadgeVariantForValue } from '../contracts/enums.js';

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return escapeHtml(isoString);
  return date.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ui = {
  escapeHtml,
  formatDateTime,

  renderBadge(groupName, value) {
    if (value === null || value === undefined || value === '') return '<span class="badge">—</span>';
    const label = groupName ? formatEnumLabel(groupName, value) : String(value);
    const variant = getBadgeVariantForValue(value);
    return `<span class="badge ${variant}">${escapeHtml(label)}</span>`;
  },

  renderBooleanBadge(boolVal, trueLabel = 'نشط (Active)', falseLabel = 'معطل (Inactive)') {
    return boolVal
      ? `<span class="badge badge-success">${escapeHtml(trueLabel)}</span>`
      : `<span class="badge badge-danger">${escapeHtml(falseLabel)}</span>`;
  },

  renderLoadingSkeleton(message = 'جاري تحميل البيانات من الخادم...') {
    return `
      <div class="card" aria-busy="true">
        <div class="page-header-actions">
          <span class="badge badge-brand">يرجى الانتظار</span>
          <strong>${escapeHtml(message)}</strong>
        </div>
      </div>
    `;
  },

  renderEmptyState(title, subtitle = '', actionHtml = '') {
    return `
      <div class="empty-state">
        <h3>${escapeHtml(title)}</h3>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
        ${actionHtml ? `<div style="margin-top:0.5rem;">${actionHtml}</div>` : ''}
      </div>
    `;
  },

  renderErrorState(message, showRetry = true) {
    return `
      <div class="alert-banner alert-danger" role="alert">
        <div>
          <strong>تعذر إتمام العملية:</strong> ${escapeHtml(message)}
        </div>
        ${
          showRetry
            ? `<button type="button" class="btn btn-sm btn-outline" data-action="retry-view">إعادة المحاولة</button>`
            : ''
        }
      </div>
    `;
  },

  bindRetryButtons(container, onRetry) {
    if (!container || typeof onRetry !== 'function') return;
    container.querySelectorAll('[data-action="retry-view"]').forEach((btn) => {
      btn.addEventListener('click', onRetry);
    });
  },

  applyFieldErrors(formElement, fieldErrors = {}) {
    if (!formElement) return;
    formElement.querySelectorAll('.field-error').forEach((el) => el.remove());
    formElement.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));

    for (const [fieldName, errMsg] of Object.entries(fieldErrors)) {
      const input = formElement.querySelector(`[name="${fieldName}"]`);
      if (input) {
        input.classList.add('is-invalid');
        const errSpan = document.createElement('div');
        errSpan.className = 'field-error';
        errSpan.textContent = String(errMsg);
        input.insertAdjacentElement('afterend', errSpan);
      }
    }
  },

  renderPaginationBar(pageModel, prefix = 'page') {
    const { offset, limit, total, hasMore, items } = pageModel;
    const currentStart = items.length > 0 ? offset + 1 : 0;
    const currentEnd = offset + items.length;
    const hasPrev = offset > 0;

    return `
      <div class="pagination-bar" data-pagination="${escapeHtml(prefix)}">
        <div>
          عرض <strong>${currentStart}–${currentEnd}</strong> من إجمالي <strong>${total}</strong> سجل
        </div>
        <div class="page-header-actions">
          <button type="button" class="btn btn-sm btn-outline" data-page-dir="prev" ${
            hasPrev ? '' : 'disabled'
          }>السابق</button>
          <button type="button" class="btn btn-sm btn-outline" data-page-dir="next" ${
            hasMore ? '' : 'disabled'
          }>التالي</button>
        </div>
      </div>
    `;
  },

  bindPaginationBar(container, pageModel, onPageChange, prefix = 'page') {
    if (!container) return;
    const bar = container.querySelector(`[data-pagination="${prefix}"]`);
    if (!bar) return;

    const prevBtn = bar.querySelector('[data-page-dir="prev"]');
    const nextBtn = bar.querySelector('[data-page-dir="next"]');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        const nextOffset = Math.max(0, pageModel.offset - pageModel.limit);
        onPageChange(nextOffset);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (pageModel.hasMore) {
          onPageChange(pageModel.offset + pageModel.limit);
        }
      });
    }
  },

  toast(message, type = 'info', durationMs = 4500) {
    const root = document.getElementById('toast-root');
    if (!root) return;

    const item = document.createElement('div');
    item.className = `toast-item toast-${type}`;
    item.innerHTML = `
      <div>${escapeHtml(message)}</div>
      <button type="button" class="btn btn-sm btn-outline" aria-label="إغلاق التنبيه">✕</button>
    `;

    const closeBtn = item.querySelector('button');
    const remove = () => {
      if (item.parentNode) item.parentNode.removeChild(item);
    };
    closeBtn.addEventListener('click', remove);
    root.appendChild(item);

    if (durationMs > 0) {
      window.setTimeout(remove, durationMs);
    }
  },

  openModal({ title, bodyHtml, footerHtml = '', onMount = null }) {
    const root = document.getElementById('modal-root');
    if (!root) return;

    root.innerHTML = `
      <div class="overlay-backdrop" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3>${escapeHtml(title)}</h3>
            <button type="button" class="btn btn-sm btn-outline" data-close-modal="true" aria-label="إغلاق النافذة">✕</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
        </div>
      </div>
    `;

    const backdrop = root.querySelector('.overlay-backdrop');
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop || e.target.closest('[data-close-modal="true"]')) {
        this.closeModal();
      }
    });

    if (typeof onMount === 'function') {
      onMount(root.querySelector('.modal-dialog'));
    }
  },

  closeModal() {
    const root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
  },

  openDrawer({ title, bodyHtml, footerHtml = '', onMount = null }) {
    const root = document.getElementById('drawer-root');
    if (!root) return;

    root.innerHTML = `
      <div class="drawer-backdrop" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="drawer-panel">
          <div class="drawer-header">
            <h3>${escapeHtml(title)}</h3>
            <button type="button" class="btn btn-sm btn-outline" data-close-drawer="true" aria-label="إغلاق الدرج">✕</button>
          </div>
          <div class="drawer-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="drawer-footer">${footerHtml}</div>` : ''}
        </div>
      </div>
    `;

    const backdrop = root.querySelector('.drawer-backdrop');
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop || e.target.closest('[data-close-drawer="true"]')) {
        this.closeDrawer();
      }
    });

    if (typeof onMount === 'function') {
      onMount(root.querySelector('.drawer-panel'));
    }
  },

  closeDrawer() {
    const root = document.getElementById('drawer-root');
    if (root) root.innerHTML = '';
  },
};
