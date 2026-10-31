// static/js/pages/public-pages.js — Public Portal Screens P01, P02, P03, P04, P05, P06
import {
  InquiryServiceType,
  JobTitle,
  ENUM_LABELS,
  formatEnumLabel,
} from '../contracts/enums.js';
import { normalizeOptionalUrl } from '../contracts/serializers.js';
import { ui, escapeHtml } from '../core/ui.js';
import { healthService } from '../services/health.js';
import { showcaseService } from '../services/showcase.js';
import { inquiriesService } from '../services/inquiries.js';
import { authService } from '../services/auth.js';

function renderSelectOptions(enumObj, groupName, includeEmptyLabel = '') {
  const opts = [];
  if (includeEmptyLabel) {
    opts.push(`<option value="">${escapeHtml(includeEmptyLabel)}</option>`);
  }
  for (const val of Object.values(enumObj)) {
    opts.push(
      `<option value="${escapeHtml(val)}">${escapeHtml(
        formatEnumLabel(groupName, val)
      )}</option>`
    );
  }
  return opts.join('');
}

export async function refreshPublicHealthStrip(signal) {
  const strip = document.getElementById('public-health-strip');
  if (!strip) return;
  try {
    const [live, ready] = await Promise.all([
      healthService.checkLiveness(signal),
      healthService.checkReadiness(signal),
    ]);
    const isOk = live?.status === 'ok' && ready?.status === 'ready';
    strip.innerHTML = `
      <span class="badge ${isOk ? 'badge-success' : 'badge-warning'}">
        الخادم: ${escapeHtml(live?.status || 'ok')} | قاعدة البيانات: ${escapeHtml(ready?.status || 'ready')}
      </span>
    `;
  } catch {
    strip.innerHTML = `<span class="badge badge-danger">تعذر الاتصال بفحص الصحة</span>`;
  }
}

// ============================================================================
// P01: Public Landing & Overview (#/) — E48, E52, E01, E02
// ============================================================================
export async function mountPublicHomePage({ container, scope, isStale }) {
  container.innerHTML = ui.renderLoadingSkeleton('جاري تحميل النظرة العامة للمنصة...');
  refreshPublicHealthStrip(scope.signal);

  const [overview, technologies] = await Promise.all([
    showcaseService.getOverview(scope.signal),
    showcaseService.listTechnologies(scope.signal),
  ]);
  if (isStale()) return;

  const featuredProjects = overview?.featured_projects || [];
  const techList = technologies.length > 0 ? technologies : overview?.technologies || [];

  container.innerHTML = `
    <section class="hero-section">
      <div class="page-header">
        <div>
          <span class="badge badge-brand">Team Management Base V1.0</span>
          <h1 style="margin-top:0.5rem;">منصة هندسة الفرق البرمجية ومعرض الحلول الرقمية</h1>
          <p style="margin-top:0.5rem;max-width:52rem;">
            بيئة عمل معزولة الموارد لإدارة الفرق الهندسية، المشاريع، ولوحات كانبان بمعايير أمان Casbin RBAC، مع بوابة عامة لاستعراض المشاريع المعتمدة واستقبال طلبات التعاون.
          </p>
        </div>
        <div class="page-header-actions">
          <a href="#/projects" class="btn btn-primary">تصفح معرض المشاريع (P02)</a>
          <a href="#/contact" class="btn btn-outline">اطلب مشروعك الآن (P05)</a>
          <button type="button" class="btn btn-outline" data-scroll-to="home-featured-section">المشاريع المميزة ↓</button>
        </div>
      </div>

      <div class="stats-grid" style="margin-top:1.5rem;">
        <div class="stat-card">
          <div class="stat-label">الفرق الهندسية النشطة</div>
          <div class="stat-value">${Number(overview?.total_teams || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">المشاريع العامة المعتمدة</div>
          <div class="stat-value">${Number(overview?.total_projects || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">الكفاءات الهندسية بالمعرض</div>
          <div class="stat-value">${Number(overview?.total_public_members || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">التقنيات المعتمدة</div>
          <div class="stat-value">${techList.length}</div>
        </div>
      </div>
    </section>

    <section id="home-featured-section" style="margin-bottom:2rem;">
      <div class="page-header">
        <div>
          <h2>أبرز المشاريع الهندسية (Featured Showcase)</h2>
          <p>مشاريع تم اعتمادها ونشرها من قِبل إدارة المنصة.</p>
        </div>
        <a href="#/projects" class="btn btn-sm btn-outline">عرض الكتالوج الكامل ←</a>
      </div>

      ${
        featuredProjects.length === 0
          ? ui.renderEmptyState(
              'لا توجد مشاريع مميزة حالياً',
              'ستظهر المشاريع هنا فور اعتمادها للعرض العام من قِبل مدير المنصة.'
            )
          : `<div class="responsive-card-grid">
              ${featuredProjects
                .map(
                  (proj) => `
                <article class="card">
                  <div class="card-header">
                    <div>
                      <h3><a href="#/projects/${encodeURIComponent(proj.slug)}">${escapeHtml(proj.title)}</a></h3>
                      <span class="field-hint">${escapeHtml(proj.team_name || 'فريق هندسي')}</span>
                    </div>
                    ${ui.renderBadge('ProjectStatus', proj.status)}
                  </div>
                  <p>${escapeHtml(proj.short_description)}</p>
                  <div class="page-header-actions">
                    ${(proj.technologies || [])
                      .map((t) => `<span class="badge">${escapeHtml(t.name)}</span>`)
                      .join('')}
                  </div>
                  <div class="card-footer">
                    <a href="#/projects/${encodeURIComponent(proj.slug)}" class="btn btn-sm btn-primary">التفاصيل الكاملة</a>
                    ${
                      proj.demo_url
                        ? `<a href="${escapeHtml(proj.demo_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">معاينة حية ↗</a>`
                        : ''
                    }
                  </div>
                </article>
              `
                )
                .join('')}
            </div>`
      }
    </section>

    <section>
      <div class="page-header">
        <div>
          <h2>منظومة التقنيات والأدوات المعتمدة</h2>
          <p>الأطر واللغات البرمجية المستخدمة في مشاريع الفرق.</p>
        </div>
      </div>
      ${
        techList.length === 0
          ? ui.renderEmptyState('لم يتم تسجيل تقنيات عامة بعد')
          : `<div class="card">
              <div class="page-header-actions">
                ${techList
                  .map(
                    (t) => `
                  <a href="#/projects?technology=${encodeURIComponent(t.slug)}" class="badge badge-brand">
                    ${escapeHtml(t.name)} (${escapeHtml(formatEnumLabel('TechnologyCategory', t.category))})
                  </a>
                `
                  )
                  .join('')}
              </div>
            </div>`
      }
    </section>
  `;
}

