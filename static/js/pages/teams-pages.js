// static/js/pages/teams-pages.js — Screens P08 (Teams Directory) & P09 (Team Workspace & Members)
import {
  TeamRole,
  ProjectStatus,
  ProjectVisibility,
  TechnologyCategory,
  formatEnumLabel,
} from '../contracts/enums.js';
import {
  normalizeOptionalUrl,
  toUtcIsoOrNull,
} from '../contracts/serializers.js';
import { store } from '../core/store.js';
import { capabilities } from '../core/capabilities.js';
import { ui, escapeHtml } from '../core/ui.js';
import { teamsService } from '../services/teams.js';
import { membersService } from '../services/members.js';
import { projectsService } from '../services/projects.js';
import { usersService } from '../services/users.js';
import { technologiesService } from '../services/technologies.js';

function renderEnumOptions(enumObj, groupName, selectedVal = '', emptyLabel = '') {
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
// Shared Create Project Modal (E25: POST /api/v1/teams/{team_id}/projects — 10 Fields)
// Integrates live Technology Catalog list (E43) and search (E44)
// ============================================================================
export async function openCreateProjectModal({ teamId, teamsList = [], onCreated }) {
  const state = store.getState();
  const resolvedTeamId = teamId || (teamsList[0] ? teamsList[0].id : null);
  const allowedVisibilities = capabilities.getAllowedProjectVisibilities(
    state,
    resolvedTeamId
  );

  let initialTechs = [];
  try {
    const techPage = await technologiesService.list({ skip: 0, limit: 60 });
    initialTechs = techPage.items;
  } catch {
    initialTechs = [];
  }

  const selectedTechIds = new Set();

  ui.openModal({
    title: 'إنشاء مشروع هندسي جديد (E25 — CreateProjectRequest)',
    bodyHtml: `
      <form id="create-project-modal-form" novalidate>
        ${
          !teamId && teamsList.length > 0
            ? `<div class="form-group" style="margin-bottom:0.85rem;">
                <label class="form-label" for="proj-team-select">الفريق المالك للمشروع (team_id) *</label>
                <select id="proj-team-select" name="team_id" class="form-control" required>
                  ${teamsList
                    .map(
                      (t) =>
                        `<option value="${t.id}">${escapeHtml(t.name)} (#${t.id})</option>`
                    )
                    .join('')}
                </select>
              </div>`
            : ''
        }

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="cp-title">عنوان المشروع (title) *</label>
            <input id="cp-title" name="title" type="text" class="form-control" required minlength="2" maxlength="150" placeholder="مثال: بوابة الدفع السحابية" />
          </div>
          <div class="form-group">
            <label class="form-label" for="cp-slug">المعرف النصي (slug — اختياري)</label>
            <input id="cp-slug" name="slug" type="text" class="form-control" maxlength="160" placeholder="cloud-payment-gateway" />
          </div>
          <div class="form-group">
            <label class="form-label" for="cp-status">حالة المشروع (status) *</label>
            <select id="cp-status" name="status" class="form-control" required>
              ${renderEnumOptions(ProjectStatus, 'ProjectStatus', ProjectStatus.PLANNING)}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="cp-visibility">مستوى الظهور (visibility) *</label>
            <select id="cp-visibility" name="visibility" class="form-control" required>
              ${allowedVisibilities
                .map(
                  (v) =>
                    `<option value="${escapeHtml(v)}">${escapeHtml(
                      formatEnumLabel('ProjectVisibility', v)
                    )}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="cp-demo-url">رابط المعاينة الحية (demo_url)</label>
            <input id="cp-demo-url" name="demo_url" type="url" class="form-control" placeholder="https://demo.agency.io" />
          </div>
          <div class="form-group">
            <label class="form-label" for="cp-repo-url">رابط المستودع البرمجي (repo_url)</label>
            <input id="cp-repo-url" name="repo_url" type="url" class="form-control" placeholder="https://github.com/..." />
          </div>
          <div class="form-group">
            <label class="form-label" for="cp-deadline">الموعد النهائي للتسليم (deadline)</label>
            <input id="cp-deadline" name="deadline" type="datetime-local" class="form-control" />
          </div>
        </div>

        <div class="form-group" style="margin-top:0.85rem;">
          <label class="form-label" for="cp-short-desc">وصف مختصر للمشروع (short_description) * (5–500 حرف)</label>
          <input id="cp-short-desc" name="short_description" type="text" class="form-control" required minlength="5" maxlength="500" />
        </div>

        <div class="form-group" style="margin-top:0.85rem;">
          <label class="form-label" for="cp-desc">الوصف المعماري التفصيلي (description)</label>
          <textarea id="cp-desc" name="description" rows="3" class="form-control" maxlength="5000"></textarea>
        </div>

        <!-- Technology Multi-Select Picker using E43 & E44 -->
        <div class="form-group" style="margin-top:0.85rem;">
          <label class="form-label">المكدس التقني المرتبط (technology_ids — E43 & E44)</label>
          <div class="tech-picker-box">
            <div class="page-header-actions">
              <input id="cp-tech-search-q" type="text" class="form-control" style="max-width:14rem;" placeholder="ابحث عن تقنية (E44)..." />
              <select id="cp-tech-search-cat" class="form-control" style="max-width:12rem;">
                ${renderEnumOptions(TechnologyCategory, 'TechnologyCategory', '', 'كل الفئات')}
              </select>
              <button type="button" id="cp-tech-search-btn" class="btn btn-sm btn-outline">بحث في الكتالوج (E44)</button>
            </div>
            <div id="cp-tech-chips-container" class="tech-chips-list"></div>
          </div>
        </div>

        <div class="modal-footer" style="margin-top:1rem;padding:0;border:none;background:transparent;">
          <button type="button" class="btn btn-outline" data-close-modal="true">إلغاء</button>
          <button type="submit" id="cp-submit-btn" class="btn btn-primary">إنشاء المشروع (E25)</button>
        </div>
      </form>
    `,
    onMount: (dialog) => {
      const chipsContainer = dialog.querySelector('#cp-tech-chips-container');

      const renderTechChips = (techArray) => {
        if (!techArray || techArray.length === 0) {
          chipsContainer.innerHTML = `<span class="field-hint">لا توجد تقنيات مطابقة.</span>`;
          return;
        }
        chipsContainer.innerHTML = techArray
          .map((t) => {
            const isSel = selectedTechIds.has(Number(t.id));
            return `
              <button type="button" class="tech-chip-option ${isSel ? 'is-selected' : ''}" data-tech-chip="${t.id}">
                <span>${isSel ? '✓' : '+'}</span>
                <span>${escapeHtml(t.name)}</span>
              </button>
            `;
          })
          .join('');

        chipsContainer.querySelectorAll('[data-tech-chip]').forEach((chip) => {
          chip.addEventListener('click', () => {
            const id = Number(chip.getAttribute('data-tech-chip'));
            if (selectedTechIds.has(id)) {
              selectedTechIds.delete(id);
            } else {
              selectedTechIds.add(id);
            }
            renderTechChips(techArray);
          });
        });
      };

      renderTechChips(initialTechs);

      // Live Technology Search (E44)
      const searchBtn = dialog.querySelector('#cp-tech-search-btn');
      searchBtn.addEventListener('click', async () => {
        const q = dialog.querySelector('#cp-tech-search-q').value.trim();
        const category = dialog.querySelector('#cp-tech-search-cat').value;
        try {
          const res = await technologiesService.search({ q, category, skip: 0, limit: 50 });
          renderTechChips(res.items);
        } catch (err) {
          ui.toast(err.message || 'تعذر البحث في التقنيات.', 'error');
        }
      });

      // Submit Create Project (E25)
      const form = dialog.querySelector('#create-project-modal-form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = dialog.querySelector('#cp-submit-btn');
        btn.disabled = true;
        const fd = new FormData(form);
        const targetTeamId = Number(teamId || fd.get('team_id'));

        try {
          const payload = {
            title: String(fd.get('title') || '').trim(),
            slug: String(fd.get('slug') || '').trim() || null,
            short_description: String(fd.get('short_description') || '').trim(),
            description: String(fd.get('description') || '').trim() || null,
            status: String(fd.get('status') || ProjectStatus.PLANNING),
            visibility: String(fd.get('visibility') || ProjectVisibility.PRIVATE),
            demo_url: normalizeOptionalUrl(fd.get('demo_url')),
            repo_url: normalizeOptionalUrl(fd.get('repo_url')),
            deadline: toUtcIsoOrNull(fd.get('deadline')),
            technology_ids: Array.from(selectedTechIds),
          };
          const created = await projectsService.create(targetTeamId, payload);
          ui.closeModal();
          ui.toast(`تم إنشاء المشروع "${created.title}" بنجاح (E25).`, 'success');
          if (typeof onCreated === 'function') onCreated(created);
        } catch (err) {
          ui.applyFieldErrors(form, err.fieldErrors);
          ui.toast(err.message || 'تعذر إنشاء المشروع.', 'error');
          btn.disabled = false;
        }
      });
    },
  });
}

// ============================================================================
// P08: Teams Directory & Deactivated Team Recovery (#/app/teams) — E16, E17, E18, E19
// ============================================================================
export async function mountTeamsPage({ container, scope, router, isStale }) {
  let offset = 0;
  const limit = 20;

  const loadTeams = async () => {
    container.innerHTML = ui.renderLoadingSkeleton('جاري تحميل قائمة الفرق الهندسية (E17)...');
    const pageModel = await teamsService.list({ offset, limit }, scope.signal);
    if (isStale()) return;

    const deactivatedTeams = store.getState().recentlyDeactivated?.teams || [];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>دليل الفرق الهندسية (P08)</h1>
          <p>يمكن لأي مطور مصادق إنشاء فريق جديد ليصبح قائداً له تلقائياً (E16).</p>
        </div>
        <div class="page-header-actions">
          <form id="open-team-by-id-form" class="page-header-actions">
            <input name="team_id" type="number" min="1" class="form-control" style="width:12rem;" placeholder="فتح/استرجاع فريق بالمعرف #" required />
            <button type="submit" class="btn btn-sm btn-outline">فتح مساحة الفريق (E18)</button>
          </form>
          <button type="button" id="open-create-team-modal-btn" class="btn btn-primary">+ إنشاء فريق جديد (E16)</button>
        </div>
      </div>

      ${
        deactivatedTeams.length > 0
          ? `<div class="alert-banner alert-warning">
              <div>
                <strong>فرق تم تعطيلها مؤخراً في هذه الجلسة (قابلة للاستعادة عبر E19):</strong>
                <div class="page-header-actions" style="margin-top:0.4rem;">
                  ${deactivatedTeams
                    .map(
                      (dt) => `
                    <span class="badge badge-warning">
                      ${escapeHtml(dt.label)} (#${dt.id})
                      <button type="button" class="btn btn-sm btn-outline" data-restore-team="${dt.id}">إعادة تفعيل (E19)</button>
                      <a href="#/app/teams/${dt.id}" class="btn btn-sm btn-outline">فتح</a>
                    </span>
                  `
                    )
                    .join('')}
                </div>
              </div>
            </div>`
          : ''
      }

      ${
        pageModel.items.length === 0
          ? ui.renderEmptyState(
              'لا توجد فرق نشطة حالياً',
              'ابدأ بإنشاء فريق هندسي جديد لإدارة المشاريع والمهام.'
            )
          : `<div class="responsive-card-grid">
              ${pageModel.items
                .map(
                  (team) => `
                <article class="card">
                  <div class="card-header">
                    <div>
                      <h3><a href="#/app/teams/${team.id}">${escapeHtml(team.name)}</a></h3>
                      <span class="field-hint mono">#${team.id} — ${escapeHtml(team.slug)}</span>
                    </div>
                    ${ui.renderBooleanBadge(team.is_active)}
                  </div>
                  <p>${escapeHtml(team.description || 'لا يوجد وصف مسجل لهذا الفريق.')}</p>
                  <div class="page-header-actions">
                    <span class="badge">الأعضاء: ${Number(team.members_count || 0)}</span>
                    <span class="badge">المشاريع: ${Number(team.projects_count || 0)}</span>
                  </div>
                  <div class="card-footer">
                    <span class="field-hint">تاريخ الإنشاء: ${ui.formatDateTime(team.created_at)}</span>
                    <a href="#/app/teams/${team.id}" class="btn btn-sm btn-primary">إدارة الفريق (P09)</a>
                  </div>
                </article>
              `
                )
                .join('')}
            </div>
            ${ui.renderPaginationBar(pageModel, 'teams-list')}`
      }
    `;

    // Open Team by ID (Supports reaching deactivated teams via E18)
    const openByIdForm = container.querySelector('#open-team-by-id-form');
    openByIdForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const tid = Number(new FormData(openByIdForm).get('team_id'));
      if (tid > 0) {
        router.navigate(`#/app/teams/${tid}`);
      }
    });

    // Quick Reactivate Team (E19)
    container.querySelectorAll('[data-restore-team]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tid = Number(btn.getAttribute('data-restore-team'));
        btn.disabled = true;
        try {
          await teamsService.update(tid, { is_active: false }, { is_active: true });
          ui.toast(`تمت إعادة تفعيل الفريق #${tid} بنجاح (E19).`, 'success');
          loadTeams();
        } catch (err) {
          ui.toast(err.message || 'تعذر إعادة تفعيل الفريق.', 'error');
          btn.disabled = false;
        }
      });
    });

    // Create Team Modal (E16: 3 fields in CreateTeamRequest)
    container.querySelector('#open-create-team-modal-btn').addEventListener('click', () => {
      ui.openModal({
        title: 'إنشاء فريق هندسي جديد (E16 — CreateTeamRequest)',
        bodyHtml: `
          <form id="create-team-form" novalidate>
            <div class="form-group">
              <label class="form-label" for="ct-name">اسم الفريق (name) *</label>
              <input id="ct-name" name="name" type="text" class="form-control" required minlength="2" maxlength="100" placeholder="مثال: فريق البنية التحتية السحابية" />
            </div>
            <div class="form-group" style="margin-top:0.85rem;">
              <label class="form-label" for="ct-slug">المعرف النصي (slug — اختياري)</label>
              <input id="ct-slug" name="slug" type="text" class="form-control" maxlength="120" placeholder="cloud-infra-team" />
            </div>
            <div class="form-group" style="margin-top:0.85rem;">
              <label class="form-label" for="ct-desc">وصف الفريق ومهامه (description)</label>
              <textarea id="ct-desc" name="description" rows="3" class="form-control" maxlength="500"></textarea>
            </div>
            <div class="modal-footer" style="margin-top:1rem;padding:0;border:none;background:transparent;">
              <button type="button" class="btn btn-outline" data-close-modal="true">إلغاء</button>
              <button type="submit" id="ct-submit-btn" class="btn btn-primary">إنشاء الفريق (E16)</button>
            </div>
          </form>
        `,
        onMount: (dialog) => {
          const form = dialog.querySelector('#create-team-form');
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = dialog.querySelector('#ct-submit-btn');
            submitBtn.disabled = true;
            const fd = new FormData(form);
            try {
              const created = await teamsService.create({
                name: String(fd.get('name') || '').trim(),
                slug: String(fd.get('slug') || '').trim() || null,
                description: String(fd.get('description') || '').trim() || null,
              });
              ui.closeModal();
              ui.toast(`تم إنشاء الفريق "${created.name}" وتحديث صلاحياتك كقائد فريق (E16 + E08).`, 'success');
              router.navigate(`#/app/teams/${created.id}`);
            } catch (err) {
              ui.applyFieldErrors(form, err.fieldErrors);
              ui.toast(err.message || 'تعذر إنشاء الفريق.', 'error');
              submitBtn.disabled = false;
            }
          });
        },
      });
    });

    ui.bindPaginationBar(
      container,
      pageModel,
      (nextOffset) => {
        offset = nextOffset;
        loadTeams();
      },
      'teams-list'
    );
  };

  await loadTeams();
}

