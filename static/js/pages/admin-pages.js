// static/js/pages/admin-pages.js — Screens P14 (Users), P15 (Technologies), P16 (Inquiries) & P17 (Audit)
import {
  JobTitle,
  TechnologyCategory,
  InquiryStatus,
  InquiryServiceType,
  AuditAction,
  formatEnumLabel,
} from '../contracts/enums.js';
import { normalizeOptionalUrl } from '../contracts/serializers.js';
import { store } from '../core/store.js';
import { capabilities } from '../core/capabilities.js';
import { ui, escapeHtml } from '../core/ui.js';
import { t, tr } from '../core/i18n.js';
import { renderIcon } from '../components/icon.js';
import { renderAvatar, bindLiveAvatarPreview } from '../components/avatar.js';
import { usersService } from '../services/users.js';
import { technologiesService } from '../services/technologies.js';
import { inquiriesService } from '../services/inquiries.js';
import { auditService } from '../services/audit.js';

function renderEnumSelect(enumObj, groupName, selectedVal = '', emptyLabel = '') {
  const opts = [];
  if (emptyLabel) {
    opts.push(`<option value="">${escapeHtml(emptyLabel)}</option>`);
  }
  for (const val of Object.values(enumObj)) {
    const sel = String(val) === String(selectedVal) ? 'selected' : '';
    opts.push(
      `<option value="${escapeHtml(val)}" ${sel}>${escapeHtml(
        formatEnumLabel(groupName, val)
      )}</option>`
    );
  }
  return opts.join('');
}