// ============================================================================
// P02: Public Projects Catalog (#/projects) — E49, E52
// ============================================================================
export async function mountPublicProjectsPage({ container, query, scope, isStale }) {
  const filterState = {
    offset: Number(query.offset) || 0,
    limit: 12,
    technology: query.technology || '',
    featured: query.featured || '',
  };

  let technologies = [];
  try {
    technologies = await showcaseService.listTechnologies(scope.signal);
  } catch {
    technologies = [];
  }
  if (isStale()) return;

  const loadProjects = async () => {
    container.innerHTML = ui.renderLoadingSkeleton('جاري تحميل كتالوج المشاريع العامة...');
    const pageModel = await showcaseService.listProjects(
      {
        offset: filterState.offset,
        limit: filterState.limit,
        technology: filterState.technology,
        featured:
          filterState.featured === 'true'
            ? true
            : filterState.featured === 'false'
            ? false
            : null,
      },
      scope.signal
    );
    if (isStale()) return;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>كتالوج المشاريع العامة (P02)</h1>
          <p>استعرض المشاريع المنشورة وقم بتصفيتها حسب التقنية أو التميز.</p>
        </div>
      </div>

      <form id="public-projects-filter-form" class="filter-bar">
        <div class="form-group" style="min-width:14rem;">
          <label class="form-label" for="filter-tech">التقنية (Technology Slug)</label>
          <select id="filter-tech" name="technology" class="form-control">
            <option value="">كل التقنيات</option>
            ${technologies
              .map(
                (t) =>
                  `<option value="${escapeHtml(t.slug)}" ${
                    filterState.technology === t.slug ? 'selected' : ''
                  }>${escapeHtml(t.name)}</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="form-group" style="min-width:12rem;">
          <label class="form-label" for="filter-featured">تصنيف العرض</label>
          <select id="filter-featured" name="featured" class="form-control">
            <option value="" ${filterState.featured === '' ? 'selected' : ''}>الكل</option>
            <option value="true" ${filterState.featured === 'true' ? 'selected' : ''}>المميزة فقط (Featured)</option>
            <option value="false" ${filterState.featured === 'false' ? 'selected' : ''}>غير المميزة</option>
          </select>
        </div>

        <div class="page-header-actions">
          <button type="submit" class="btn btn-primary">تطبيق الفلتر</button>
          <button type="button" id="reset-pub-proj-filter" class="btn btn-outline">إعادة ضبط</button>
        </div>
      </form>

      ${
        pageModel.items.length === 0
          ? ui.renderEmptyState('لا توجد مشاريع مطابقة لمعايير التصفية الحالية')
          : `<div class="responsive-card-grid">
              ${pageModel.items
                .map(
                  (proj) => `
                <article class="card">
                  <div class="card-header">
                    <div>
                      <h3><a href="#/projects/${encodeURIComponent(proj.slug)}">${escapeHtml(proj.title)}</a></h3>
                      <span class="field-hint">الفريق: ${escapeHtml(proj.team_name || '—')}</span>
                    </div>
                    <div class="page-header-actions">
                      ${proj.featured ? '<span class="badge badge-warning">مميز ★</span>' : ''}
                      ${ui.renderBadge('ProjectStatus', proj.status)}
                    </div>
                  </div>
                  <p>${escapeHtml(proj.short_description)}</p>
                  <div class="page-header-actions">
                    ${(proj.technologies || [])
                      .map((t) => `<span class="badge">${escapeHtml(t.name)}</span>`)
                      .join('')}
                  </div>
                  <div class="card-footer">
                    <a href="#/projects/${encodeURIComponent(proj.slug)}" class="btn btn-sm btn-primary">عرض التفاصيل</a>
                    <div class="page-header-actions">
                      ${
                        proj.demo_url
                          ? `<a href="${escapeHtml(proj.demo_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">معاينة ↗</a>`
                          : ''
                      }
                      ${
                        proj.repo_url
                          ? `<a href="${escapeHtml(proj.repo_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">المستودع ↗</a>`
                          : ''
                      }
                    </div>
                  </div>
                </article>
              `
                )
                .join('')}
            </div>
            ${ui.renderPaginationBar(pageModel, 'pub-projects')}`
      }
    `;

    const filterForm = container.querySelector('#public-projects-filter-form');
    if (filterForm) {
      filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(filterForm);
        filterState.technology = String(fd.get('technology') || '');
        filterState.featured = String(fd.get('featured') || '');
        filterState.offset = 0;
        loadProjects();
      });
    }

    const resetBtn = container.querySelector('#reset-pub-proj-filter');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        filterState.technology = '';
        filterState.featured = '';
        filterState.offset = 0;
        loadProjects();
      });
    }

    ui.bindPaginationBar(
      container,
      pageModel,
      (nextOffset) => {
        filterState.offset = nextOffset;
        loadProjects();
      },
      'pub-projects'
    );
  };

  await loadProjects();
}