// ============================================================================
// P09: Team Workspace & Members Management (#/app/teams/:teamId)
// Operations: E18, E19, E20, E21, E22, E23, E24, E15, E25, E26
// ============================================================================
export async function mountTeamWorkspacePage({ container, params, scope, router, isStale }) {
  const teamId = Number(params.teamId);
  let activeTab = 'members';
  let projectStatusFilter = '';

  const loadWorkspace = async () => {
    container.innerHTML = ui.renderLoadingSkeleton(`جاري تحميل مساحة عمل الفريق #${teamId} (E18)...`);

    let team = null;
    try {
      team = await teamsService.getById(teamId, scope.signal);
    } catch (err) {
      if (isStale()) return;
      // If team is deactivated (422 InactiveEntityException) and user is Team Admin / Super Admin, offer direct reactivation via E19!
      container.innerHTML = `
        <div class="card">
          <h3>تعذر قراءة بيانات الفريق #${teamId}: ${escapeHtml(err.message)}</h3>
          <p>إذا كان هذا الفريق معطلاً (Inactive)، يمكن لقائد الفريق أو مدير النظام إعادة تفعيله مباشرة عبر العملية E19.</p>
          <div class="page-header-actions">
            <button type="button" id="emergency-reactivate-team-btn" class="btn btn-primary">إعادة تفعيل الفريق #${teamId} (E19)</button>
            <a href="#/app/teams" class="btn btn-outline">العودة لقائمة الفرق</a>
          </div>
        </div>
      `;
      const reactivateBtn = container.querySelector('#emergency-reactivate-team-btn');
      if (reactivateBtn) {
        reactivateBtn.addEventListener('click', async () => {
          reactivateBtn.disabled = true;
          try {
            await teamsService.update(teamId, { is_active: false }, { is_active: true });
            ui.toast('تمت إعادة تفعيل الفريق بنجاح (E19).', 'success');
            loadWorkspace();
          } catch (reErr) {
            ui.toast(reErr.message || 'تعذر إعادة تفعيل الفريق.', 'error');
            reactivateBtn.disabled = false;
          }
        });
      }
      return;
    }

    const [membersPage, projectsPage] = await Promise.all([
      membersService.list(teamId, { offset: 0, limit: 50 }, scope.signal),
      projectsService.listByTeam(
        teamId,
        { offset: 0, limit: 30, status: projectStatusFilter },
        scope.signal
      ),
    ]);
    if (isStale()) return;

    const state = store.getState();
    const canManage = capabilities.canManageTeam(state, teamId);
    const currentUserId = Number(state.user?.id);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-header-actions" style="margin-bottom:0.4rem;">
            <a href="#/app/teams" class="btn btn-sm btn-outline">→ الفرق</a>
            <span class="badge mono">#${team.id} (${escapeHtml(team.slug)})</span>
            ${ui.renderBooleanBadge(team.is_active)}
          </div>
          <h1>${escapeHtml(team.name)} (P09)</h1>
          <p>${escapeHtml(team.description || 'لا يوجد وصف مسجل.')}</p>
        </div>
        <div class="page-header-actions">
          ${
            canManage
              ? `
                <button type="button" id="team-create-project-btn" class="btn btn-primary">+ مشروع جديد (E25)</button>
                ${
                  team.is_active
                    ? `<button type="button" id="team-deactivate-btn" class="btn btn-danger">تعطيل الفريق (E20)</button>`
                    : `<button type="button" id="team-reactivate-btn" class="btn btn-success">إعادة تفعيل الفريق (E19)</button>`
                }
              `
              : ''
          }
        </div>
      </div>

      <div class="tabs-nav">
        <button type="button" class="tab-btn ${activeTab === 'members' ? 'is-active' : ''}" data-team-tab="members">
          أعضاء الفريق (${membersPage.total}) — E21..E24
        </button>
        <button type="button" class="tab-btn ${activeTab === 'projects' ? 'is-active' : ''}" data-team-tab="projects">
          مشاريع الفريق (${projectsPage.total}) — E25..E26
        </button>
        ${
          canManage
            ? `<button type="button" class="tab-btn ${activeTab === 'settings' ? 'is-active' : ''}" data-team-tab="settings">
                إعدادات الفريق (E19 — UpdateTeamRequest)
              </button>`
            : ''
        }
      </div>

      <!-- TAB 1: Team Members -->
      <div id="team-tab-members" class="${activeTab === 'members' ? '' : 'hidden'}">
        ${
          canManage
            ? `<div class="card" style="margin-bottom:1.25rem;">
                <div class="card-header">
                  <h3>إضافة عضو للفريق (E21 — AddMemberRequest)</h3>
                  <button type="button" id="load-user-directory-picker-btn" class="btn btn-sm btn-outline">جلب دليل مستخدمي المنصة (E15)</button>
                </div>
                <form id="add-team-member-form" class="filter-bar" style="margin-bottom:0;">
                  <div class="form-group" style="min-width:16rem;flex:1;">
                    <label class="form-label" for="add-mem-user-id">معرف المستخدم (user_id) أو اختر من الدليل *</label>
                    <input id="add-mem-user-id" name="user_id" type="number" min="1" class="form-control" required placeholder="أدخل user_id أو اضغط جلب الدليل..." />
                  </div>
                  <div class="form-group" id="directory-select-wrapper" style="min-width:16rem;display:none;">
                    <label class="form-label" for="directory-user-select">اختيار سريع من دليل المنصة (E15)</label>
                    <select id="directory-user-select" class="form-control"></select>
                  </div>
                  <div class="form-group" style="min-width:13rem;">
                    <label class="form-label" for="add-mem-role">الدور داخل الفريق (role) *</label>
                    <select id="add-mem-role" name="role" class="form-control" required>
                      ${renderEnumOptions(TeamRole, 'TeamRole', TeamRole.DEVELOPER)}
                    </select>
                  </div>
                  <button type="submit" class="btn btn-primary">إضافة العضو (E21)</button>
                </form>
              </div>`
            : ''
        }

        <div class="table-scroll-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>معرف العضو</th>
                <th>الاسم واسم المستخدم</th>
                <th>البريد الإلكتروني</th>
                <th>التخصص</th>
                <th>الدور الحالي (role)</th>
                <th>تاريخ الانضمام</th>
                <th>إجراءات (E23 / E24)</th>
              </tr>
            </thead>
            <tbody>
              ${membersPage.items
                .map((m) => {
                  const isSelf = Number(m.member_id) === currentUserId;
                  return `
                    <tr>
                      <td class="mono">#${m.member_id}</td>
                      <td>
                        <strong>${escapeHtml(m.name || '—')}</strong>
                        <div class="field-hint mono">@${escapeHtml(m.username || '')}</div>
                      </td>
                      <td>${escapeHtml(m.email || '—')}</td>
                      <td>${m.job_title ? ui.renderBadge('JobTitle', m.job_title) : '—'}</td>
                      <td>
                        ${
                          canManage
                            ? `<select class="form-control" data-member-role-select="${m.member_id}" style="min-width:11rem;">
                                ${renderEnumOptions(TeamRole, 'TeamRole', m.role)}
                              </select>`
                            : ui.renderBadge('TeamRole', m.role)
                        }
                      </td>
                      <td>${ui.formatDateTime(m.joined_at)}</td>
                      <td>
                        <div class="page-header-actions">
                          ${
                            canManage
                              ? `<button type="button" class="btn btn-sm btn-primary" data-save-member-role="${m.member_id}" data-orig-role="${escapeHtml(m.role)}">حفظ الدور (E23)</button>`
                              : ''
                          }
                          ${
                            canManage || isSelf
                              ? `<button type="button" class="btn btn-sm btn-danger" data-remove-member="${m.member_id}">
                                  ${isSelf && !canManage ? 'مغادرة الفريق (E24)' : 'إزالة (E24)'}
                                </button>`
                              : ''
                          }
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 2: Team Projects (E26 & E25) -->
      <div id="team-tab-projects" class="${activeTab === 'projects' ? '' : 'hidden'}">
        <div class="filter-bar">
          <div class="form-group" style="min-width:14rem;">
            <label class="form-label" for="team-proj-status-filter">تصفية حسب حالة المشروع (E26 status)</label>
            <select id="team-proj-status-filter" class="form-control">
              ${renderEnumOptions(ProjectStatus, 'ProjectStatus', projectStatusFilter, 'كل الحالات')}
            </select>
          </div>
        </div>

        ${
          projectsPage.items.length === 0
            ? ui.renderEmptyState('لا توجد مشاريع في هذا الفريق مطابقة للفلتر')
            : `<div class="responsive-card-grid">
                ${projectsPage.items
                  .map(
                    (proj) => `
                  <article class="card">
                    <div class="card-header">
                      <div>
                        <h3><a href="#/app/projects/${proj.id}">${escapeHtml(proj.title)}</a></h3>
                        <span class="field-hint mono">#${proj.id} — ${escapeHtml(proj.slug)}</span>
                      </div>
                      <div class="page-header-actions">
                        ${ui.renderBadge('ProjectStatus', proj.status)}
                        ${ui.renderBadge('ProjectVisibility', proj.visibility)}
                      </div>
                    </div>
                    <p>${escapeHtml(proj.short_description)}</p>
                    <div class="page-header-actions">
                      <span class="badge">المهام: ${Number(proj.tasks_completed_count || 0)}/${Number(proj.tasks_count || 0)}</span>
                    </div>
                    <div class="card-footer">
                      <a href="#/app/projects/${proj.id}" class="btn btn-sm btn-primary">فتح مساحة المشروع ولوحة كانبان (P11)</a>
                    </div>
                  </article>
                `
                  )
                  .join('')}
              </div>`
        }
      </div>

      <!-- TAB 3: Team Settings (E19: UpdateTeamRequest — 3 fields: name, description, is_active) -->
      ${
        canManage
          ? `<div id="team-tab-settings" class="${activeTab === 'settings' ? '' : 'hidden'}">
              <form id="update-team-settings-form" class="card" style="max-width:42rem;">
                <h3>تحديث إعدادات الفريق (E19 — UpdateTeamRequest)</h3>
                <div class="form-group">
                  <label class="form-label" for="ut-name">اسم الفريق (name) *</label>
                  <input id="ut-name" name="name" type="text" class="form-control" required minlength="2" maxlength="100" value="${escapeHtml(team.name)}" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="ut-desc">وصف الفريق (description — اتركه فارغاً لمسحه إلى null)</label>
                  <textarea id="ut-desc" name="description" rows="3" class="form-control" maxlength="500">${escapeHtml(team.description || '')}</textarea>
                </div>
                <div class="form-group">
                  <label class="checkbox-row">
                    <input type="checkbox" name="is_active" ${team.is_active ? 'checked' : ''} />
                    <span>الفريق نشط (is_active)</span>
                  </label>
                </div>
                <div class="card-footer">
                  <button type="submit" class="btn btn-primary">حفظ التعديلات (E19)</button>
                </div>
              </form>
            </div>`
          : ''
      }
    `;

    // Tab Switching
    container.querySelectorAll('[data-team-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-team-tab');
        loadWorkspace();
      });
    });

    // Project Status Filter (E26)
    const projFilterSelect = container.querySelector('#team-proj-status-filter');
    if (projFilterSelect) {
      projFilterSelect.addEventListener('change', () => {
        projectStatusFilter = projFilterSelect.value;
        activeTab = 'projects';
        loadWorkspace();
      });
    }

    // Create Project Modal Trigger (E25)
    const createProjBtn = container.querySelector('#team-create-project-btn');
    if (createProjBtn) {
      createProjBtn.addEventListener('click', () => {
        openCreateProjectModal({
          teamId,
          onCreated: (created) => router.navigate(`#/app/projects/${created.id}`),
        });
      });
    }

    // Deactivate Team (E20)
    const deactBtn = container.querySelector('#team-deactivate-btn');
    if (deactBtn) {
      deactBtn.addEventListener('click', async () => {
        deactBtn.disabled = true;
        try {
          await teamsService.deactivate(team);
          ui.toast(`تم تعطيل الفريق "${team.name}" وتسجيله في قائمة الاستعادة (E20).`, 'warning');
          router.navigate('#/app/teams');
        } catch (err) {
          ui.toast(err.message || 'تعذر تعطيل الفريق.', 'error');
          deactBtn.disabled = false;
        }
      });
    }

    // Reactivate Team (E19)
    const reactBtn = container.querySelector('#team-reactivate-btn');
    if (reactBtn) {
      reactBtn.addEventListener('click', async () => {
        reactBtn.disabled = true;
        try {
          await teamsService.update(teamId, team, { is_active: true });
          ui.toast('تمت إعادة تفعيل الفريق بنجاح (E19).', 'success');
          loadWorkspace();
        } catch (err) {
          ui.toast(err.message || 'تعذر إعادة التفعيل.', 'error');
          reactBtn.disabled = false;
        }
      });
    }

    // Load User Directory Picker (E15: GET /api/v1/users/)
    const loadDirBtn = container.querySelector('#load-user-directory-picker-btn');
    if (loadDirBtn) {
      loadDirBtn.addEventListener('click', async () => {
        loadDirBtn.disabled = true;
        try {
          const dirPage = await usersService.listDirectory({ skip: 0, limit: 100 });
          const wrapper = container.querySelector('#directory-select-wrapper');
          const selectEl = container.querySelector('#directory-user-select');
          const inputEl = container.querySelector('#add-mem-user-id');
          if (wrapper && selectEl) {
            wrapper.style.display = 'flex';
            selectEl.innerHTML =
              '<option value="">— اختر مستخدماً لتعبئة user_id —</option>' +
              dirPage.items
                .map(
                  (u) =>
                    `<option value="${u.id}">#${u.id} — ${escapeHtml(u.name)} (@${escapeHtml(u.username)})</option>`
                )
                .join('');
            selectEl.addEventListener('change', () => {
              if (selectEl.value) inputEl.value = selectEl.value;
            });
          }
          ui.toast(`تم جلب ${dirPage.items.length} مستخدم من الدليل (E15).`, 'success');
        } catch (err) {
          ui.toast(err.message || 'تعذر جلب دليل المستخدمين.', 'error');
        } finally {
          loadDirBtn.disabled = false;
        }
      });
    }

    // Add Member Submit (E21)
    const addMemForm = container.querySelector('#add-team-member-form');
    if (addMemForm) {
      addMemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(addMemForm);
        try {
          await membersService.add(teamId, {
            user_id: Number(fd.get('user_id')),
            role: String(fd.get('role') || TeamRole.DEVELOPER),
          });
          ui.toast('تمت إضافة العضو للفريق بنجاح (E21).', 'success');
          loadWorkspace();
        } catch (err) {
          ui.toast(err.message || 'تعذر إضافة العضو.', 'error');
        }
      });
    }

    // Update Member Role (E23)
    container.querySelectorAll('[data-save-member-role]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uid = Number(btn.getAttribute('data-save-member-role'));
        const origRole = btn.getAttribute('data-orig-role');
        const selectEl = container.querySelector(`[data-member-role-select="${uid}"]`);
        const nextRole = selectEl ? selectEl.value : origRole;
        btn.disabled = true;
        try {
          await membersService.updateRole(teamId, uid, { role: origRole }, { role: nextRole });
          ui.toast(`تم تحديث دور العضو #${uid} بنجاح (E23).`, 'success');
          loadWorkspace();
        } catch (err) {
          ui.toast(err.message || 'تعذر تحديث دور العضو.', 'error');
          btn.disabled = false;
        }
      });
    });

    // Remove Member (E24)
    container.querySelectorAll('[data-remove-member]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uid = Number(btn.getAttribute('data-remove-member'));
        btn.disabled = true;
        try {
          await membersService.remove(teamId, uid);
          ui.toast(`تمت إزالة العضو #${uid} وإلغاء إسناد مهامه المفتوحة (E24).`, 'success');
          if (uid === currentUserId && !capabilities.isSuperAdmin(state)) {
            router.navigate('#/app/teams');
          } else {
            loadWorkspace();
          }
        } catch (err) {
          ui.toast(err.message || 'تعذر إزالة العضو.', 'error');
          btn.disabled = false;
        }
      });
    });

    // Update Team Settings Form (E19)
    const settingsForm = container.querySelector('#update-team-settings-form');
    if (settingsForm) {
      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(settingsForm);
        try {
          await teamsService.update(teamId, team, {
            name: String(fd.get('name') || '').trim(),
            description: String(fd.get('description') || '').trim() || null,
            is_active: fd.get('is_active') === 'on',
          });
          ui.toast('تم تحديث إعدادات الفريق بنجاح (E19).', 'success');
          loadWorkspace();
        } catch (err) {
          ui.applyFieldErrors(settingsForm, err.fieldErrors);
          ui.toast(err.message || 'تعذر تحديث إعدادات الفريق.', 'error');
        }
      });
    }
  };

  await loadWorkspace();
}