// ============================================================================
// P14: Users Directory & Platform Provisioning (#/app/admin/users) — E09, E15
// ============================================================================
export async function mountAdminUsersPage({ container, scope, isStale }) {
  let skip = 0;
  const limit = 20;

  const loadDirectory = async () => {
    container.innerHTML = ui.renderLoadingSkeleton(
      tr('جاري تحميل دليل مستخدمي المنصة (E15 — GET /api/v1/users/)...', 'Loading platform user directory (E15 — GET /api/v1/users/)...')
    );
    const pageModel = await usersService.listDirectory({ skip, limit }, scope.signal);
    if (isStale()) return;

    const state = store.getState();
    const isSuperAdmin = capabilities.isSuperAdmin(state);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${escapeHtml(tr('دليل وإدارة مستخدمي المنصة (P14)', 'Platform Users Directory & Provisioning (P14)'))}</h1>
          <p>${escapeHtml(tr('متاح لقادة الفرق ومدير النظام الأعلى (E15). التعديل والتعطيل في V1 ذاتي فقط عبر شاشة الحساب الشخصي.', 'Accessible to Team Admins and Super Admins (E15). Profile updates and deactivation in V1 are self-service via Account Settings.'))}</p>
        </div>
        <div class="page-header-actions">
          ${
            isSuperAdmin
              ? `<button type="button" id="admin-create-user-btn" class="btn btn-primary">${renderIcon('user-plus', { size: 15 })} <span>${escapeHtml(tr('إنشاء مستخدم بالمنصة (E09)', 'Provision Platform User (E09)'))}</span></button>`
              : `<span class="badge">${renderIcon('eye', { size: 13 })} ${escapeHtml(tr('صلاحية قراءة الدليل لقائد الفريق', 'Team Admin Read-Only Directory Access'))}</span>`
          }
        </div>
      </div>

      <div class="table-scroll-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>${escapeHtml(tr('المستخدم', 'User'))}</th>
              <th>${escapeHtml(tr('البريد الإلكتروني', 'Email'))}</th>
              <th>${escapeHtml(tr('التخصص', 'Specialization'))}</th>
              <th>${escapeHtml(tr('الحالة', 'Status'))}</th>
              <th>${escapeHtml(tr('الظهور بالمعرض', 'Public Roster'))}</th>
              <th>${escapeHtml(tr('الصلاحية العليا', 'Platform Role'))}</th>
            </tr>
          </thead>
          <tbody>
            ${pageModel.items
              .map(
                (u) => `
              <tr>
                <td class="mono">#${u.id}</td>
                <td>
                  <div class="avatar-row">
                    ${renderAvatar(u, { size: 'sm' })}
                    <div class="avatar-meta">
                      <strong class="avatar-name">${escapeHtml(u.name)}</strong>
                      <div class="avatar-sub mono">@${escapeHtml(u.username)}</div>
                    </div>
                  </div>
                </td>
                <td>${escapeHtml(u.email)}</td>
                <td>${u.job_title ? ui.renderBadge('JobTitle', u.job_title) : '—'}</td>
                <td>
                  ${ui.renderBooleanBadge(u.is_active)}
                  ${ui.renderBadge('UserStatus', u.status)}
                </td>
                <td>${u.is_public_member ? `<span class="badge badge-success">${escapeHtml(tr('عام (Opt-in)', 'Public (Opt-in)'))}</span>` : `<span class="badge">${escapeHtml(tr('داخلي', 'Internal'))}</span>`}</td>
                <td>${u.is_super_admin ? '<span class="badge badge-brand">Super Admin</span>' : `<span class="badge">${escapeHtml(t('roles.developer'))}</span>`}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
      ${ui.renderPaginationBar(pageModel, 'users-directory')}
    `;

    // Super Admin Create User Modal (E09: 12 fields in CreateUserRequest)
    const createBtn = container.querySelector('#admin-create-user-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        ui.openModal({
          title: tr('إنشاء مستخدم جديد بالمنصة (E09 — CreateUserRequest)', 'Provision New Platform User (E09 — CreateUserRequest)'),
          bodyHtml: `
            <form id="admin-create-user-form" novalidate>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label" for="acu-name">${escapeHtml(tr('الاسم الكامل (name) *', 'Full Name (name) *'))}</label>
                  <input id="acu-name" name="name" type="text" class="form-control" required minlength="1" maxlength="100" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-username">${escapeHtml(tr('اسم المستخدم (username)', 'Username (username)'))}</label>
                  <input id="acu-username" name="username" type="text" class="form-control" minlength="3" maxlength="50" placeholder="${escapeHtml(t('common.optional'))}" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-email">${escapeHtml(tr('البريد الإلكتروني (email) *', 'Email Address (email) *'))}</label>
                  <input id="acu-email" name="email" type="email" class="form-control" required />
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-password">${escapeHtml(tr('كلمة المرور الأولية (password) * (8+ أحرف)', 'Initial Password (password) * (8+ chars)'))}</label>
                  <input id="acu-password" name="password" type="password" class="form-control" required minlength="8" maxlength="100" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-job-title">${escapeHtml(tr('المسمى الوظيفي (job_title)', 'Job Title (job_title)'))}</label>
                  <select id="acu-job-title" name="job_title" class="form-control">
                    ${renderEnumSelect(JobTitle, 'JobTitle', '', tr('— غير محدد —', '— Unspecified —'))}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-avatar-url">${escapeHtml(tr('رابط الصورة (avatar_url)', 'Avatar Image URL (avatar_url)'))}</label>
                  <input id="acu-avatar-url" name="avatar_url" type="url" class="form-control" placeholder="https://..." />
                  <div class="avatar-preview-box">
                    <span id="acu-avatar-preview"></span>
                    <span class="field-hint">${escapeHtml(t('common.avatarPreviewHint'))}</span>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-github-url">${escapeHtml(tr('رابط GitHub (github_url)', 'GitHub URL (github_url)'))}</label>
                  <input id="acu-github-url" name="github_url" type="url" class="form-control" placeholder="https://github.com/..." />
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-linkedin-url">${escapeHtml(tr('رابط LinkedIn (linkedin_url)', 'LinkedIn URL (linkedin_url)'))}</label>
                  <input id="acu-linkedin-url" name="linkedin_url" type="url" class="form-control" placeholder="https://linkedin.com/in/..." />
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-website-url">${escapeHtml(tr('الموقع الشخصي (website_url)', 'Personal Website (website_url)'))}</label>
                  <input id="acu-website-url" name="website_url" type="url" class="form-control" placeholder="https://..." />
                </div>
              </div>

              <div class="form-group" style="margin-block-start:0.85rem;">
                <label class="form-label" for="acu-bio">${escapeHtml(tr('نبذة تعريفية (bio)', 'Professional Bio (bio)'))}</label>
                <textarea id="acu-bio" name="bio" rows="2" class="form-control" maxlength="500"></textarea>
              </div>

              <div class="page-header-actions" style="margin-block-start:0.85rem;">
                <label class="checkbox-row">
                  <input type="checkbox" name="is_super_admin" />
                  <span>${escapeHtml(tr('منح صلاحية مدير النظام الأعلى (is_super_admin)', 'Grant Super Admin Privileges (is_super_admin)'))}</span>
                </label>
                <label class="checkbox-row">
                  <input type="checkbox" name="is_public_member" />
                  <span>${escapeHtml(tr('إظهار في دليل الأعضاء العام (is_public_member)', 'Display in Public Members Roster (is_public_member)'))}</span>
                </label>
              </div>

              <div class="modal-footer" style="margin-block-start:1rem;padding:0;border:none;background:transparent;">
                <button type="button" class="btn btn-outline" data-close-modal="true">${escapeHtml(t('common.cancel'))}</button>
                <button type="submit" id="acu-submit-btn" class="btn btn-primary">${renderIcon('user-plus', { size: 15 })} <span>${escapeHtml(tr('إنشاء المستخدم (E09)', 'Create User (E09)'))}</span></button>
              </div>
            </form>
          `,
          onMount: (dialog) => {
            const form = dialog.querySelector('#admin-create-user-form');
            bindLiveAvatarPreview({
              inputEl: form.querySelector('#acu-avatar-url'),
              nameInputEl: form.querySelector('#acu-name'),
              previewContainerEl: form.querySelector('#acu-avatar-preview'),
              fallbackName: 'TM',
            });

            form.addEventListener('submit', async (e) => {
              e.preventDefault();
              const btn = dialog.querySelector('#acu-submit-btn');
              btn.disabled = true;
              const fd = new FormData(form);
              try {
                const payload = {
                  name: String(fd.get('name') || '').trim(),
                  email: String(fd.get('email') || '').trim().toLowerCase(),
                  password: String(fd.get('password') || ''),
                  username: String(fd.get('username') || '').trim() || null,
                  job_title: String(fd.get('job_title') || '') || null,
                  bio: String(fd.get('bio') || '').trim() || null,
                  avatar_url: normalizeOptionalUrl(fd.get('avatar_url')),
                  github_url: normalizeOptionalUrl(fd.get('github_url')),
                  linkedin_url: normalizeOptionalUrl(fd.get('linkedin_url')),
                  website_url: normalizeOptionalUrl(fd.get('website_url')),
                  is_super_admin: fd.get('is_super_admin') === 'on',
                  is_public_member: fd.get('is_public_member') === 'on',
                };
                const created = await usersService.createByAdmin(payload);
                ui.closeModal();
                ui.toast(
                  tr(
                    `تم إنشاء المستخدم "${created.name}" (#${created.id}) بنجاح (E09).`,
                    `User "${created.name}" (#${created.id}) created successfully (E09).`
                  ),
                  'success'
                );
                loadDirectory();
              } catch (err) {
                ui.applyFieldErrors(form, err.fieldErrors);
                ui.toast(err.message || tr('تعذر إنشاء المستخدم.', 'Failed to create user.'), 'error');
                btn.disabled = false;
              }
            });
          },
        });
      });
    }

    ui.bindPaginationBar(
      container,
      pageModel,
      (nextOffset) => {
        skip = nextOffset;
        loadDirectory();
      },
      'users-directory'
    );
  };

  await loadDirectory();
}

