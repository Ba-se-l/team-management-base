// static/js/pages/public-pages.js — Public Portal Screens P01, P02, P03, P04, P05, P06
import {
  InquiryServiceType,
  JobTitle,
  formatEnumLabel,
} from '../contracts/enums.js';
import { normalizeOptionalUrl } from '../contracts/serializers.js';
import { ui, escapeHtml } from '../core/ui.js';
import { t, tr } from '../core/i18n.js';
import { renderIcon } from '../components/icon.js';
import { renderAvatar, bindLiveAvatarPreview } from '../components/avatar.js';
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
        ${renderIcon('activity', { size: 13 })}
        ${escapeHtml(
          t('app.healthStatus', {
            live: live?.status || 'ok',
            ready: ready?.status || 'ready',
          })
        )}
      </span>
    `;
  } catch {
    strip.innerHTML = `<span class="badge badge-danger">${renderIcon('alert-triangle', { size: 13 })} ${escapeHtml(t('app.healthOffline'))}</span>`;
  }
}

// ============================================================================
// P01: Public Landing & Overview (#/) — E48, E52, E01, E02
// ============================================================================
export async function mountPublicHomePage({ container, scope, isStale }) {
  container.innerHTML = ui.renderLoadingSkeleton(
    tr('جاري تحميل النظرة العامة للمنصة...', 'Loading platform overview...')
  );
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
          <span class="badge badge-brand">${renderIcon('sparkles', { size: 13 })} Team Management Base V1.0</span>
          <h1 style="margin-block-start:0.5rem;">${escapeHtml(tr('منصة هندسة الفرق البرمجية ومعرض الحلول الرقمية', 'Software Team Engineering Platform & Digital Showcase'))}</h1>
          <p style="margin-block-start:0.5rem;max-inline-size:52rem;">
            ${escapeHtml(tr('بيئة عمل معزولة الموارد لإدارة الفرق الهندسية، المشاريع، ولوحات كانبان بمعايير أمان Casbin RBAC، مع بوابة عامة لاستعراض المشاريع المعتمدة واستقبال طلبات التعاون.', 'Resource-isolated workspace for managing engineering teams, projects, and Kanban boards secured by Casbin RBAC, featuring a public showcase portal and client inquiry gateway.'))}
          </p>
        </div>
        <div class="page-header-actions">
          <a href="#/projects" class="btn btn-primary">${renderIcon('folder-kanban', { size: 16 })} <span>${escapeHtml(tr('تصفح معرض المشاريع (P02)', 'Browse Showcase Projects (P02)'))}</span></a>
          <a href="#/contact" class="btn btn-outline">${renderIcon('send', { size: 16 })} <span>${escapeHtml(tr('اطلب مشروعك الآن (P05)', 'Submit Project Inquiry (P05)'))}</span></a>
          <button type="button" class="btn btn-outline" data-scroll-to="home-featured-section">${renderIcon('chevron-down', { size: 16 })} <span>${escapeHtml(tr('المشاريع المميزة', 'Featured Projects'))}</span></button>
        </div>
      </div>

      <div class="stats-grid" style="margin-block-start:1.5rem;">
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(tr('الفرق الهندسية النشطة', 'Active Engineering Teams'))}</div>
          <div class="stat-value">${Number(overview?.total_teams || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(tr('المشاريع العامة المعتمدة', 'Approved Public Projects'))}</div>
          <div class="stat-value">${Number(overview?.total_projects || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(tr('الكفاءات الهندسية بالمعرض', 'Public Engineering Roster'))}</div>
          <div class="stat-value">${Number(overview?.total_public_members || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(tr('التقنيات المعتمدة', 'Standardized Technologies'))}</div>
          <div class="stat-value">${techList.length}</div>
        </div>
      </div>
    </section>

    <section id="home-featured-section" style="margin-block-end:2rem;">
      <div class="page-header">
        <div>
          <h2>${escapeHtml(tr('أبرز المشاريع الهندسية (Featured Showcase)', 'Featured Engineering Showcase'))}</h2>
          <p>${escapeHtml(tr('مشاريع تم اعتمادها ونشرها من قِبل إدارة المنصة.', 'Projects approved and published by platform governance.'))}</p>
        </div>
        <a href="#/projects" class="btn btn-sm btn-outline"><span>${escapeHtml(tr('عرض الكتالوج الكامل', 'View Full Catalog'))}</span> ${renderIcon('arrow-right', { size: 15 })}</a>
      </div>

      ${
        featuredProjects.length === 0
          ? ui.renderEmptyState(
              tr('لا توجد مشاريع مميزة حالياً', 'No Featured Projects Yet'),
              tr('ستظهر المشاريع هنا فور اعتمادها للعرض العام من قِبل مدير المنصة.', 'Projects will appear here once approved for public display by the platform administrator.')
            )
          : `<div class="responsive-card-grid">
              ${featuredProjects
                .map(
                  (proj) => `
                <article class="card">
                  <div class="card-header">
                    <div>
                      <h3><a href="#/projects/${encodeURIComponent(proj.slug)}">${escapeHtml(proj.title)}</a></h3>
                      <span class="field-hint">${escapeHtml(proj.team_name || tr('فريق هندسي', 'Engineering Team'))}</span>
                    </div>
                    ${ui.renderBadge('ProjectStatus', proj.status)}
                  </div>
                  <p>${escapeHtml(proj.short_description)}</p>
                  <div class="page-header-actions">
                    ${(proj.technologies || [])
                      .map((tech) => `<span class="badge">${escapeHtml(tech.name)}</span>`)
                      .join('')}
                  </div>
                  <div class="card-footer">
                    <a href="#/projects/${encodeURIComponent(proj.slug)}" class="btn btn-sm btn-primary">${renderIcon('eye', { size: 15 })} <span>${escapeHtml(tr('التفاصيل الكاملة', 'Full Details'))}</span></a>
                    ${
                      proj.demo_url
                        ? `<a href="${escapeHtml(proj.demo_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline"><span>${escapeHtml(tr('معاينة حية', 'Live Demo'))}</span> ${renderIcon('external-link', { size: 14 })}</a>`
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
          <h2>${escapeHtml(tr('منظومة التقنيات والأدوات المعتمدة', 'Approved Technology Stack & Tools'))}</h2>
          <p>${escapeHtml(tr('الأطر واللغات البرمجية المستخدمة في مشاريع الفرق.', 'Frameworks and languages powering team projects.'))}</p>
        </div>
      </div>
      ${
        techList.length === 0
          ? ui.renderEmptyState(tr('لم يتم تسجيل تقنيات عامة بعد', 'No public technologies registered yet'))
          : `<div class="card">
              <div class="page-header-actions">
                ${techList
                  .map(
                    (tech) => `
                  <a href="#/projects?technology=${encodeURIComponent(tech.slug)}" class="badge badge-brand">
                    ${renderIcon('cpu', { size: 13 })}
                    <span>${escapeHtml(tech.name)} (${escapeHtml(formatEnumLabel('TechnologyCategory', tech.category))})</span>
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
    container.innerHTML = ui.renderLoadingSkeleton(
      tr('جاري تحميل كتالوج المشاريع العامة...', 'Loading public projects catalog...')
    );
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
          <h1>${escapeHtml(tr('كتالوج المشاريع العامة (P02)', 'Public Projects Catalog (P02)'))}</h1>
          <p>${escapeHtml(tr('استعرض المشاريع المنشورة وقم بتصفيتها حسب التقنية أو التميز.', 'Browse published projects and filter by technology or featured status.'))}</p>
        </div>
      </div>

      <form id="public-projects-filter-form" class="filter-bar">
        <div class="form-group">
          <label class="form-label" for="filter-tech">${escapeHtml(tr('التقنية (Technology Slug)', 'Technology (Slug)'))}</label>
          <select id="filter-tech" name="technology" class="form-control">
            <option value="">${escapeHtml(tr('كل التقنيات', 'All Technologies'))}</option>
            ${technologies
              .map(
                (tech) =>
                  `<option value="${escapeHtml(tech.slug)}" ${
                    filterState.technology === tech.slug ? 'selected' : ''
                  }>${escapeHtml(tech.name)}</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="filter-featured">${escapeHtml(tr('تصنيف العرض', 'Featured Filter'))}</label>
          <select id="filter-featured" name="featured" class="form-control">
            <option value="" ${filterState.featured === '' ? 'selected' : ''}>${escapeHtml(tr('الكل', 'All'))}</option>
            <option value="true" ${filterState.featured === 'true' ? 'selected' : ''}>${escapeHtml(tr('المميزة فقط (Featured)', 'Featured Only'))}</option>
            <option value="false" ${filterState.featured === 'false' ? 'selected' : ''}>${escapeHtml(tr('غير المميزة', 'Non-Featured'))}</option>
          </select>
        </div>

        <div class="page-header-actions">
          <button type="submit" class="btn btn-primary">${renderIcon('filter', { size: 15 })} <span>${escapeHtml(t('common.applyFilter'))}</span></button>
          <button type="button" id="reset-pub-proj-filter" class="btn btn-outline">${renderIcon('refresh-cw', { size: 15 })} <span>${escapeHtml(t('common.reset'))}</span></button>
        </div>
      </form>

      ${
        pageModel.items.length === 0
          ? ui.renderEmptyState(tr('لا توجد مشاريع مطابقة لمعايير التصفية الحالية', 'No projects match the current filters'))
          : `<div class="responsive-card-grid">
              ${pageModel.items
                .map(
                  (proj) => `
                <article class="card">
                  <div class="card-header">
                    <div>
                      <h3><a href="#/projects/${encodeURIComponent(proj.slug)}">${escapeHtml(proj.title)}</a></h3>
                      <span class="field-hint">${escapeHtml(tr('الفريق:', 'Team:'))} ${escapeHtml(proj.team_name || '—')}</span>
                    </div>
                    <div class="page-header-actions">
                      ${proj.featured ? `<span class="badge badge-warning">${renderIcon('star', { size: 13 })} ${escapeHtml(tr('مميز', 'Featured'))}</span>` : ''}
                      ${ui.renderBadge('ProjectStatus', proj.status)}
                    </div>
                  </div>
                  <p>${escapeHtml(proj.short_description)}</p>
                  <div class="page-header-actions">
                    ${(proj.technologies || [])
                      .map((tech) => `<span class="badge">${escapeHtml(tech.name)}</span>`)
                      .join('')}
                  </div>
                  <div class="card-footer">
                    <a href="#/projects/${encodeURIComponent(proj.slug)}" class="btn btn-sm btn-primary">${renderIcon('eye', { size: 15 })} <span>${escapeHtml(tr('عرض التفاصيل', 'View Details'))}</span></a>
                    <div class="page-header-actions">
                      ${
                        proj.demo_url
                          ? `<a href="${escapeHtml(proj.demo_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline"><span>${escapeHtml(tr('معاينة', 'Demo'))}</span> ${renderIcon('external-link', { size: 14 })}</a>`
                          : ''
                      }
                      ${
                        proj.repo_url
                          ? `<a href="${escapeHtml(proj.repo_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline"><span>${escapeHtml(tr('المستودع', 'Repo'))}</span> ${renderIcon('github', { size: 14 })}</a>`
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
  container.innerHTML = ui.renderLoadingSkeleton(
    tr('جاري تحميل بيانات المشروع...', 'Loading project details...')
  );

  let project = null;
  try {
    project = await showcaseService.getProjectBySlug(params.slug, scope.signal);
  } catch (err) {
    if (isStale()) return;
    if (err.status === 404) {
      container.innerHTML = ui.renderEmptyState(
        tr('المشروع غير موجود (404)', 'Project Not Found (404)'),
        tr(
          `لم يتم العثور على مشروع عام بالمعرف النصي "${params.slug}".`,
          `No public project found with slug "${params.slug}".`
        ),
        `<a href="#/projects" class="btn btn-primary">${renderIcon('arrow-left', { size: 15 })} <span>${escapeHtml(tr('العودة إلى معرض المشاريع', 'Back to Projects Showcase'))}</span></a>`
      );
      return;
    }
    throw err;
  }

  if (isStale()) return;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-header-actions" style="margin-block-end:0.5rem;">
          <a href="#/projects" class="btn btn-sm btn-outline">${renderIcon('arrow-left', { size: 15 })} <span>${escapeHtml(tr('العودة للمعرض', 'Back to Showcase'))}</span></a>
          <span class="badge mono">${escapeHtml(project.slug)}</span>
          ${project.featured ? `<span class="badge badge-warning">${renderIcon('star', { size: 13 })} ${escapeHtml(tr('مشروع مميز', 'Featured Project'))}</span>` : ''}
          ${ui.renderBadge('ProjectStatus', project.status)}
        </div>
        <h1>${escapeHtml(project.title)}</h1>
        <p class="field-hint">${escapeHtml(tr('الفريق الهندسي:', 'Engineering Team:'))} <strong>${escapeHtml(project.team_name || '—')}</strong> | ${escapeHtml(tr('تاريخ النشر:', 'Released:'))} ${ui.formatDateTime(project.released_at || project.created_at)}</p>
      </div>
      <div class="page-header-actions">
        ${
          project.demo_url
            ? `<a href="${escapeHtml(project.demo_url)}" target="_blank" rel="noopener" class="btn btn-primary"><span>${escapeHtml(tr('فتح النسخة التجريبية', 'Open Live Demo'))}</span> ${renderIcon('external-link', { size: 15 })}</a>`
            : ''
        }
        ${
          project.repo_url
            ? `<a href="${escapeHtml(project.repo_url)}" target="_blank" rel="noopener" class="btn btn-outline"><span>${escapeHtml(tr('مستودع الكود', 'Source Repository'))}</span> ${renderIcon('github', { size: 15 })}</a>`
            : ''
        }
      </div>
    </div>

    <div class="split-grid">
      <div class="card">
        <h3>${escapeHtml(tr('نبذة مختصرة', 'Executive Summary'))}</h3>
        <p>${escapeHtml(project.short_description)}</p>
        <h3 style="margin-block-start:1rem;">${escapeHtml(tr('التفاصيل المعمارية والوصف الكامل', 'Architecture & Full Description'))}</h3>
        <p style="white-space:pre-line;">${escapeHtml(project.description || tr('لا يوجد وصف تفصيلي إضافي.', 'No additional detailed description provided.'))}</p>
      </div>

      <div class="card">
        <h3>${escapeHtml(tr('المكدس التقني (Tech Stack)', 'Technology Stack'))}</h3>
        ${
          (project.technologies || []).length === 0
            ? `<p class="field-hint">${escapeHtml(tr('لم يتم ربط تقنيات محددة بهذا المشروع.', 'No specific technologies linked to this project.'))}</p>`
            : `<div class="page-header-actions">
                ${project.technologies
                  .map(
                    (tech) => `
                  <span class="badge badge-brand">
                    ${renderIcon('cpu', { size: 13 })}
                    <span>${escapeHtml(tech.name)} — ${escapeHtml(formatEnumLabel('TechnologyCategory', tech.category))}</span>
                  </span>
                `
                  )
                  .join('')}
              </div>`
        }
        <div class="card-footer">
          <span>${escapeHtml(tr('هل ترغب ببناء مشروع مشابه؟', 'Interested in building a similar solution?'))}</span>
          <a href="#/contact" class="btn btn-sm btn-primary">${renderIcon('send', { size: 14 })} <span>${escapeHtml(tr('تواصل مع الفريق', 'Contact Team'))}</span></a>
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
    container.innerHTML = ui.renderLoadingSkeleton(
      tr('جاري تحميل قائمة الكفاءات الهندسية...', 'Loading engineering talent roster...')
    );
    const pageModel = await showcaseService.listMembers({ offset: currentOffset, limit }, scope.signal);
    if (isStale()) return;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${escapeHtml(tr('دليل الكفاءات الهندسية العام (P04)', 'Public Engineering Roster (P04)'))}</h1>
          <p>${escapeHtml(tr('أعضاء الفرق الذين اختاروا إظهار ملفاتهم المهنية في البوابة العامة (Opt-in Public Roster).', 'Team members who opted in to showcase their professional profiles publicly.'))}</p>
        </div>
      </div>

      ${
        pageModel.items.length === 0
          ? ui.renderEmptyState(tr('لا يوجد أعضاء في الدليل العام حالياً', 'No public members in the roster yet'))
          : `<div class="responsive-card-grid">
              ${pageModel.items
                .map(
                  (m) => `
                <article class="card">
                  <div class="card-header">
                    <div class="avatar-row">
                      ${renderAvatar(m, { size: 'lg' })}
                      <div class="avatar-meta">
                        <h3 class="avatar-name">${escapeHtml(m.name)}</h3>
                        <span class="avatar-sub mono">@${escapeHtml(m.username)}</span>
                      </div>
                    </div>
                    ${m.job_title ? ui.renderBadge('JobTitle', m.job_title) : ''}
                  </div>
                  <p>${escapeHtml(m.bio || tr('مهندس برمجيات ضمن فرق المنصة.', 'Software engineer on the platform.'))}</p>
                  <div class="card-footer">
                    <div class="page-header-actions">
                      ${
                        m.github_url
                          ? `<a href="${escapeHtml(m.github_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">${renderIcon('github', { size: 14 })} <span>GitHub</span></a>`
                          : ''
                      }
                      ${
                        m.linkedin_url
                          ? `<a href="${escapeHtml(m.linkedin_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">${renderIcon('linkedin', { size: 14 })} <span>LinkedIn</span></a>`
                          : ''
                      }
                      ${
                        m.portfolio_url
                          ? `<a href="${escapeHtml(m.portfolio_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-primary">${renderIcon('link-2', { size: 14 })} <span>${escapeHtml(tr('معرض الأعمال', 'Portfolio'))}</span></a>`
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
        <h1>${escapeHtml(tr('تواصل معنا / طلب مشروع أو انضمام (P05)', 'Contact Us / Project & Join Inquiry (P05)'))}</h1>
        <p>${escapeHtml(tr('أرسل تفاصيل مشروعك أو طلب الانضمام ليتم فرزه ومراجعته من قِبل الإدارة الهندسية.', 'Submit your project requirements or join request for triage by engineering management.'))}</p>
      </div>
    </div>

    <div class="card" style="max-inline-size:48rem;margin-inline:auto;">
      <form id="public-inquiry-form" novalidate>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="inq-client-name">${escapeHtml(tr('الاسم الكامل (client_name) *', 'Full Name (client_name) *'))}</label>
            <input id="inq-client-name" name="client_name" type="text" class="form-control" required minlength="2" maxlength="100" placeholder="${escapeHtml(tr('مثال: م. أحمد العلي', 'e.g., Jane Doe'))}" />
          </div>

          <div class="form-group">
            <label class="form-label" for="inq-client-email">${escapeHtml(tr('البريد الإلكتروني (client_email) *', 'Email Address (client_email) *'))}</label>
            <input id="inq-client-email" name="client_email" type="email" class="form-control" required placeholder="name@company.com" />
          </div>

          <div class="form-group">
            <label class="form-label" for="inq-company-name">${escapeHtml(tr('اسم الجهة / الشركة (company_name)', 'Company / Organization (company_name)'))}</label>
            <input id="inq-company-name" name="company_name" type="text" class="form-control" maxlength="150" placeholder="${escapeHtml(t('common.optional'))}" />
          </div>

          <div class="form-group">
            <label class="form-label" for="inq-service-type">${escapeHtml(tr('نوع الخدمة المطلوبة (service_type) *', 'Requested Service Type (service_type) *'))}</label>
            <select id="inq-service-type" name="service_type" class="form-control" required>
              ${renderSelectOptions(InquiryServiceType, 'InquiryServiceType')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="inq-budget-range">${escapeHtml(tr('النطاق التقديري للميزانية (budget_range)', 'Estimated Budget Range (budget_range)'))}</label>
            <input id="inq-budget-range" name="budget_range" type="text" class="form-control" maxlength="50" placeholder="$5,000 - $15,000" />
          </div>
        </div>

        <!-- Bot Honeypot Field (Strictly hidden via CSS & aria-hidden) -->
        <div class="hp-trap-field" aria-hidden="true">
          <label for="inq-honeypot">Leave this field empty</label>
          <input id="inq-honeypot" name="honeypot" type="text" tabindex="-1" autocomplete="off" />
        </div>

        <div class="form-group" style="margin-block-start:1rem;">
          <label class="form-label" for="inq-message">${escapeHtml(tr('تفاصيل الطلب أو الرسالة (message) * (10–3000 حرف)', 'Inquiry Details / Message (message) * (10–3000 chars)'))}</label>
          <textarea id="inq-message" name="message" rows="5" class="form-control" required minlength="10" maxlength="3000" placeholder="${escapeHtml(tr('اشرح المتطلبات التقنية والأهداف...', 'Describe technical requirements and goals...'))}"></textarea>
        </div>

        <div class="card-footer" style="margin-block-start:1rem;">
          <span class="field-hint">${escapeHtml(tr('تتم حماية هذا النموذج بمحدد معدل الطلبات (Rate Limiter) وفخ البوتات.', 'Protected by rate limiting and automated bot honeypot.'))}</span>
          <button type="submit" id="inq-submit-btn" class="btn btn-primary">${renderIcon('send', { size: 15 })} <span>${escapeHtml(tr('إرسال الطلب الآن', 'Submit Inquiry Now'))}</span></button>
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
      ui.toast(
        tr('تم استلام طلبك بنجاح! سيتواصل معك الفريق المختص قريباً.', 'Your inquiry has been submitted! Our team will contact you soon.'),
        'success'
      );
      form.reset();
    } catch (err) {
      ui.applyFieldErrors(form, err.fieldErrors);
      ui.toast(err.message || tr('تعذر إرسال الطلب.', 'Failed to submit inquiry.'), 'error');
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
          <a href="#/login" class="tab-btn ${!isRegisterMode ? 'is-active' : ''}">${renderIcon('lock', { size: 15 })} <span>${escapeHtml(tr('تسجيل الدخول (E04)', 'Sign In (E04)'))}</span></a>
          <a href="#/register" class="tab-btn ${isRegisterMode ? 'is-active' : ''}">${renderIcon('user-plus', { size: 15 })} <span>${escapeHtml(tr('إنشاء حساب مطور (E03)', 'Register Developer Account (E03)'))}</span></a>
        </div>

        ${
          !isRegisterMode
            ? `
          <form id="auth-login-form" novalidate>
            <div class="form-group">
              <label class="form-label" for="login-email">${escapeHtml(tr('البريد الإلكتروني (email) *', 'Email Address (email) *'))}</label>
              <input id="login-email" name="email" type="email" class="form-control" required autocomplete="username" placeholder="admin@agency.io" />
            </div>
            <div class="form-group" style="margin-block-start:0.85rem;">
              <label class="form-label" for="login-password">${escapeHtml(tr('كلمة المرور (password) *', 'Password (password) *'))}</label>
              <input id="login-password" name="password" type="password" class="form-control" required autocomplete="current-password" placeholder="••••••••" />
            </div>
            <div class="card-footer" style="margin-block-start:1.25rem;">
              <button type="submit" id="login-submit-btn" class="btn btn-primary" style="inline-size:100%;">${renderIcon('lock', { size: 15 })} <span>${escapeHtml(tr('دخول إلى مساحة العمل', 'Sign In to Workspace'))}</span></button>
            </div>
          </form>
        `
            : `
          <div class="alert-banner alert-warning">
            <span>${escapeHtml(tr('ملاحظة: قد يكون التسجيل الذاتي مغلقاً حسب سياسة المنصة (ALLOW_PUBLIC_REGISTRATION).', 'Note: Self-registration may be disabled depending on platform policy (ALLOW_PUBLIC_REGISTRATION).'))}</span>
          </div>
          <form id="auth-register-form" novalidate>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label" for="reg-name">${escapeHtml(tr('الاسم الكامل (name) *', 'Full Name (name) *'))}</label>
                <input id="reg-name" name="name" type="text" class="form-control" required minlength="1" maxlength="100" />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-username">${escapeHtml(tr('اسم المستخدم (username)', 'Username (username)'))}</label>
                <input id="reg-username" name="username" type="text" class="form-control" minlength="3" maxlength="50" placeholder="${escapeHtml(tr('اختياري (يولد تلقائياً)', 'Optional (auto-generated)'))}" />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-email">${escapeHtml(tr('البريد الإلكتروني (email) *', 'Email Address (email) *'))}</label>
                <input id="reg-email" name="email" type="email" class="form-control" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-password">${escapeHtml(tr('كلمة المرور (password) * (8+ أحرف)', 'Password (password) * (8+ chars)'))}</label>
                <input id="reg-password" name="password" type="password" class="form-control" required minlength="8" maxlength="100" />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-job-title">${escapeHtml(tr('المسمى الوظيفي (job_title)', 'Job Title (job_title)'))}</label>
                <select id="reg-job-title" name="job_title" class="form-control">
                  ${renderSelectOptions(JobTitle, 'JobTitle', tr('— اختر التخصص —', '— Select Specialization —'))}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-avatar-url">${escapeHtml(tr('رابط الصورة الشخصية (avatar_url)', 'Avatar Image URL (avatar_url)'))}</label>
                <input id="reg-avatar-url" name="avatar_url" type="url" class="form-control" placeholder="https://..." />
                <div class="avatar-preview-box">
                  <span id="reg-avatar-preview"></span>
                  <span class="field-hint">${escapeHtml(t('common.avatarPreviewHint'))}</span>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-github-url">${escapeHtml(tr('رابط GitHub (github_url)', 'GitHub URL (github_url)'))}</label>
                <input id="reg-github-url" name="github_url" type="url" class="form-control" placeholder="https://github.com/..." />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-linkedin-url">${escapeHtml(tr('رابط LinkedIn (linkedin_url)', 'LinkedIn URL (linkedin_url)'))}</label>
                <input id="reg-linkedin-url" name="linkedin_url" type="url" class="form-control" placeholder="https://linkedin.com/in/..." />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-website-url">${escapeHtml(tr('الموقع الشخصي (website_url)', 'Personal Website (website_url)'))}</label>
                <input id="reg-website-url" name="website_url" type="url" class="form-control" placeholder="https://..." />
              </div>
            </div>
            <div class="form-group" style="margin-block-start:0.85rem;">
              <label class="form-label" for="reg-bio">${escapeHtml(tr('نبذة مهنية (bio)', 'Professional Bio (bio)'))}</label>
              <textarea id="reg-bio" name="bio" rows="2" class="form-control" maxlength="500"></textarea>
            </div>
            <div class="form-group" style="margin-block-start:0.75rem;">
              <label class="checkbox-row">
                <input type="checkbox" name="is_public_member" />
                <span>${escapeHtml(tr('إظهار ملفي الشخصي في دليل الكفاءات العام (is_public_member)', 'Display my profile in the public engineering roster (is_public_member)'))}</span>
              </label>
            </div>
            <div class="card-footer" style="margin-block-start:1.25rem;">
              <button type="submit" id="register-submit-btn" class="btn btn-primary" style="inline-size:100%;">${renderIcon('user-plus', { size: 15 })} <span>${escapeHtml(tr('تسجيل الحساب', 'Create Account'))}</span></button>
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
        ui.toast(tr('تم تسجيل الدخول بنجاح.', 'Signed in successfully.'), 'success');
        router.navigate('#/app/dashboard');
      } catch (err) {
        ui.applyFieldErrors(loginForm, err.fieldErrors);
        ui.toast(err.message || tr('بيانات الاعتماد غير صحيحة.', 'Invalid credentials.'), 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  const regForm = container.querySelector('#auth-register-form');
  if (regForm) {
    bindLiveAvatarPreview({
      inputEl: regForm.querySelector('#reg-avatar-url'),
      nameInputEl: regForm.querySelector('#reg-name'),
      previewContainerEl: regForm.querySelector('#reg-avatar-preview'),
      fallbackName: 'TM',
    });

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
        ui.toast(
          tr('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.', 'Account created! You can now sign in.'),
          'success'
        );
        router.navigate('#/login');
      } catch (err) {
        ui.applyFieldErrors(regForm, err.fieldErrors);
        ui.toast(err.message || tr('تعذر إتمام التسجيل.', 'Registration failed.'), 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }
}
