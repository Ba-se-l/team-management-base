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
import { t, tr } from '../core/i18n.js';
import { renderIcon } from '../components/icon.js';
import { renderAvatar } from '../components/avatar.js';
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
    title: tr('إنشاء مشروع هندسي جديد (E25 — CreateProjectRequest)', 'Create New Engineering Project (E25 — CreateProjectRequest)'),
    bodyHtml: `
      <form id="create-project-modal-form" novalidate>
        ${
          !teamId && teamsList.length > 0
            ? `<div class="form-group" style="margin-block-end:0.85rem;">
                <label class="form-label" for="proj-team-select">${escapeHtml(tr('الفريق المالك للمشروع (team_id) *', 'Owning Team (team_id) *'))}</label>
                <select id="proj-team-select" name="team_id" class="form-control" required>
                  ${teamsList
                    .map(
                      (team) =>
                        `<option value="${team.id}">${escapeHtml(team.name)} (#${team.id})</option>`
                    )
                    .join('')}
                </select>
              </div>`
            : ''
        }

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="cp-title">${escapeHtml(tr('عنوان المشروع (title) *', 'Project Title (title) *'))}</label>
            <input id="cp-title" name="title" type="text" class="form-control" required minlength="2" maxlength="150" placeholder="${escapeHtml(tr('مثال: بوابة الدفع السحابية', 'e.g., Cloud Payment Gateway'))}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="cp-slug">${escapeHtml(tr('المعرف النصي (slug — اختياري)', 'Slug (optional)'))}</label>
            <input id="cp-slug" name="slug" type="text" class="form-control" maxlength="160" placeholder="cloud-payment-gateway" />
          </div>
          <div class="form-group">
            <label class="form-label" for="cp-status">${escapeHtml(tr('حالة المشروع (status) *', 'Project Status (status) *'))}</label>
            <select id="cp-status" name="status" class="form-control" required>
              ${renderEnumOptions(ProjectStatus, 'ProjectStatus', ProjectStatus.PLANNING)}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="cp-visibility">${escapeHtml(tr('مستوى الظهور (visibility) *', 'Visibility (visibility) *'))}</label>
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
            <label class="form-label" for="cp-demo-url">${escapeHtml(tr('رابط المعاينة الحية (demo_url)', 'Live Demo URL (demo_url)'))}</label>
            <input id="cp-demo-url" name="demo_url" type="url" class="form-control" placeholder="https://demo.agency.io" />
          </div>
          <div class="form-group">
            <label class="form-label" for="cp-repo-url">${escapeHtml(tr('رابط المستودع البرمجي (repo_url)', 'Repository URL (repo_url)'))}</label>
            <input id="cp-repo-url" name="repo_url" type="url" class="form-control" placeholder="https://github.com/..." />
          </div>
          <div class="form-group">
            <label class="form-label" for="cp-deadline">${escapeHtml(tr('الموعد النهائي للتسليم (deadline)', 'Delivery Deadline (deadline)'))}</label>
            <input id="cp-deadline" name="deadline" type="datetime-local" class="form-control" />
          </div>
        </div>

        <div class="form-group" style="margin-block-start:0.85rem;">
          <label class="form-label" for="cp-short-desc">${escapeHtml(tr('وصف مختصر للمشروع (short_description) * (5–500 حرف)', 'Short Description (short_description) * (5–500 chars)'))}</label>
          <input id="cp-short-desc" name="short_description" type="text" class="form-control" required minlength="5" maxlength="500" />
        </div>

        <div class="form-group" style="margin-block-start:0.85rem;">
          <label class="form-label" for="cp-desc">${escapeHtml(tr('الوصف المعماري التفصيلي (description)', 'Detailed Architectural Description (description)'))}</label>
          <textarea id="cp-desc" name="description" rows="3" class="form-control" maxlength="5000"></textarea>
        </div>

        <!-- Technology Multi-Select Picker using E43 & E44 -->
        <div class="form-group" style="margin-block-start:0.85rem;">
          <label class="form-label">${escapeHtml(tr('المكدس التقني المرتبط (technology_ids — E43 & E44)', 'Linked Tech Stack (technology_ids — E43 & E44)'))}</label>
          <div class="tech-picker-box">
            <div class="page-header-actions">
              <input id="cp-tech-search-q" type="text" class="form-control" style="max-inline-size:14rem;" placeholder="${escapeHtml(tr('ابحث عن تقنية (E44)...', 'Search technology (E44)...'))}" />
              <select id="cp-tech-search-cat" class="form-control" style="max-inline-size:12rem;">
                ${renderEnumOptions(TechnologyCategory, 'TechnologyCategory', '', tr('كل الفئات', 'All Categories'))}
              </select>
              <button type="button" id="cp-tech-search-btn" class="btn btn-sm btn-outline">${renderIcon('search', { size: 14 })} <span>${escapeHtml(tr('بحث في الكتالوج (E44)', 'Search Catalog (E44)'))}</span></button>
            </div>
            <div id="cp-tech-chips-container" class="tech-chips-list"></div>
          </div>
        </div>

        <div class="modal-footer" style="margin-block-start:1rem;padding:0;border:none;background:transparent;">
          <button type="button" class="btn btn-outline" data-close-modal="true">${escapeHtml(t('common.cancel'))}</button>
          <button type="submit" id="cp-submit-btn" class="btn btn-primary">${renderIcon('plus', { size: 15 })} <span>${escapeHtml(tr('إنشاء المشروع (E25)', 'Create Project (E25)'))}</span></button>
        </div>
      </form>
    `,
    onMount: (dialog) => {
      const chipsContainer = dialog.querySelector('#cp-tech-chips-container');

      const renderTechChips = (techArray) => {
        if (!techArray || techArray.length === 0) {
          chipsContainer.innerHTML = `<span class="field-hint">${escapeHtml(tr('لا توجد تقنيات مطابقة.', 'No matching technologies.'))}</span>`;
          return;
        }
        chipsContainer.innerHTML = techArray
          .map((tech) => {
            const isSel = selectedTechIds.has(Number(tech.id));
            return `
              <button type="button" class="tech-chip-option ${isSel ? 'is-selected' : ''}" data-tech-chip="${tech.id}">
                ${renderIcon(isSel ? 'check' : 'plus', { size: 13 })}
                <span>${escapeHtml(tech.name)}</span>
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
          ui.toast(err.message || tr('تعذر البحث في التقنيات.', 'Failed to search technologies.'), 'error');
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
          ui.toast(
            tr(`تم إنشاء المشروع "${created.title}" بنجاح (E25).`, `Project "${created.title}" created successfully (E25).`),
            'success'
          );
          if (typeof onCreated === 'function') onCreated(created);
        } catch (err) {
          ui.applyFieldErrors(form, err.fieldErrors);
          ui.toast(err.message || tr('تعذر إنشاء المشروع.', 'Failed to create project.'), 'error');
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
    container.innerHTML = ui.renderLoadingSkeleton(
      tr('جاري تحميل قائمة الفرق الهندسية (E17)...', 'Loading engineering teams list (E17)...')
    );
    const pageModel = await teamsService.list({ offset, limit }, scope.signal);
    if (isStale()) return;

    const deactivatedTeams = store.getState().recentlyDeactivated?.teams || [];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${escapeHtml(tr('دليل الفرق الهندسية (P08)', 'Engineering Teams Directory (P08)'))}</h1>
          <p>${escapeHtml(tr('يمكن لأي مطور مصادق إنشاء فريق جديد ليصبح قائداً له تلقائياً (E16).', 'Any authenticated developer can create a new team and automatically become its Team Admin (E16).'))}</p>
        </div>
        <div class="page-header-actions">
          <form id="open-team-by-id-form" class="page-header-actions">
            <input name="team_id" type="number" min="1" class="form-control" style="inline-size:12rem;" placeholder="${escapeHtml(tr('فتح/استرجاع فريق بالمعرف #', 'Open/recover team by ID #'))}" required />
            <button type="submit" class="btn btn-sm btn-outline">${renderIcon('search', { size: 14 })} <span>${escapeHtml(tr('فتح مساحة الفريق (E18)', 'Open Team (E18)'))}</span></button>
          </form>
          <button type="button" id="open-create-team-modal-btn" class="btn btn-primary">${renderIcon('plus', { size: 15 })} <span>${escapeHtml(tr('إنشاء فريق جديد (E16)', 'Create New Team (E16)'))}</span></button>
        </div>
      </div>

      ${
        deactivatedTeams.length > 0
          ? `<div class="alert-banner alert-warning">
              <div>
                <strong>${escapeHtml(tr('فرق تم تعطيلها مؤخراً في هذه الجلسة (قابلة للاستعادة عبر E19):', 'Recently deactivated teams in this session (recoverable via E19):'))}</strong>
                <div class="page-header-actions" style="margin-block-start:0.4rem;">
                  ${deactivatedTeams
                    .map(
                      (dt) => `
                    <span class="badge badge-warning">
                      ${escapeHtml(dt.label)} (#${dt.id})
                      <button type="button" class="btn btn-sm btn-outline" data-restore-team="${dt.id}">${renderIcon('refresh-cw', { size: 13 })} <span>${escapeHtml(tr('إعادة تفعيل (E19)', 'Reactivate (E19)'))}</span></button>
                      <a href="#/app/teams/${dt.id}" class="btn btn-sm btn-outline">${escapeHtml(t('common.open'))}</a>
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
              tr('لا توجد فرق نشطة حالياً', 'No Active Teams Yet'),
              tr('ابدأ بإنشاء فريق هندسي جديد لإدارة المشاريع والمهام.', 'Start by creating a new engineering team to manage projects and tasks.')
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
                  <p>${escapeHtml(team.description || tr('لا يوجد وصف مسجل لهذا الفريق.', 'No description registered for this team.'))}</p>
                  <div class="page-header-actions">
                    <span class="badge">${renderIcon('users', { size: 13 })} ${escapeHtml(tr('الأعضاء:', 'Members:'))} ${Number(team.members_count || 0)}</span>
                    <span class="badge">${renderIcon('folder-kanban', { size: 13 })} ${escapeHtml(tr('المشاريع:', 'Projects:'))} ${Number(team.projects_count || 0)}</span>
                  </div>
                  <div class="card-footer">
                    <span class="field-hint">${escapeHtml(tr('تاريخ الإنشاء:', 'Created:'))} ${ui.formatDateTime(team.created_at)}</span>
                    <a href="#/app/teams/${team.id}" class="btn btn-sm btn-primary"><span>${escapeHtml(tr('إدارة الفريق (P09)', 'Manage Team (P09)'))}</span> ${renderIcon('arrow-right', { size: 14 })}</a>
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
          ui.toast(
            tr(`تمت إعادة تفعيل الفريق #${tid} بنجاح (E19).`, `Team #${tid} reactivated successfully (E19).`),
            'success'
          );
          loadTeams();
        } catch (err) {
          ui.toast(err.message || tr('تعذر إعادة تفعيل الفريق.', 'Failed to reactivate team.'), 'error');
          btn.disabled = false;
        }
      });
    });

    // Create Team Modal (E16: 3 fields in CreateTeamRequest)
    container.querySelector('#open-create-team-modal-btn').addEventListener('click', () => {
      ui.openModal({
        title: tr('إنشاء فريق هندسي جديد (E16 — CreateTeamRequest)', 'Create New Engineering Team (E16 — CreateTeamRequest)'),
        bodyHtml: `
          <form id="create-team-form" novalidate>
            <div class="form-group">
              <label class="form-label" for="ct-name">${escapeHtml(tr('اسم الفريق (name) *', 'Team Name (name) *'))}</label>
              <input id="ct-name" name="name" type="text" class="form-control" required minlength="2" maxlength="100" placeholder="${escapeHtml(tr('مثال: فريق البنية التحتية السحابية', 'e.g., Cloud Infrastructure Team'))}" />
            </div>
            <div class="form-group" style="margin-block-start:0.85rem;">
              <label class="form-label" for="ct-slug">${escapeHtml(tr('المعرف النصي (slug — اختياري)', 'Slug (optional)'))}</label>
              <input id="ct-slug" name="slug" type="text" class="form-control" maxlength="120" placeholder="cloud-infra-team" />
            </div>
            <div class="form-group" style="margin-block-start:0.85rem;">
              <label class="form-label" for="ct-desc">${escapeHtml(tr('وصف الفريق ومهامه (description)', 'Team Description & Mission (description)'))}</label>
              <textarea id="ct-desc" name="description" rows="3" class="form-control" maxlength="500"></textarea>
            </div>
            <div class="modal-footer" style="margin-block-start:1rem;padding:0;border:none;background:transparent;">
              <button type="button" class="btn btn-outline" data-close-modal="true">${escapeHtml(t('common.cancel'))}</button>
              <button type="submit" id="ct-submit-btn" class="btn btn-primary">${renderIcon('plus', { size: 15 })} <span>${escapeHtml(tr('إنشاء الفريق (E16)', 'Create Team (E16)'))}</span></button>
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
              ui.toast(
                tr(
                  `تم إنشاء الفريق "${created.name}" وتحديث صلاحياتك كقائد فريق (E16 + E08).`,
                  `Team "${created.name}" created and your Team Admin permissions refreshed (E16 + E08).`
                ),
                'success'
              );
              router.navigate(`#/app/teams/${created.id}`);
            } catch (err) {
              ui.applyFieldErrors(form, err.fieldErrors);
              ui.toast(err.message || tr('تعذر إنشاء الفريق.', 'Failed to create team.'), 'error');
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
    container.innerHTML = ui.renderLoadingSkeleton(
      tr(`جاري تحميل مساحة عمل الفريق #${teamId} (E18)...`, `Loading team workspace #${teamId} (E18)...`)
    );

    let team = null;
    try {
      team = await teamsService.getById(teamId, scope.signal);
    } catch (err) {
      if (isStale()) return;
      container.innerHTML = `
        <div class="card">
          <h3>${escapeHtml(tr(`تعذر قراءة بيانات الفريق #${teamId}: ${err.message}`, `Unable to read team #${teamId}: ${err.message}`))}</h3>
          <p>${escapeHtml(tr('إذا كان هذا الفريق معطلاً (Inactive)، يمكن لقائد الفريق أو مدير النظام إعادة تفعيله مباشرة عبر العملية E19.', 'If this team is deactivated (Inactive), the Team Admin or Super Admin can reactivate it directly via E19.'))}</p>
          <div class="page-header-actions">
            <button type="button" id="emergency-reactivate-team-btn" class="btn btn-primary">${renderIcon('refresh-cw', { size: 15 })} <span>${escapeHtml(tr(`إعادة تفعيل الفريق #${teamId} (E19)`, `Reactivate Team #${teamId} (E19)`))}</span></button>
            <a href="#/app/teams" class="btn btn-outline">${renderIcon('arrow-left', { size: 15 })} <span>${escapeHtml(tr('العودة لقائمة الفرق', 'Back to Teams'))}</span></a>
          </div>
        </div>
      `;
      const reactivateBtn = container.querySelector('#emergency-reactivate-team-btn');
      if (reactivateBtn) {
        reactivateBtn.addEventListener('click', async () => {
          reactivateBtn.disabled = true;
          try {
            await teamsService.update(teamId, { is_active: false }, { is_active: true });
            ui.toast(tr('تمت إعادة تفعيل الفريق بنجاح (E19).', 'Team reactivated successfully (E19).'), 'success');
            loadWorkspace();
          } catch (reErr) {
            ui.toast(reErr.message || tr('تعذر إعادة تفعيل الفريق.', 'Failed to reactivate team.'), 'error');
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
          <div class="page-header-actions" style="margin-block-end:0.4rem;">
            <a href="#/app/teams" class="btn btn-sm btn-outline">${renderIcon('arrow-left', { size: 14 })} <span>${escapeHtml(tr('الفرق', 'Teams'))}</span></a>
            <span class="badge mono">#${team.id} (${escapeHtml(team.slug)})</span>
            ${ui.renderBooleanBadge(team.is_active)}
          </div>
          <h1>${escapeHtml(team.name)} (P09)</h1>
          <p>${escapeHtml(team.description || tr('لا يوجد وصف مسجل.', 'No description registered.'))}</p>
        </div>
        <div class="page-header-actions">
          ${
            canManage
              ? `
                <button type="button" id="team-create-project-btn" class="btn btn-primary">${renderIcon('plus', { size: 15 })} <span>${escapeHtml(tr('مشروع جديد (E25)', 'New Project (E25)'))}</span></button>
                ${
                  team.is_active
                    ? `<button type="button" id="team-deactivate-btn" class="btn btn-danger">${renderIcon('trash-2', { size: 15 })} <span>${escapeHtml(tr('تعطيل الفريق (E20)', 'Deactivate Team (E20)'))}</span></button>`
                    : `<button type="button" id="team-reactivate-btn" class="btn btn-success">${renderIcon('refresh-cw', { size: 15 })} <span>${escapeHtml(tr('إعادة تفعيل الفريق (E19)', 'Reactivate Team (E19)'))}</span></button>`
                }
              `
              : ''
          }
        </div>
      </div>

      <div class="tabs-nav">
        <button type="button" class="tab-btn ${activeTab === 'members' ? 'is-active' : ''}" data-team-tab="members">
          ${renderIcon('users', { size: 15 })} <span>${escapeHtml(tr(`أعضاء الفريق (${membersPage.total}) — E21..E24`, `Team Members (${membersPage.total}) — E21..E24`))}</span>
        </button>
        <button type="button" class="tab-btn ${activeTab === 'projects' ? 'is-active' : ''}" data-team-tab="projects">
          ${renderIcon('folder-kanban', { size: 15 })} <span>${escapeHtml(tr(`مشاريع الفريق (${projectsPage.total}) — E25..E26`, `Team Projects (${projectsPage.total}) — E25..E26`))}</span>
        </button>
        ${
          canManage
            ? `<button type="button" class="tab-btn ${activeTab === 'settings' ? 'is-active' : ''}" data-team-tab="settings">
                ${renderIcon('settings', { size: 15 })} <span>${escapeHtml(tr('إعدادات الفريق (E19 — UpdateTeamRequest)', 'Team Settings (E19 — UpdateTeamRequest)'))}</span>
              </button>`
            : ''
        }
      </div>

      <!-- TAB 1: Team Members -->
      <div id="team-tab-members" class="${activeTab === 'members' ? '' : 'hidden'}">
        ${
          canManage
            ? `<div class="card" style="margin-block-end:1.25rem;">
                <div class="card-header">
                  <h3>${escapeHtml(tr('إضافة عضو للفريق (E21 — AddMemberRequest)', 'Add Member to Team (E21 — AddMemberRequest)'))}</h3>
                  <button type="button" id="load-user-directory-picker-btn" class="btn btn-sm btn-outline">${renderIcon('users', { size: 14 })} <span>${escapeHtml(tr('جلب دليل مستخدمي المنصة (E15)', 'Load Platform User Directory (E15)'))}</span></button>
                </div>
                <form id="add-team-member-form" class="filter-bar" style="margin-block-end:0;">
                  <div class="form-group">
                    <label class="form-label" for="add-mem-user-id">${escapeHtml(tr('معرف المستخدم (user_id) أو اختر من الدليل *', 'User ID (user_id) or Select from Directory *'))}</label>
                    <input id="add-mem-user-id" name="user_id" type="number" min="1" class="form-control" required placeholder="${escapeHtml(tr('أدخل user_id أو اضغط جلب الدليل...', 'Enter user_id or load directory...'))}" />
                  </div>
                  <div class="form-group" id="directory-select-wrapper" style="display:none;">
                    <label class="form-label" for="directory-user-select">${escapeHtml(tr('اختيار سريع من دليل المنصة (E15)', 'Quick Pick from Platform Directory (E15)'))}</label>
                    <select id="directory-user-select" class="form-control"></select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="add-mem-role">${escapeHtml(tr('الدور داخل الفريق (role) *', 'Team Role (role) *'))}</label>
                    <select id="add-mem-role" name="role" class="form-control" required>
                      ${renderEnumOptions(TeamRole, 'TeamRole', TeamRole.DEVELOPER)}
                    </select>
                  </div>
                  <button type="submit" class="btn btn-primary">${renderIcon('user-plus', { size: 15 })} <span>${escapeHtml(tr('إضافة العضو (E21)', 'Add Member (E21)'))}</span></button>
                </form>
              </div>`
            : ''
        }

        <div class="table-scroll-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>${escapeHtml(tr('معرف العضو', 'Member ID'))}</th>
                <th>${escapeHtml(tr('العضو', 'Member'))}</th>
                <th>${escapeHtml(tr('البريد الإلكتروني', 'Email'))}</th>
                <th>${escapeHtml(tr('التخصص', 'Specialization'))}</th>
                <th>${escapeHtml(tr('الدور الحالي (role)', 'Current Role (role)'))}</th>
                <th>${escapeHtml(tr('تاريخ الانضمام', 'Joined At'))}</th>
                <th>${escapeHtml(tr('إجراءات (E23 / E24)', 'Actions (E23 / E24)'))}</th>
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
                        <div class="avatar-row">
                          ${renderAvatar(m, { size: 'sm' })}
                          <div class="avatar-meta">
                            <strong class="avatar-name">${escapeHtml(m.name || '—')}</strong>
                            <div class="avatar-sub mono">@${escapeHtml(m.username || '')}</div>
                          </div>
                        </div>
                      </td>
                      <td>${escapeHtml(m.email || '—')}</td>
                      <td>${m.job_title ? ui.renderBadge('JobTitle', m.job_title) : '—'}</td>
                      <td>
                        ${
                          canManage
                            ? `<select class="form-control" data-member-role-select="${m.member_id}" style="min-inline-size:10rem;">
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
                              ? `<button type="button" class="btn btn-sm btn-primary" data-save-member-role="${m.member_id}" data-orig-role="${escapeHtml(m.role)}">${renderIcon('check', { size: 13 })} <span>${escapeHtml(tr('حفظ الدور (E23)', 'Save Role (E23)'))}</span></button>`
                              : ''
                          }
                          ${
                            canManage || isSelf
                              ? `<button type="button" class="btn btn-sm btn-danger" data-remove-member="${m.member_id}">
                                  ${renderIcon('trash-2', { size: 13 })}
                                  <span>${escapeHtml(isSelf && !canManage ? tr('مغادرة الفريق (E24)', 'Leave Team (E24)') : tr('إزالة (E24)', 'Remove (E24)'))}</span>
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
          <div class="form-group">
            <label class="form-label" for="team-proj-status-filter">${escapeHtml(tr('تصفية حسب حالة المشروع (E26 status)', 'Filter by Project Status (E26 status)'))}</label>
            <select id="team-proj-status-filter" class="form-control">
              ${renderEnumOptions(ProjectStatus, 'ProjectStatus', projectStatusFilter, tr('كل الحالات', 'All Statuses'))}
            </select>
          </div>
        </div>

        ${
          projectsPage.items.length === 0
            ? ui.renderEmptyState(tr('لا توجد مشاريع في هذا الفريق مطابقة للفلتر', 'No projects in this team match the selected filter'))
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
                      <span class="badge">${renderIcon('check-square', { size: 13 })} ${escapeHtml(tr('المهام:', 'Tasks:'))} ${Number(proj.tasks_completed_count || 0)}/${Number(proj.tasks_count || 0)}</span>
                    </div>
                    <div class="card-footer">
                      <a href="#/app/projects/${proj.id}" class="btn btn-sm btn-primary"><span>${escapeHtml(tr('فتح مساحة المشروع ولوحة كانبان (P11)', 'Open Project & Kanban (P11)'))}</span> ${renderIcon('arrow-right', { size: 14 })}</a>
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
              <form id="update-team-settings-form" class="card" style="max-inline-size:42rem;">
                <h3>${escapeHtml(tr('تحديث إعدادات الفريق (E19 — UpdateTeamRequest)', 'Update Team Settings (E19 — UpdateTeamRequest)'))}</h3>
                <div class="form-group">
                  <label class="form-label" for="ut-name">${escapeHtml(tr('اسم الفريق (name) *', 'Team Name (name) *'))}</label>
                  <input id="ut-name" name="name" type="text" class="form-control" required minlength="2" maxlength="100" value="${escapeHtml(team.name)}" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="ut-desc">${escapeHtml(tr('وصف الفريق (description — اتركه فارغاً لمسحه إلى null)', 'Team Description (description — leave blank to clear to null)'))}</label>
                  <textarea id="ut-desc" name="description" rows="3" class="form-control" maxlength="500">${escapeHtml(team.description || '')}</textarea>
                </div>
                <div class="form-group">
                  <label class="checkbox-row">
                    <input type="checkbox" name="is_active" ${team.is_active ? 'checked' : ''} />
                    <span>${escapeHtml(tr('الفريق نشط (is_active)', 'Team is active (is_active)'))}</span>
                  </label>
                </div>
                <div class="card-footer">
                  <button type="submit" class="btn btn-primary">${renderIcon('check', { size: 15 })} <span>${escapeHtml(tr('حفظ التعديلات (E19)', 'Save Changes (E19)'))}</span></button>
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
          ui.toast(
            tr(
              `تم تعطيل الفريق "${team.name}" وتسجيله في قائمة الاستعادة (E20).`,
              `Team "${team.name}" deactivated and added to recovery list (E20).`
            ),
            'warning'
          );
          router.navigate('#/app/teams');
        } catch (err) {
          ui.toast(err.message || tr('تعذر تعطيل الفريق.', 'Failed to deactivate team.'), 'error');
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
          ui.toast(tr('تمت إعادة تفعيل الفريق بنجاح (E19).', 'Team reactivated successfully (E19).'), 'success');
          loadWorkspace();
        } catch (err) {
          ui.toast(err.message || tr('تعذر إعادة التفعيل.', 'Failed to reactivate.'), 'error');
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
              `<option value="">${escapeHtml(tr('— اختر مستخدماً لتعبئة user_id —', '— Pick user to populate user_id —'))}</option>` +
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
          ui.toast(
            tr(
              `تم جلب ${dirPage.items.length} مستخدم من الدليل (E15).`,
              `Loaded ${dirPage.items.length} users from directory (E15).`
            ),
            'success'
          );
        } catch (err) {
          ui.toast(err.message || tr('تعذر جلب دليل المستخدمين.', 'Failed to load user directory.'), 'error');
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
          ui.toast(tr('تمت إضافة العضو للفريق بنجاح (E21).', 'Member added to team successfully (E21).'), 'success');
          loadWorkspace();
        } catch (err) {
          ui.toast(err.message || tr('تعذر إضافة العضو.', 'Failed to add member.'), 'error');
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
          ui.toast(
            tr(`تم تحديث دور العضو #${uid} بنجاح (E23).`, `Updated role for member #${uid} (E23).`),
            'success'
          );
          loadWorkspace();
        } catch (err) {
          ui.toast(err.message || tr('تعذر تحديث دور العضو.', 'Failed to update member role.'), 'error');
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
          ui.toast(
            tr(
              `تمت إزالة العضو #${uid} وإلغاء إسناد مهامه المفتوحة (E24).`,
              `Removed member #${uid} and unassigned open tasks (E24).`
            ),
            'success'
          );
          if (uid === currentUserId && !capabilities.isSuperAdmin(state)) {
            router.navigate('#/app/teams');
          } else {
            loadWorkspace();
          }
        } catch (err) {
          ui.toast(err.message || tr('تعذر إزالة العضو.', 'Failed to remove member.'), 'error');
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
          ui.toast(tr('تم تحديث إعدادات الفريق بنجاح (E19).', 'Team settings updated successfully (E19).'), 'success');
          loadWorkspace();
        } catch (err) {
          ui.applyFieldErrors(settingsForm, err.fieldErrors);
          ui.toast(err.message || tr('تعذر تحديث إعدادات الفريق.', 'Failed to update team settings.'), 'error');
        }
      });
    }
  };

  await loadWorkspace();
}