// ============================================================================
// P15: Technology Catalog (#/app/technologies) — E42, E43, E44, E45, E46, E47
// ============================================================================
export async function mountTechnologiesCatalogPage({ container, scope, isStale }) {
  const searchState = {
    q: '',
    category: '',
    skip: 0,
    limit: 30,
    isSearchMode: false,
  };

  const loadCatalog = async () => {
    container.innerHTML = ui.renderLoadingSkeleton(
      tr('جاري تحميل كتالوج التقنيات...', 'Loading technologies catalog...')
    );

    const pageModel = searchState.isSearchMode
      ? await technologiesService.search(
          {
            q: searchState.q,
            category: searchState.category,
            skip: searchState.skip,
            limit: searchState.limit,
          },
          scope.signal
        )
      : await technologiesService.list(
          {
            skip: searchState.skip,
            limit: searchState.limit,
          },
          scope.signal
        );

    if (isStale()) return;

    const canMutate = capabilities.canMutateTechnologyCatalog(store.getState());

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${escapeHtml(tr('كتالوج التقنيات القياسي (P15)', 'Standardized Technology Catalog (P15)'))}</h1>
          <p>${escapeHtml(tr('استعراض التقنيات المعتمدة (E43)، البحث الفوري (E44)، ومعاينة التفاصيل (E45). الإضافة والتعديل والحذف محصور بـ Super Admin (E42/E46/E47).', 'Browse approved technologies (E43), live search (E44), and inspect details (E45). Creation, updates, and deletion are restricted to Super Admin (E42/E46/E47).'))}</p>
        </div>
        <div class="page-header-actions">
          ${
            canMutate
              ? `<button type="button" id="tech-create-modal-btn" class="btn btn-primary">${renderIcon('plus', { size: 15 })} <span>${escapeHtml(tr('إضافة تقنية للكتالوج (E42)', 'Add Technology to Catalog (E42)'))}</span></button>`
              : ''
          }
        </div>
      </div>

      <form id="tech-catalog-search-form" class="filter-bar">
        <div class="form-group">
          <label class="form-label" for="tech-q">${escapeHtml(tr('البحث بالاسم أو المعرف (E44 q)', 'Search by Name or Slug (E44 q)'))}</label>
          <input id="tech-q" name="q" type="text" class="form-control" value="${escapeHtml(searchState.q)}" placeholder="Python, C++, FastAPI..." />
        </div>
        <div class="form-group">
          <label class="form-label" for="tech-cat">${escapeHtml(tr('الفئة التقنية (E44 category)', 'Technology Category (E44 category)'))}</label>
          <select id="tech-cat" name="category" class="form-control">
            ${renderEnumSelect(TechnologyCategory, 'TechnologyCategory', searchState.category, tr('كل الفئات', 'All Categories'))}
          </select>
        </div>
        <div class="page-header-actions">
          <button type="submit" class="btn btn-primary">${renderIcon('search', { size: 15 })} <span>${escapeHtml(tr('بحث وتصفية (E44)', 'Search & Filter (E44)'))}</span></button>
          <button type="button" id="tech-reset-list-btn" class="btn btn-outline">${renderIcon('refresh-cw', { size: 15 })} <span>${escapeHtml(tr('عرض الكل (E43)', 'Show All (E43)'))}</span></button>
        </div>
      </form>

      ${
        pageModel.items.length === 0
          ? ui.renderEmptyState(tr('لا توجد تقنيات مطابقة في الكتالوج', 'No matching technologies in catalog'))
          : `<div class="table-scroll-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>${escapeHtml(tr('الاسم', 'Name'))}</th>
                    <th>Slug (DB-03)</th>
                    <th>${escapeHtml(tr('الفئة', 'Category'))}</th>
                    <th>${escapeHtml(tr('الوصف', 'Description'))}</th>
                    <th>${escapeHtml(tr('روابط', 'Links'))}</th>
                    <th>${escapeHtml(tr('إجراءات', 'Actions'))}</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageModel.items
                    .map(
                      (tech) => `
                    <tr>
                      <td class="mono">#${tech.id}</td>
                      <td><strong>${escapeHtml(tech.name)}</strong></td>
                      <td class="mono">${escapeHtml(tech.slug)}</td>
                      <td>${ui.renderBadge('TechnologyCategory', tech.category)}</td>
                      <td>${escapeHtml(tech.description || '—')}</td>
                      <td>
                        <div class="page-header-actions">
                          ${
                            tech.documentation_url
                              ? `<a href="${escapeHtml(tech.documentation_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline"><span>${escapeHtml(tr('توثيق', 'Docs'))}</span> ${renderIcon('external-link', { size: 13 })}</a>`
                              : ''
                          }
                          ${
                            tech.icon_url
                              ? `<a href="${escapeHtml(tech.icon_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline"><span>${escapeHtml(tr('أيقونة', 'Icon'))}</span> ${renderIcon('external-link', { size: 13 })}</a>`
                              : ''
                          }
                        </div>
                      </td>
                      <td>
                        <div class="page-header-actions">
                          <button type="button" class="btn btn-sm btn-primary" data-inspect-tech="${tech.id}">
                            ${renderIcon(canMutate ? 'edit-3' : 'eye', { size: 13 })}
                            <span>${escapeHtml(canMutate ? tr('معاينة وتعديل (E45/E46)', 'Inspect & Edit (E45/E46)') : tr('معاينة التفاصيل (E45)', 'Inspect Details (E45)'))}</span>
                          </button>
                          ${
                            canMutate
                              ? `<button type="button" class="btn btn-sm btn-danger" data-delete-tech="${tech.id}">${renderIcon('trash-2', { size: 13 })} <span>${escapeHtml(tr('حذف/تعطيل (E47)', 'Deactivate (E47)'))}</span></button>`
                              : ''
                          }
                        </div>
                      </td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
            ${ui.renderPaginationBar(pageModel, 'tech-catalog')}`
      }
    `;

    // Search Form Submit (E44)
    const searchForm = container.querySelector('#tech-catalog-search-form');
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(searchForm);
      searchState.q = String(fd.get('q') || '').trim();
      searchState.category = String(fd.get('category') || '');
      searchState.skip = 0;
      searchState.isSearchMode = Boolean(searchState.q || searchState.category);
      loadCatalog();
    });

    // Reset to E43
    container.querySelector('#tech-reset-list-btn').addEventListener('click', () => {
      searchState.q = '';
      searchState.category = '';
      searchState.skip = 0;
      searchState.isSearchMode = false;
      loadCatalog();
    });

    // Create Technology Modal (E42: 5 fields in CreateTechnologyRequest)
    const createBtn = container.querySelector('#tech-create-modal-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        ui.openModal({
          title: tr('إضافة تقنية جديدة للكتالوج (E42 — CreateTechnologyRequest)', 'Add New Technology to Catalog (E42 — CreateTechnologyRequest)'),
          bodyHtml: `
            <form id="create-tech-form" novalidate>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label" for="ctech-name">${escapeHtml(tr('اسم التقنية (name) * (يدعم C++, C#, Node.js)', 'Technology Name (name) * (supports C++, C#, Node.js)'))}</label>
                  <input id="ctech-name" name="name" type="text" class="form-control" required minlength="1" maxlength="50" placeholder="FastAPI / C++" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="ctech-cat">${escapeHtml(tr('الفئة (category) *', 'Category (category) *'))}</label>
                  <select id="ctech-cat" name="category" class="form-control" required>
                    ${renderEnumSelect(TechnologyCategory, 'TechnologyCategory', TechnologyCategory.TOOL)}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="ctech-doc-url">${escapeHtml(tr('رابط التوثيق الرسمي (documentation_url)', 'Documentation URL (documentation_url)'))}</label>
                  <input id="ctech-doc-url" name="documentation_url" type="url" class="form-control" placeholder="https://..." />
                </div>
                <div class="form-group">
                  <label class="form-label" for="ctech-icon-url">${escapeHtml(tr('رابط الأيقونة (icon_url)', 'Icon URL (icon_url)'))}</label>
                  <input id="ctech-icon-url" name="icon_url" type="url" class="form-control" placeholder="https://..." />
                </div>
              </div>
              <div class="form-group" style="margin-block-start:0.85rem;">
                <label class="form-label" for="ctech-desc">${escapeHtml(tr('وصف التقنية (description — 10 إلى 255 حرفاً عند الإدخال)', 'Description (description — 10 to 255 chars if provided)'))}</label>
                <textarea id="ctech-desc" name="description" rows="2" class="form-control" minlength="10" maxlength="255" placeholder="${escapeHtml(tr('وصف مختصر للتقنية واستخدامها...', 'Brief description of the technology and its usage...'))}"></textarea>
              </div>
              <div class="modal-footer" style="margin-block-start:1rem;padding:0;border:none;background:transparent;">
                <button type="button" class="btn btn-outline" data-close-modal="true">${escapeHtml(t('common.cancel'))}</button>
                <button type="submit" id="ctech-submit-btn" class="btn btn-primary">${renderIcon('plus', { size: 15 })} <span>${escapeHtml(tr('إضافة للكتالوج (E42)', 'Add to Catalog (E42)'))}</span></button>
              </div>
            </form>
          `,
          onMount: (dialog) => {
            const form = dialog.querySelector('#create-tech-form');
            form.addEventListener('submit', async (e) => {
              e.preventDefault();
              const btn = dialog.querySelector('#ctech-submit-btn');
              btn.disabled = true;
              const fd = new FormData(form);
              try {
                const payload = {
                  name: String(fd.get('name') || '').trim(),
                  category: String(fd.get('category') || TechnologyCategory.TOOL),
                  description: String(fd.get('description') || '').trim() || null,
                  documentation_url: normalizeOptionalUrl(fd.get('documentation_url')),
                  icon_url: normalizeOptionalUrl(fd.get('icon_url')),
                };
                const created = await technologiesService.create(payload);
                ui.closeModal();
                ui.toast(
                  tr(
                    `تمت إضافة التقنية "${created.name}" (${created.slug}) بنجاح (E42).`,
                    `Technology "${created.name}" (${created.slug}) added successfully (E42).`
                  ),
                  'success'
                );
                loadCatalog();
              } catch (err) {
                ui.applyFieldErrors(form, err.fieldErrors);
                ui.toast(err.message || tr('تعذر إضافة التقنية.', 'Failed to add technology.'), 'error');
                btn.disabled = false;
              }
            });
          },
        });
      });
    }

    // Inspect & Update Technology Drawer (E45 & E46)
    container.querySelectorAll('[data-inspect-tech]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const techId = Number(btn.getAttribute('data-inspect-tech'));
        ui.openDrawer({
          title: tr(`معاينة التقنية #${techId} (E45)`, `Inspect Technology #${techId} (E45)`),
          bodyHtml: ui.renderLoadingSkeleton(
            tr('جاري جلب تفاصيل التقنية (E45)...', 'Loading technology details (E45)...')
          ),
        });
        try {
          const tech = await technologiesService.getById(techId);
          ui.openDrawer({
            title: `${tr('التقنية', 'Technology')} #${tech.id}: ${tech.name} (${tech.slug})`,
            bodyHtml: `
              <div class="card">
                <div class="page-header-actions">
                  ${ui.renderBadge('TechnologyCategory', tech.category)}
                  <span class="badge mono">Slug: ${escapeHtml(tech.slug)}</span>
                </div>
                <p><strong>${escapeHtml(tr('تاريخ الإضافة:', 'Created At:'))}</strong> ${ui.formatDateTime(tech.created_at)}</p>
              </div>

              <form id="update-tech-drawer-form" class="card">
                <h4>${escapeHtml(tr('تحديث بيانات التقنية (E46 — UpdateTechnologyRequest)', 'Update Technology (E46 — UpdateTechnologyRequest)'))}</h4>
                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label" for="utech-name">${escapeHtml(tr('اسم التقنية (name) *', 'Technology Name (name) *'))}</label>
                    <input id="utech-name" name="name" type="text" class="form-control" required minlength="1" maxlength="50" value="${escapeHtml(tech.name)}" ${canMutate ? '' : 'disabled'} />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="utech-cat">${escapeHtml(tr('الفئة (category) *', 'Category (category) *'))}</label>
                    <select id="utech-cat" name="category" class="form-control" ${canMutate ? '' : 'disabled'}>
                      ${renderEnumSelect(TechnologyCategory, 'TechnologyCategory', tech.category)}
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="utech-doc-url">${escapeHtml(tr('رابط التوثيق (documentation_url)', 'Documentation URL (documentation_url)'))}</label>
                    <input id="utech-doc-url" name="documentation_url" type="url" class="form-control" value="${escapeHtml(tech.documentation_url || '')}" ${canMutate ? '' : 'disabled'} />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="utech-icon-url">${escapeHtml(tr('رابط الأيقونة (icon_url)', 'Icon URL (icon_url)'))}</label>
                    <input id="utech-icon-url" name="icon_url" type="url" class="form-control" value="${escapeHtml(tech.icon_url || '')}" ${canMutate ? '' : 'disabled'} />
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="utech-desc">${escapeHtml(tr('الوصف (description)', 'Description (description)'))}</label>
                  <textarea id="utech-desc" name="description" rows="3" class="form-control" minlength="10" maxlength="255" ${canMutate ? '' : 'disabled'}>${escapeHtml(tech.description || '')}</textarea>
                </div>
                <div class="card-footer">
                  <button type="submit" class="btn btn-primary" ${canMutate ? '' : 'disabled'}>${renderIcon('check', { size: 15 })} <span>${escapeHtml(tr('حفظ التعديلات (E46)', 'Save Changes (E46)'))}</span></button>
                </div>
              </form>
            `,
            onMount: (panel) => {
              const updForm = panel.querySelector('#update-tech-drawer-form');
              if (updForm && canMutate) {
                updForm.addEventListener('submit', async (e) => {
                  e.preventDefault();
                  const fd = new FormData(updForm);
                  try {
                    const formValues = {
                      name: String(fd.get('name') || '').trim(),
                      category: String(fd.get('category') || tech.category),
                      description: String(fd.get('description') || '').trim() || null,
                      documentation_url: normalizeOptionalUrl(fd.get('documentation_url')),
                      icon_url: normalizeOptionalUrl(fd.get('icon_url')),
                    };
                    await technologiesService.update(tech.id, tech, formValues);
                    ui.toast(tr('تم تحديث التقنية بنجاح (E46).', 'Technology updated successfully (E46).'), 'success');
                    ui.closeDrawer();
                    loadCatalog();
                  } catch (err) {
                    ui.applyFieldErrors(updForm, err.fieldErrors);
                    ui.toast(err.message || tr('تعذر تحديث التقنية.', 'Failed to update technology.'), 'error');
                  }
                });
              }
            },
          });
        } catch (err) {
          ui.toast(err.message || tr('تعذر تحميل تفاصيل التقنية.', 'Failed to load technology details.'), 'error');
        }
      });
    });

    // Delete/Deactivate Technology (E47)
    container.querySelectorAll('[data-delete-tech]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const techId = Number(btn.getAttribute('data-delete-tech'));
        btn.disabled = true;
        try {
          await technologiesService.deactivate(techId);
          ui.toast(
            tr(`تم حذف/تعطيل التقنية #${techId} بنجاح (E47).`, `Deactivated technology #${techId} successfully (E47).`),
            'success'
          );
          loadCatalog();
        } catch (err) {
          ui.toast(err.message || tr('تعذر حذف التقنية.', 'Failed to deactivate technology.'), 'error');
          btn.disabled = false;
        }
      });
    });

    ui.bindPaginationBar(
      container,
      pageModel,
      (nextOffset) => {
        searchState.skip = nextOffset;
        loadCatalog();
      },
      'tech-catalog'
    );
  };

  await loadCatalog();
}