// ============================================================================
// P03: Public Project Detail (#/projects/:slug) — E50
// ============================================================================
export async function mountPublicProjectDetailPage({ container, params, scope, isStale }) {
  container.innerHTML = ui.renderLoadingSkeleton('جاري تحميل بيانات المشروع...');

  let project = null;
  try {
    project = await showcaseService.getProjectBySlug(params.slug, scope.signal);
  } catch (err) {
    if (isStale()) return;
    if (err.status === 404) {
      container.innerHTML = ui.renderEmptyState(
        'المشروع غير موجود (404)',
        `لم يتم العثور على مشروع عام بالمعرف النصي "${params.slug}".`,
        `<a href="#/projects" class="btn btn-primary">العودة إلى معرض المشاريع</a>`
      );
      return;
    }
    throw err;
  }

  if (isStale()) return;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-header-actions" style="margin-bottom:0.5rem;">
          <a href="#/projects" class="btn btn-sm btn-outline">→ العودة للمعرض</a>
          <span class="badge mono">${escapeHtml(project.slug)}</span>
          ${project.featured ? '<span class="badge badge-warning">مشروع مميز ★</span>' : ''}
          ${ui.renderBadge('ProjectStatus', project.status)}
        </div>
        <h1>${escapeHtml(project.title)}</h1>
        <p class="field-hint">الفريق الهندسي: <strong>${escapeHtml(project.team_name || '—')}</strong> | تاريخ النشر: ${ui.formatDateTime(project.released_at || project.created_at)}</p>
      </div>
      <div class="page-header-actions">
        ${
          project.demo_url
            ? `<a href="${escapeHtml(project.demo_url)}" target="_blank" rel="noopener" class="btn btn-primary">فتح النسخة التجريبية ↗</a>`
            : ''
        }
        ${
          project.repo_url
            ? `<a href="${escapeHtml(project.repo_url)}" target="_blank" rel="noopener" class="btn btn-outline">مستودع الكود ↗</a>`
            : ''
        }
      </div>
    </div>

    <div class="split-grid">
      <div class="card">
        <h3>نبذة مختصرة</h3>
        <p>${escapeHtml(project.short_description)}</p>
        <h3 style="margin-top:1rem;">التفاصيل المعمارية والوصف الكامل</h3>
        <p style="white-space:pre-line;">${escapeHtml(project.description || 'لا يوجد وصف تفصيلي إضافي.')}</p>
      </div>

      <div class="card">
        <h3>المكدس التقني (Tech Stack)</h3>
        ${
          (project.technologies || []).length === 0
            ? '<p class="field-hint">لم يتم ربط تقنيات محددة بهذا المشروع.</p>'
            : `<div class="page-header-actions">
                ${project.technologies
                  .map(
                    (t) => `
                  <span class="badge badge-brand">
                    ${escapeHtml(t.name)} — ${escapeHtml(formatEnumLabel('TechnologyCategory', t.category))}
                  </span>
                `
                  )
                  .join('')}
              </div>`
        }
        <div class="card-footer">
          <span>هل ترغب ببناء مشروع مشابه؟</span>
          <a href="#/contact" class="btn btn-sm btn-primary">تواصل مع الفريق</a>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// P04: Public Members Roster (#/members) — E51
// ============================================================================
export async function mountPublicMembersPage({ container, scope, isStale }) {
  let currentOffset = 0;
  const limit = 12;

  const loadRoster = async () => {
    container.innerHTML = ui.renderLoadingSkeleton('جاري تحميل قائمة الكفاءات الهندسية...');
    const pageModel = await showcaseService.listMembers({ offset: currentOffset, limit }, scope.signal);
    if (isStale()) return;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>دليل الكفاءات الهندسية العام (P04)</h1>
          <p>أعضاء الفرق الذين اختاروا إظهار ملفاتهم المهنية في البوابة العامة (Opt-in Public Roster).</p>
        </div>
      </div>

      ${
        pageModel.items.length === 0
          ? ui.renderEmptyState('لا يوجد أعضاء في الدليل العام حالياً')
          : `<div class="responsive-card-grid">
              ${pageModel.items
                .map(
                  (m) => `
                <article class="card">
                  <div class="card-header">
                    <div>
                      <h3>${escapeHtml(m.name)}</h3>
                      <span class="field-hint mono">@${escapeHtml(m.username)}</span>
                    </div>
                    ${m.job_title ? ui.renderBadge('JobTitle', m.job_title) : ''}
                  </div>
                  <p>${escapeHtml(m.bio || 'مهندس برمجيات ضمن فرق المنصة.')}</p>
                  <div class="card-footer">
                    <div class="page-header-actions">
                      ${
                        m.github_url
                          ? `<a href="${escapeHtml(m.github_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">GitHub ↗</a>`
                          : ''
                      }
                      ${
                        m.linkedin_url
                          ? `<a href="${escapeHtml(m.linkedin_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">LinkedIn ↗</a>`
                          : ''
                      }
                      ${
                        m.portfolio_url
                          ? `<a href="${escapeHtml(m.portfolio_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-primary">معرض الأعمال ↗</a>`
                          : ''
                      }
                    </div>
                  </div>
                </article>
              `
                )
                .join('')}
            </div>
            ${ui.renderPaginationBar(pageModel, 'pub-members')}`
      }
    `;

    ui.bindPaginationBar(
      container,
      pageModel,
      (nextOffset) => {
        currentOffset = nextOffset;
        loadRoster();
      },
      'pub-members'
    );
  };

  await loadRoster();
}

// ============================================================================
// P05: Public Inquiry / Contact Form (#/contact) — E53 (7 Fields)
// ============================================================================
export async function mountPublicContactPage({ container }) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>تواصل معنا / طلب مشروع أو انضمام (P05)</h1>
        <p>أرسل تفاصيل مشروعك أو طلب الانضمام ليتم فرزه ومراجعته من قِبل الإدارة الهندسية.</p>
      </div>
    </div>

    <div class="card" style="max-width:48rem;margin-inline:auto;">
      <form id="public-inquiry-form" novalidate>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="inq-client-name">الاسم الكامل (client_name) *</label>
            <input id="inq-client-name" name="client_name" type="text" class="form-control" required minlength="2" maxlength="100" placeholder="مثال: م. أحمد العلي" />
          </div>

          <div class="form-group">
            <label class="form-label" for="inq-client-email">البريد الإلكتروني (client_email) *</label>
            <input id="inq-client-email" name="client_email" type="email" class="form-control" required placeholder="name@company.com" />
          </div>

          <div class="form-group">
            <label class="form-label" for="inq-company-name">اسم الجهة / الشركة (company_name)</label>
            <input id="inq-company-name" name="company_name" type="text" class="form-control" maxlength="150" placeholder="اختياري" />
          </div>

          <div class="form-group">
            <label class="form-label" for="inq-service-type">نوع الخدمة المطلوبة (service_type) *</label>
            <select id="inq-service-type" name="service_type" class="form-control" required>
              ${renderSelectOptions(InquiryServiceType, 'InquiryServiceType')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="inq-budget-range">النطاق التقديري للميزانية (budget_range)</label>
            <input id="inq-budget-range" name="budget_range" type="text" class="form-control" maxlength="50" placeholder="مثال: $5,000 - $15,000" />
          </div>
        </div>

        <!-- Bot Honeypot Field (Strictly hidden via CSS & aria-hidden) -->
        <div class="hp-trap-field" aria-hidden="true">
          <label for="inq-honeypot">Leave this field empty</label>
          <input id="inq-honeypot" name="honeypot" type="text" tabindex="-1" autocomplete="off" />
        </div>

        <div class="form-group" style="margin-top:1rem;">
          <label class="form-label" for="inq-message">تفاصيل الطلب أو الرسالة (message) * (10–3000 حرف)</label>
          <textarea id="inq-message" name="message" rows="5" class="form-control" required minlength="10" maxlength="3000" placeholder="اشرح المتطلبات التقنية والأهداف..."></textarea>
        </div>

        <div class="card-footer" style="margin-top:1rem;">
          <span class="field-hint">تتم حماية هذا النموذج بمحدد معدل الطلبات (Rate Limiter) وفخ البوتات.</span>
          <button type="submit" id="inq-submit-btn" class="btn btn-primary">إرسال الطلب الآن</button>
        </div>
      </form>
    </div>
  `;

  const form = container.querySelector('#public-inquiry-form');
  const submitBtn = container.querySelector('#inq-submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    const fd = new FormData(form);

    const payload = {
      client_name: String(fd.get('client_name') || '').trim(),
      client_email: String(fd.get('client_email') || '').trim(),
      company_name: String(fd.get('company_name') || '').trim() || null,
      service_type: String(fd.get('service_type') || InquiryServiceType.OTHER),
      budget_range: String(fd.get('budget_range') || '').trim() || null,
      message: String(fd.get('message') || '').trim(),
      honeypot: String(fd.get('honeypot') || '') || null,
    };

    try {
      await inquiriesService.submitPublic(payload);
      ui.toast('تم استلام طلبك بنجاح! سيتواصل معك الفريق المختص قريباً.', 'success');
      form.reset();
    } catch (err) {
      ui.applyFieldErrors(form, err.fieldErrors);
      ui.toast(err.message || 'تعذر إرسال الطلب.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// ============================================================================
// P06: Authentication Portal (#/login & #/register) — E04 & E03
// ============================================================================
export async function mountAuthPage({ container, pathname, router }) {
  const isRegisterMode = pathname === '/register';

  container.innerHTML = `
    <div class="auth-container">
      <div class="card">
        <div class="tabs-nav">
          <a href="#/login" class="tab-btn ${!isRegisterMode ? 'is-active' : ''}">تسجيل الدخول (E04)</a>
          <a href="#/register" class="tab-btn ${isRegisterMode ? 'is-active' : ''}">إنشاء حساب مطور (E03)</a>
        </div>

        ${
          !isRegisterMode
            ? `
          <form id="auth-login-form" novalidate>
            <div class="form-group">
              <label class="form-label" for="login-email">البريد الإلكتروني (email) *</label>
              <input id="login-email" name="email" type="email" class="form-control" required autocomplete="username" placeholder="admin@agency.io" />
            </div>
            <div class="form-group" style="margin-top:0.85rem;">
              <label class="form-label" for="login-password">كلمة المرور (password) *</label>
              <input id="login-password" name="password" type="password" class="form-control" required autocomplete="current-password" placeholder="••••••••" />
            </div>
            <div class="card-footer" style="margin-top:1.25rem;">
              <button type="submit" id="login-submit-btn" class="btn btn-primary" style="width:100%;">دخول إلى مساحة العمل</button>
            </div>
          </form>
        `
            : `
          <div class="alert-banner alert-warning">
            <span>ملاحظة: قد يكون التسجيل الذاتي مغلقاً حسب سياسة المنصة (ALLOW_PUBLIC_REGISTRATION).</span>
          </div>
          <form id="auth-register-form" novalidate>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label" for="reg-name">الاسم الكامل (name) *</label>
                <input id="reg-name" name="name" type="text" class="form-control" required minlength="1" maxlength="100" />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-username">اسم المستخدم (username)</label>
                <input id="reg-username" name="username" type="text" class="form-control" minlength="3" maxlength="50" placeholder="اختياري (يولد تلقائياً)" />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-email">البريد الإلكتروني (email) *</label>
                <input id="reg-email" name="email" type="email" class="form-control" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-password">كلمة المرور (password) * (8+ أحرف)</label>
                <input id="reg-password" name="password" type="password" class="form-control" required minlength="8" maxlength="100" />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-job-title">المسمى الوظيفي (job_title)</label>
                <select id="reg-job-title" name="job_title" class="form-control">
                  ${renderSelectOptions(JobTitle, 'JobTitle', '— اختر التخصص —')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-avatar-url">رابط الصورة الشخصية (avatar_url)</label>
                <input id="reg-avatar-url" name="avatar_url" type="url" class="form-control" placeholder="https://..." />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-github-url">رابط GitHub (github_url)</label>
                <input id="reg-github-url" name="github_url" type="url" class="form-control" placeholder="https://github.com/..." />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-linkedin-url">رابط LinkedIn (linkedin_url)</label>
                <input id="reg-linkedin-url" name="linkedin_url" type="url" class="form-control" placeholder="https://linkedin.com/in/..." />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-website-url">الموقع الشخصي (website_url)</label>
                <input id="reg-website-url" name="website_url" type="url" class="form-control" placeholder="https://..." />
              </div>
            </div>
            <div class="form-group" style="margin-top:0.85rem;">
              <label class="form-label" for="reg-bio">نبذة مهنية (bio)</label>
              <textarea id="reg-bio" name="bio" rows="2" class="form-control" maxlength="500"></textarea>
            </div>
            <div class="form-group" style="margin-top:0.75rem;">
              <label class="checkbox-row">
                <input type="checkbox" name="is_public_member" />
                <span>إظهار ملفي الشخصي في دليل الكفاءات العام (is_public_member)</span>
              </label>
            </div>
            <div class="card-footer" style="margin-top:1.25rem;">
              <button type="submit" id="register-submit-btn" class="btn btn-primary" style="width:100%;">تسجيل الحساب</button>
            </div>
          </form>
        `
        }
      </div>
    </div>
  `;

  const loginForm = container.querySelector('#auth-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = container.querySelector('#login-submit-btn');
      btn.disabled = true;
      const fd = new FormData(loginForm);
      try {
        await authService.login({
          email: fd.get('email'),
          password: fd.get('password'),
        });
        ui.toast('تم تسجيل الدخول بنجاح.', 'success');
        router.navigate('#/app/dashboard');
      } catch (err) {
        ui.applyFieldErrors(loginForm, err.fieldErrors);
        ui.toast(err.message || 'بيانات الاعتماد غير صحيحة.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  const regForm = container.querySelector('#auth-register-form');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = container.querySelector('#register-submit-btn');
      btn.disabled = true;
      const fd = new FormData(regForm);
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
          is_public_member: fd.get('is_public_member') === 'on',
          is_super_admin: false,
        };
        await authService.register(payload);
        ui.toast('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.', 'success');
        router.navigate('#/login');
      } catch (err) {
        ui.applyFieldErrors(regForm, err.fieldErrors);
        ui.toast(err.message || 'تعذر إتمام التسجيل.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }
}

