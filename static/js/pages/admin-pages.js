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
    container.innerHTML = ui.renderLoadingSkeleton('جاري تحميل دليل مستخدمي المنصة (E15 — GET /api/v1/users/)...');
    const pageModel = await usersService.listDirectory({ skip, limit }, scope.signal);
    if (isStale()) return;

    const state = store.getState();
    const isSuperAdmin = capabilities.isSuperAdmin(state);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>دليل وإدارة مستخدمي المنصة (P14)</h1>
          <p>متاح لقادة الفرق ومدير النظام الأعلى (E15). التعديل والتعطيل في V1 ذاتي فقط عبر شاشة الحساب الشخصي.</p>
        </div>
        <div class="page-header-actions">
          ${
            isSuperAdmin
              ? `<button type="button" id="admin-create-user-btn" class="btn btn-primary">+ إنشاء مستخدم بالمنصة (E09)</button>`
              : `<span class="badge">صلاحية قراءة الدليل لقائد الفريق</span>`
          }
        </div>
      </div>

      <div class="table-scroll-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>الاسم الكامل</th>
              <th>اسم المستخدم</th>
              <th>البريد الإلكتروني</th>
              <th>التخصص</th>
              <th>الحالة</th>
              <th>الظهور بالمعرض</th>
              <th>الصلاحية العليا</th>
            </tr>
          </thead>
          <tbody>
            ${pageModel.items
              .map(
                (u) => `
              <tr>
                <td class="mono">#${u.id}</td>
                <td><strong>${escapeHtml(u.name)}</strong></td>
                <td class="mono">@${escapeHtml(u.username)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>${u.job_title ? ui.renderBadge('JobTitle', u.job_title) : '—'}</td>
                <td>
                  ${ui.renderBooleanBadge(u.is_active)}
                  ${ui.renderBadge('UserStatus', u.status)}
                </td>
                <td>${u.is_public_member ? '<span class="badge badge-success">عام (Opt-in)</span>' : '<span class="badge">داخلي</span>'}</td>
                <td>${u.is_super_admin ? '<span class="badge badge-brand">Super Admin</span>' : '<span class="badge">مطور</span>'}</td>
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
          title: 'إنشاء مستخدم جديد بالمنصة (E09 — CreateUserRequest)',
          bodyHtml: `
            <form id="admin-create-user-form" novalidate>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label" for="acu-name">الاسم الكامل (name) *</label>
                  <input id="acu-name" name="name" type="text" class="form-control" required minlength="1" maxlength="100" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-username">اسم المستخدم (username)</label>
                  <input id="acu-username" name="username" type="text" class="form-control" minlength="3" maxlength="50" placeholder="اختياري" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-email">البريد الإلكتروني (email) *</label>
                  <input id="acu-email" name="email" type="email" class="form-control" required />
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-password">كلمة المرور الأولية (password) * (8+ أحرف)</label>
                  <input id="acu-password" name="password" type="password" class="form-control" required minlength="8" maxlength="100" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-job-title">المسمى الوظيفي (job_title)</label>
                  <select id="acu-job-title" name="job_title" class="form-control">
                    ${renderEnumSelect(JobTitle, 'JobTitle', '', '— غير محدد —')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-avatar-url">رابط الصورة (avatar_url)</label>
                  <input id="acu-avatar-url" name="avatar_url" type="url" class="form-control" placeholder="https://..." />
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-github-url">رابط GitHub (github_url)</label>
                  <input id="acu-github-url" name="github_url" type="url" class="form-control" placeholder="https://github.com/..." />
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-linkedin-url">رابط LinkedIn (linkedin_url)</label>
                  <input id="acu-linkedin-url" name="linkedin_url" type="url" class="form-control" placeholder="https://linkedin.com/in/..." />
                </div>
                <div class="form-group">
                  <label class="form-label" for="acu-website-url">الموقع الشخصي (website_url)</label>
                  <input id="acu-website-url" name="website_url" type="url" class="form-control" placeholder="https://..." />
                </div>
              </div>

              <div class="form-group" style="margin-top:0.85rem;">
                <label class="form-label" for="acu-bio">نبذة تعريفية (bio)</label>
                <textarea id="acu-bio" name="bio" rows="2" class="form-control" maxlength="500"></textarea>
              </div>

              <div class="page-header-actions" style="margin-top:0.85rem;">
                <label class="checkbox-row">
                  <input type="checkbox" name="is_super_admin" />
                  <span>منح صلاحية مدير النظام الأعلى (is_super_admin)</span>
                </label>
                <label class="checkbox-row">
                  <input type="checkbox" name="is_public_member" />
                  <span>إظهار في دليل الأعضاء العام (is_public_member)</span>
                </label>
              </div>

              <div class="modal-footer" style="margin-top:1rem;padding:0;border:none;background:transparent;">
                <button type="button" class="btn btn-outline" data-close-modal="true">إلغاء</button>
                <button type="submit" id="acu-submit-btn" class="btn btn-primary">إنشاء المستخدم (E09)</button>
              </div>
            </form>
          `,
          onMount: (dialog) => {
            const form = dialog.querySelector('#admin-create-user-form');
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
                ui.toast(`تم إنشاء المستخدم "${created.name}" (#${created.id}) بنجاح (E09).`, 'success');
                loadDirectory();
              } catch (err) {
                ui.applyFieldErrors(form, err.fieldErrors);
                ui.toast(err.message || 'تعذر إنشاء المستخدم.', 'error');
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
    container.innerHTML = ui.renderLoadingSkeleton('جاري تحميل كتالوج التقنيات...');

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
          <h1>كتالوج التقنيات القياسي (P15)</h1>
          <p>استعراض التقنيات المعتمدة (E43)، البحث الفوري (E44)، ومعاينة التفاصيل (E45). الإضافة والتعديل والحذف محصور بـ Super Admin (E42/E46/E47).</p>
        </div>
        <div class="page-header-actions">
          ${
            canMutate
              ? `<button type="button" id="tech-create-modal-btn" class="btn btn-primary">+ إضافة تقنية للكتالوج (E42)</button>`
              : ''
          }
        </div>
      </div>

      <form id="tech-catalog-search-form" class="filter-bar">
        <div class="form-group" style="min-width:16rem;flex:1;">
          <label class="form-label" for="tech-q">البحث بالاسم أو المعرف (E44 q)</label>
          <input id="tech-q" name="q" type="text" class="form-control" value="${escapeHtml(searchState.q)}" placeholder="مثال: Python, C++, FastAPI..." />
        </div>
        <div class="form-group" style="min-width:14rem;">
          <label class="form-label" for="tech-cat">الفئة التقنية (E44 category)</label>
          <select id="tech-cat" name="category" class="form-control">
            ${renderEnumSelect(TechnologyCategory, 'TechnologyCategory', searchState.category, 'كل الفئات')}
          </select>
        </div>
        <div class="page-header-actions">
          <button type="submit" class="btn btn-primary">بحث وتصفية (E44)</button>
          <button type="button" id="tech-reset-list-btn" class="btn btn-outline">عرض الكل (E43)</button>
        </div>
      </form>

      ${
        pageModel.items.length === 0
          ? ui.renderEmptyState('لا توجد تقنيات مطابقة في الكتالوج')
          : `<div class="table-scroll-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>الاسم</th>
                    <th>Slug (DB-03)</th>
                    <th>الفئة</th>
                    <th>الوصف</th>
                    <th>روابط</th>
                    <th>إجراءات</th>
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
                              ? `<a href="${escapeHtml(tech.documentation_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">توثيق ↗</a>`
                              : ''
                          }
                          ${
                            tech.icon_url
                              ? `<a href="${escapeHtml(tech.icon_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">أيقونة ↗</a>`
                              : ''
                          }
                        </div>
                      </td>
                      <td>
                        <div class="page-header-actions">
                          <button type="button" class="btn btn-sm btn-primary" data-inspect-tech="${tech.id}">
                            ${canMutate ? 'معاينة وتعديل (E45/E46)' : 'معاينة التفاصيل (E45)'}
                          </button>
                          ${
                            canMutate
                              ? `<button type="button" class="btn btn-sm btn-danger" data-delete-tech="${tech.id}">حذف/تعطيل (E47)</button>`
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
          title: 'إضافة تقنية جديدة للكتالوج (E42 — CreateTechnologyRequest)',
          bodyHtml: `
            <form id="create-tech-form" novalidate>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label" for="ctech-name">اسم التقنية (name) * (يدعم C++, C#, Node.js)</label>
                  <input id="ctech-name" name="name" type="text" class="form-control" required minlength="1" maxlength="50" placeholder="مثال: FastAPI أو C++" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="ctech-cat">الفئة (category) *</label>
                  <select id="ctech-cat" name="category" class="form-control" required>
                    ${renderEnumSelect(TechnologyCategory, 'TechnologyCategory', TechnologyCategory.TOOL)}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="ctech-doc-url">رابط التوثيق الرسمي (documentation_url)</label>
                  <input id="ctech-doc-url" name="documentation_url" type="url" class="form-control" placeholder="https://..." />
                </div>
                <div class="form-group">
                  <label class="form-label" for="ctech-icon-url">رابط الأيقونة (icon_url)</label>
                  <input id="ctech-icon-url" name="icon_url" type="url" class="form-control" placeholder="https://..." />
                </div>
              </div>
              <div class="form-group" style="margin-top:0.85rem;">
                <label class="form-label" for="ctech-desc">وصف التقنية (description — 10 إلى 255 حرفاً عند الإدخال)</label>
                <textarea id="ctech-desc" name="description" rows="2" class="form-control" minlength="10" maxlength="255" placeholder="وصف مختصر للتقنية واستخدامها..."></textarea>
              </div>
              <div class="modal-footer" style="margin-top:1rem;padding:0;border:none;background:transparent;">
                <button type="button" class="btn btn-outline" data-close-modal="true">إلغاء</button>
                <button type="submit" id="ctech-submit-btn" class="btn btn-primary">إضافة للكتالوج (E42)</button>
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
                ui.toast(`تمت إضافة التقنية "${created.name}" (${created.slug}) بنجاح (E42).`, 'success');
                loadCatalog();
              } catch (err) {
                ui.applyFieldErrors(form, err.fieldErrors);
                ui.toast(err.message || 'تعذر إضافة التقنية.', 'error');
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
          title: `معاينة التقنية #${techId} (E45)`,
          bodyHtml: ui.renderLoadingSkeleton('جاري جلب تفاصيل التقنية (E45)...'),
        });
        try {
          const tech = await technologiesService.getById(techId);
          ui.openDrawer({
            title: `التقنية #${tech.id}: ${tech.name} (${tech.slug})`,
            bodyHtml: `
              <div class="card">
                <div class="page-header-actions">
                  ${ui.renderBadge('TechnologyCategory', tech.category)}
                  <span class="badge mono">Slug: ${escapeHtml(tech.slug)}</span>
                </div>
                <p><strong>تاريخ الإضافة:</strong> ${ui.formatDateTime(tech.created_at)}</p>
              </div>

              <form id="update-tech-drawer-form" class="card">
                <h4>تحديث بيانات التقنية (E46 — UpdateTechnologyRequest)</h4>
                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label" for="utech-name">اسم التقنية (name) *</label>
                    <input id="utech-name" name="name" type="text" class="form-control" required minlength="1" maxlength="50" value="${escapeHtml(tech.name)}" ${canMutate ? '' : 'disabled'} />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="utech-cat">الفئة (category) *</label>
                    <select id="utech-cat" name="category" class="form-control" ${canMutate ? '' : 'disabled'}>
                      ${renderEnumSelect(TechnologyCategory, 'TechnologyCategory', tech.category)}
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="utech-doc-url">رابط التوثيق (documentation_url)</label>
                    <input id="utech-doc-url" name="documentation_url" type="url" class="form-control" value="${escapeHtml(tech.documentation_url || '')}" ${canMutate ? '' : 'disabled'} />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="utech-icon-url">رابط الأيقونة (icon_url)</label>
                    <input id="utech-icon-url" name="icon_url" type="url" class="form-control" value="${escapeHtml(tech.icon_url || '')}" ${canMutate ? '' : 'disabled'} />
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="utech-desc">الوصف (description)</label>
                  <textarea id="utech-desc" name="description" rows="3" class="form-control" minlength="10" maxlength="255" ${canMutate ? '' : 'disabled'}>${escapeHtml(tech.description || '')}</textarea>
                </div>
                <div class="card-footer">
                  <button type="submit" class="btn btn-primary" ${canMutate ? '' : 'disabled'}>حفظ التعديلات (E46)</button>
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
                    ui.toast('تم تحديث التقنية بنجاح (E46).', 'success');
                    ui.closeDrawer();
                    loadCatalog();
                  } catch (err) {
                    ui.applyFieldErrors(updForm, err.fieldErrors);
                    ui.toast(err.message || 'تعذر تحديث التقنية.', 'error');
                  }
                });
              }
            },
          });
        } catch (err) {
          ui.toast(err.message || 'تعذر تحميل تفاصيل التقنية.', 'error');
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
          ui.toast(`تم حذف/تعطيل التقنية #${techId} بنجاح (E47).`, 'success');
          loadCatalog();
        } catch (err) {
          ui.toast(err.message || 'تعذر حذف التقنية.', 'error');
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
    container.innerHTML = ui.renderLoadingSkeleton('جاري تحميل صندوق الاستفسارات (E54)...');
    const pageModel = await inquiriesService.list(filters, scope.signal);
    if (isStale()) return;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>صندوق فرز الاستفسارات وطلبات المشاريع (P16)</h1>
          <p>إدارة الطلبات الواردة من البوابة العامة (E54)، معاينة التفاصيل (E55)، وتحديث الحالة والملاحظات الإدارية (E56).</p>
        </div>
      </div>

      <form id="inquiries-filter-form" class="filter-bar">
        <div class="form-group" style="min-width:14rem;">
          <label class="form-label" for="inq-filter-status">الحالة (status)</label>
          <select id="inq-filter-status" name="status" class="form-control">
            ${renderEnumSelect(InquiryStatus, 'InquiryStatus', filters.status, 'كل الحالات')}
          </select>
        </div>
        <div class="form-group" style="min-width:14rem;">
          <label class="form-label" for="inq-filter-service">نوع الخدمة (service_type)</label>
          <select id="inq-filter-service" name="service_type" class="form-control">
            ${renderEnumSelect(
              InquiryServiceType,
              'InquiryServiceType',
              filters.service_type,
              'كل أنواع الخدمات'
            )}
          </select>
        </div>
        <div class="page-header-actions">
          <button type="submit" class="btn btn-primary">تصفية (E54)</button>
          <button type="button" id="inq-filter-reset" class="btn btn-outline">إعادة ضبط</button>
        </div>
      </form>

      ${
        pageModel.items.length === 0
          ? ui.renderEmptyState('لا توجد استفسارات مطابقة للفلتر')
          : `<div class="table-scroll-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>العميل</th>
                    <th>البريد الإلكتروني</th>
                    <th>الشركة</th>
                    <th>نوع الخدمة</th>
                    <th>الميزانية</th>
                    <th>الحالة</th>
                    <th>التاريخ</th>
                    <th>إجراء</th>
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
                        <button type="button" class="btn btn-sm btn-primary" data-triage-inquiry="${inq.id}">معالجة وفرز (E55/E56)</button>
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
          title: `تفاصيل الاستفسار #${inqId} (E55)`,
          bodyHtml: ui.renderLoadingSkeleton('جاري تحميل بيانات الاستفسار (E55)...'),
        });
        try {
          const inq = await inquiriesService.getById(inqId);
          ui.openDrawer({
            title: `استفسار #${inq.id} — ${inq.client_name}`,
            bodyHtml: `
              <div class="card">
                <div class="card-header">
                  <div>
                    <strong>${escapeHtml(inq.client_name)}</strong>
                    <div class="field-hint">${escapeHtml(inq.client_email)} | الشركة: ${escapeHtml(inq.company_name || '—')}</div>
                  </div>
                  <div class="page-header-actions">
                    ${ui.renderBadge('InquiryServiceType', inq.service_type)}
                    ${ui.renderBadge('InquiryStatus', inq.status)}
                  </div>
                </div>
                <p><strong>الميزانية التقديرية:</strong> ${escapeHtml(inq.budget_range || 'غير محددة')}</p>
                <h4>نص الرسالة</h4>
                <p style="white-space:pre-line;background:var(--bg-canvas);padding:0.75rem;border-radius:var(--radius-sm);">${escapeHtml(inq.message)}</p>
              </div>

              <form id="triage-inquiry-form" class="card">
                <h4>فرز الاستفسار والملاحظات الإدارية (E56 — UpdateInquiryStatusRequest)</h4>
                <div class="form-group">
                  <label class="form-label" for="triage-status">حالة المعالجة (status) *</label>
                  <select id="triage-status" name="status" class="form-control" required>
                    ${renderEnumSelect(InquiryStatus, 'InquiryStatus', inq.status)}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="triage-notes">الملاحظات الإدارية الداخلية (admin_notes — max 1000)</label>
                  <textarea id="triage-notes" name="admin_notes" rows="4" class="form-control" maxlength="1000" placeholder="سجل نتائج التواصل أو قرارات الفرز...">${escapeHtml(inq.admin_notes || '')}</textarea>
                </div>
                <div class="card-footer">
                  <button type="submit" class="btn btn-primary">حفظ حالة الفرز والملاحظات (E56)</button>
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
                  ui.toast(`تم تحديث الاستفسار #${inq.id} بنجاح (E56).`, 'success');
                  ui.closeDrawer();
                  loadInquiries();
                } catch (err) {
                  ui.applyFieldErrors(triageForm, err.fieldErrors);
                  ui.toast(err.message || 'تعذر تحديث الاستفسار.', 'error');
                }
              });
            },
          });
        } catch (err) {
          ui.toast(err.message || 'تعذر جلب تفاصيل الاستفسار.', 'error');
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
    container.innerHTML = ui.renderLoadingSkeleton('جاري تحميل سجل التدقيق الجنائي للمنصة (E57)...');
    const pageModel = await auditService.list(filters, scope.signal);
    if (isStale()) return;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>سجل التدقيق الجنائي والأمني (P17 — E57)</h1>
          <p>تتبع كافة العمليات الحساسة والتغييرات (changes_payload) وعناوين IP للفاعلين.</p>
        </div>
      </div>

      <form id="audit-filter-form" class="filter-bar">
        <div class="form-group" style="min-width:11rem;">
          <label class="form-label" for="aud-user-id">معرف الفاعل (user_id)</label>
          <input id="aud-user-id" name="user_id" type="number" min="1" class="form-control" value="${escapeHtml(filters.user_id)}" placeholder="مثال: 1" />
        </div>
        <div class="form-group" style="min-width:13rem;">
          <label class="form-label" for="aud-action">نوع الحدث (action)</label>
          <input id="aud-action" name="action" type="text" list="audit-actions-datalist" class="form-control" value="${escapeHtml(filters.action)}" placeholder="create, update, login..." />
          <datalist id="audit-actions-datalist">
            ${Object.values(AuditAction)
              .map((a) => `<option value="${escapeHtml(a)}"></option>`)
              .join('')}
          </datalist>
        </div>
        <div class="form-group" style="min-width:13rem;">
          <label class="form-label" for="aud-entity">نوع الكيان (entity_type)</label>
          <input id="aud-entity" name="entity_type" type="text" class="form-control" value="${escapeHtml(filters.entity_type)}" placeholder="team, project, task, user..." />
        </div>
        <div class="page-header-actions">
          <button type="submit" class="btn btn-primary">تصفية السجل (E57)</button>
          <button type="button" id="aud-reset-btn" class="btn btn-outline">إعادة ضبط</button>
        </div>
      </form>

      ${
        pageModel.items.length === 0
          ? ui.renderEmptyState('لا توجد سجلات تدقيق مطابقة لمعايير التصفية')
          : `<div class="table-scroll-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>الفاعل (Actor)</th>
                    <th>العملية (Action)</th>
                    <th>الكيان (Entity)</th>
                    <th>IP Address</th>
                    <th>التوقيت</th>
                    <th>حمولة التغييرات (changes_payload)</th>
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
                        <pre class="json-viewer" style="max-height:6.5rem;">${escapeHtml(
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