// ============================================================================
// P16: Admin Inquiries Triage (#/app/admin/inquiries) — E54, E55, E56
// ============================================================================
export async function mountAdminInquiriesPage({ container, scope, isStale }) {
  const filters = {
    status: '',
    service_type: '',
    offset: 0,
    limit: 20,
  };

  const loadInquiries = async () => {
    container.innerHTML = ui.renderLoadingSkeleton(
      tr('جاري تحميل صندوق الاستفسارات (E54)...', 'Loading inquiries inbox (E54)...')
    );
    const pageModel = await inquiriesService.list(filters, scope.signal);
    if (isStale()) return;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${escapeHtml(tr('صندوق فرز الاستفسارات وطلبات المشاريع (P16)', 'Inquiries & Project Requests Triage Inbox (P16)'))}</h1>
          <p>${escapeHtml(tr('إدارة الطلبات الواردة من البوابة العامة (E54)، معاينة التفاصيل (E55)، وتحديث الحالة والملاحظات الإدارية (E56).', 'Manage public inquiries (E54), inspect details (E55), and update triage status and internal notes (E56).'))}</p>
        </div>
      </div>

      <form id="inquiries-filter-form" class="filter-bar">
        <div class="form-group">
          <label class="form-label" for="inq-filter-status">${escapeHtml(tr('الحالة (status)', 'Status (status)'))}</label>
          <select id="inq-filter-status" name="status" class="form-control">
            ${renderEnumSelect(InquiryStatus, 'InquiryStatus', filters.status, tr('كل الحالات', 'All Statuses'))}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="inq-filter-service">${escapeHtml(tr('نوع الخدمة (service_type)', 'Service Type (service_type)'))}</label>
          <select id="inq-filter-service" name="service_type" class="form-control">
            ${renderEnumSelect(
              InquiryServiceType,
              'InquiryServiceType',
              filters.service_type,
              tr('كل أنواع الخدمات', 'All Service Types')
            )}
          </select>
        </div>
        <div class="page-header-actions">
          <button type="submit" class="btn btn-primary">${renderIcon('filter', { size: 15 })} <span>${escapeHtml(tr('تصفية (E54)', 'Filter (E54)'))}</span></button>
          <button type="button" id="inq-filter-reset" class="btn btn-outline">${renderIcon('refresh-cw', { size: 15 })} <span>${escapeHtml(t('common.reset'))}</span></button>
        </div>
      </form>

      ${
        pageModel.items.length === 0
          ? ui.renderEmptyState(tr('لا توجد استفسارات مطابقة للفلتر', 'No inquiries match the selected filters'))
          : `<div class="table-scroll-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>${escapeHtml(tr('العميل', 'Client'))}</th>
                    <th>${escapeHtml(tr('البريد الإلكتروني', 'Email'))}</th>
                    <th>${escapeHtml(tr('الشركة', 'Company'))}</th>
                    <th>${escapeHtml(tr('نوع الخدمة', 'Service Type'))}</th>
                    <th>${escapeHtml(tr('الميزانية', 'Budget'))}</th>
                    <th>${escapeHtml(tr('الحالة', 'Status'))}</th>
                    <th>${escapeHtml(tr('التاريخ', 'Submitted At'))}</th>
                    <th>${escapeHtml(tr('إجراء', 'Action'))}</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageModel.items
                    .map(
                      (inq) => `
                    <tr>
                      <td class="mono">#${inq.id}</td>
                      <td><strong>${escapeHtml(inq.client_name)}</strong></td>
                      <td>${escapeHtml(inq.client_email)}</td>
                      <td>${escapeHtml(inq.company_name || '—')}</td>
                      <td>${ui.renderBadge('InquiryServiceType', inq.service_type)}</td>
                      <td>${escapeHtml(inq.budget_range || '—')}</td>
                      <td>${ui.renderBadge('InquiryStatus', inq.status)}</td>
                      <td>${ui.formatDateTime(inq.created_at)}</td>
                      <td>
                        <button type="button" class="btn btn-sm btn-primary" data-triage-inquiry="${inq.id}">${renderIcon('inbox', { size: 14 })} <span>${escapeHtml(tr('معالجة وفرز (E55/E56)', 'Triage & Update (E55/E56)'))}</span></button>
                      </td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
            ${ui.renderPaginationBar(pageModel, 'admin-inquiries')}`
      }
    `;

    const filterForm = container.querySelector('#inquiries-filter-form');
    filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(filterForm);
      filters.status = String(fd.get('status') || '');
      filters.service_type = String(fd.get('service_type') || '');
      filters.offset = 0;
      loadInquiries();
    });

    container.querySelector('#inq-filter-reset').addEventListener('click', () => {
      filters.status = '';
      filters.service_type = '';
      filters.offset = 0;
      loadInquiries();
    });

    // Open Inquiry Detail & Triage Drawer (E55 & E56)
    container.querySelectorAll('[data-triage-inquiry]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const inqId = Number(btn.getAttribute('data-triage-inquiry'));
        ui.openDrawer({
          title: tr(`تفاصيل الاستفسار #${inqId} (E55)`, `Inquiry Details #${inqId} (E55)`),
          bodyHtml: ui.renderLoadingSkeleton(
            tr('جاري تحميل بيانات الاستفسار (E55)...', 'Loading inquiry details (E55)...')
          ),
        });
        try {
          const inq = await inquiriesService.getById(inqId);
          ui.openDrawer({
            title: `${tr('استفسار', 'Inquiry')} #${inq.id} — ${inq.client_name}`,
            bodyHtml: `
              <div class="card">
                <div class="card-header">
                  <div>
                    <strong>${escapeHtml(inq.client_name)}</strong>
                    <div class="field-hint">${escapeHtml(inq.client_email)} | ${escapeHtml(tr('الشركة:', 'Company:'))} ${escapeHtml(inq.company_name || '—')}</div>
                  </div>
                  <div class="page-header-actions">
                    ${ui.renderBadge('InquiryServiceType', inq.service_type)}
                    ${ui.renderBadge('InquiryStatus', inq.status)}
                  </div>
                </div>
                <p><strong>${escapeHtml(tr('الميزانية التقديرية:', 'Estimated Budget:'))}</strong> ${escapeHtml(inq.budget_range || tr('غير محددة', 'Unspecified'))}</p>
                <h4>${escapeHtml(tr('نص الرسالة', 'Message Content'))}</h4>
                <p style="white-space:pre-line;background:var(--bg-canvas);padding:0.75rem;border-radius:var(--radius-sm);">${escapeHtml(inq.message)}</p>
              </div>

              <form id="triage-inquiry-form" class="card">
                <h4>${escapeHtml(tr('فرز الاستفسار والملاحظات الإدارية (E56 — UpdateInquiryStatusRequest)', 'Triage Inquiry & Internal Notes (E56 — UpdateInquiryStatusRequest)'))}</h4>
                <div class="form-group">
                  <label class="form-label" for="triage-status">${escapeHtml(tr('حالة المعالجة (status) *', 'Triage Status (status) *'))}</label>
                  <select id="triage-status" name="status" class="form-control" required>
                    ${renderEnumSelect(InquiryStatus, 'InquiryStatus', inq.status)}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="triage-notes">${escapeHtml(tr('الملاحظات الإدارية الداخلية (admin_notes — max 1000)', 'Internal Admin Notes (admin_notes — max 1000)'))}</label>
                  <textarea id="triage-notes" name="admin_notes" rows="4" class="form-control" maxlength="1000" placeholder="${escapeHtml(tr('سجل نتائج التواصل أو قرارات الفرز...', 'Record outreach outcomes or triage decisions...'))}">${escapeHtml(inq.admin_notes || '')}</textarea>
                </div>
                <div class="card-footer">
                  <button type="submit" class="btn btn-primary">${renderIcon('check', { size: 15 })} <span>${escapeHtml(tr('حفظ حالة الفرز والملاحظات (E56)', 'Save Triage Status & Notes (E56)'))}</span></button>
                </div>
              </form>
            `,
            onMount: (panel) => {
              const triageForm = panel.querySelector('#triage-inquiry-form');
              triageForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(triageForm);
                try {
                  await inquiriesService.update(inq.id, inq, {
                    status: String(fd.get('status') || inq.status),
                    admin_notes: String(fd.get('admin_notes') || '').trim() || null,
                  });
                  ui.toast(
                    tr(`تم تحديث الاستفسار #${inq.id} بنجاح (E56).`, `Inquiry #${inq.id} updated successfully (E56).`),
                    'success'
                  );
                  ui.closeDrawer();
                  loadInquiries();
                } catch (err) {
                  ui.applyFieldErrors(triageForm, err.fieldErrors);
                  ui.toast(err.message || tr('تعذر تحديث الاستفسار.', 'Failed to update inquiry.'), 'error');
                }
              });
            },
          });
        } catch (err) {
          ui.toast(err.message || tr('تعذر جلب تفاصيل الاستفسار.', 'Failed to load inquiry details.'), 'error');
        }
      });
    });

    ui.bindPaginationBar(
      container,
      pageModel,
      (nextOffset) => {
        filters.offset = nextOffset;
        loadInquiries();
      },
      'admin-inquiries'
    );
  };

  await loadInquiries();
}

// ============================================================================
// P17: Forensic Audit Trail (#/app/admin/audit) — E57
// ============================================================================
export async function mountAdminAuditPage({ container, scope, isStale }) {
  const filters = {
    user_id: '',
    action: '',
    entity_type: '',
    offset: 0,
    limit: 20,
  };

  const loadAudit = async () => {
    container.innerHTML = ui.renderLoadingSkeleton(
      tr('جاري تحميل سجل التدقيق الجنائي للمنصة (E57)...', 'Loading platform forensic audit trail (E57)...')
    );
    const pageModel = await auditService.list(filters, scope.signal);
    if (isStale()) return;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${escapeHtml(tr('سجل التدقيق الجنائي والأمني (P17 — E57)', 'Forensic Security & Audit Trail (P17 — E57)'))}</h1>
          <p>${escapeHtml(tr('تتبع كافة العمليات الحساسة والتغييرات (changes_payload) وعناوين IP للفاعلين.', 'Track all sensitive operations, state diffs (changes_payload), and actor IP addresses.'))}</p>
        </div>
      </div>

      <form id="audit-filter-form" class="filter-bar">
        <div class="form-group">
          <label class="form-label" for="aud-user-id">${escapeHtml(tr('معرف الفاعل (user_id)', 'Actor User ID (user_id)'))}</label>
          <input id="aud-user-id" name="user_id" type="number" min="1" class="form-control" value="${escapeHtml(filters.user_id)}" placeholder="1" />
        </div>
        <div class="form-group">
          <label class="form-label" for="aud-action">${escapeHtml(tr('نوع الحدث (action)', 'Action Type (action)'))}</label>
          <input id="aud-action" name="action" type="text" list="audit-actions-datalist" class="form-control" value="${escapeHtml(filters.action)}" placeholder="create, update, login..." />
          <datalist id="audit-actions-datalist">
            ${Object.values(AuditAction)
              .map((a) => `<option value="${escapeHtml(a)}"></option>`)
              .join('')}
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label" for="aud-entity">${escapeHtml(tr('نوع الكيان (entity_type)', 'Entity Type (entity_type)'))}</label>
          <input id="aud-entity" name="entity_type" type="text" class="form-control" value="${escapeHtml(filters.entity_type)}" placeholder="team, project, task, user..." />
        </div>
        <div class="page-header-actions">
          <button type="submit" class="btn btn-primary">${renderIcon('filter', { size: 15 })} <span>${escapeHtml(tr('تصفية السجل (E57)', 'Filter Audit Log (E57)'))}</span></button>
          <button type="button" id="aud-reset-btn" class="btn btn-outline">${renderIcon('refresh-cw', { size: 15 })} <span>${escapeHtml(t('common.reset'))}</span></button>
        </div>
      </form>

      ${
        pageModel.items.length === 0
          ? ui.renderEmptyState(tr('لا توجد سجلات تدقيق مطابقة لمعايير التصفية', 'No audit logs match the selected filter criteria'))
          : `<div class="table-scroll-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>${escapeHtml(tr('الفاعل (Actor)', 'Actor'))}</th>
                    <th>${escapeHtml(tr('العملية (Action)', 'Action'))}</th>
                    <th>${escapeHtml(tr('الكيان (Entity)', 'Entity'))}</th>
                    <th>IP Address</th>
                    <th>${escapeHtml(tr('التوقيت', 'Timestamp'))}</th>
                    <th>${escapeHtml(tr('حمولة التغييرات (changes_payload)', 'Changes Payload (changes_payload)'))}</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageModel.items
                    .map(
                      (log) => `
                    <tr>
                      <td class="mono">#${log.id}</td>
                      <td>
                        <strong>${escapeHtml(log.user_username || 'System/Guest')}</strong>
                        ${log.user_id ? `<span class="field-hint mono">(#${log.user_id})</span>` : ''}
                      </td>
                      <td><span class="badge badge-brand mono">${escapeHtml(log.action)}</span></td>
                      <td class="mono">${escapeHtml(log.entity_type)}${log.entity_id ? ` #${escapeHtml(log.entity_id)}` : ''}</td>
                      <td class="mono">${escapeHtml(log.ip_address || '—')}</td>
                      <td>${ui.formatDateTime(log.created_at)}</td>
                      <td>
                        <pre class="json-viewer" style="max-block-size:6.5rem;">${escapeHtml(
                          JSON.stringify(log.changes_payload || {}, null, 2)
                        )}</pre>
                      </td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
            ${ui.renderPaginationBar(pageModel, 'audit-logs')}`
      }
    `;

    const filterForm = container.querySelector('#audit-filter-form');
    filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(filterForm);
      filters.user_id = String(fd.get('user_id') || '').trim();
      filters.action = String(fd.get('action') || '').trim();
      filters.entity_type = String(fd.get('entity_type') || '').trim();
      filters.offset = 0;
      loadAudit();
    });

    container.querySelector('#aud-reset-btn').addEventListener('click', () => {
      filters.user_id = '';
      filters.action = '';
      filters.entity_type = '';
      filters.offset = 0;
      loadAudit();
    });

    ui.bindPaginationBar(
      container,
      pageModel,
      (nextOffset) => {
        filters.offset = nextOffset;
        loadAudit();
      },
      'audit-logs'
    );
  };

  await loadAudit();
}
