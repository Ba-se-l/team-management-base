// static/js/pages/projects-tasks-pages.js — Screens P10 (Projects Explorer) & P11 (Project Workspace & Kanban)
import {
  ProjectStatus,
  ProjectVisibility,
  TaskStatus,
  TaskPriority,
  TechnologyCategory,
  formatEnumLabel,
} from '../contracts/enums.js';
import {
  normalizeOptionalUrl,
  toDateTimeLocalInputValue,
  toUtcIsoOrNull,
} from '../contracts/serializers.js';
import { store } from '../core/store.js';
import { capabilities } from '../core/capabilities.js';
import { ui, escapeHtml } from '../core/ui.js';
import { teamsService } from '../services/teams.js';
import { membersService } from '../services/members.js';
import { projectsService } from '../services/projects.js';
import { tasksService } from '../services/tasks.js';
import { technologiesService } from '../services/technologies.js';
import { openCreateProjectModal } from './teams-pages.js';
import { openTaskDetailDrawer } from './workspace-home-pages.js';

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
// P10: Unified Projects Explorer (#/app/projects) — E27, E26, E17, E25, E28, E29
// ============================================================================
export async function mountProjectsExplorerPage({ container, scope, router, isStale }) {
  const filters = {
    teamId: '',
    status: '',
    visibility: '',
    offset: 0,
    limit: 20,
  };

  let teamsList = [];
  try {
    const teamsPage = await teamsService.list({ offset: 0, limit: 100 }, scope.signal);
    teamsList = teamsPage.items;
  } catch {
    teamsList = [];
  }
  if (isStale()) return;

  const loadExplorer = async () => {
    container.innerHTML = ui.renderLoadingSkeleton('جاري تحميل مستكشف المشاريع الهندسية...');

    const pageModel = filters.teamId
      ? await projectsService.listByTeam(
          Number(filters.teamId),
          {
            offset: filters.offset,
            limit: filters.limit,
            status: filters.status,
          },
          scope.signal
        )
      : await projectsService.listAll(
          {
            offset: filters.offset,
            limit: filters.limit,
            status: filters.status,
            visibility: filters.visibility,
          },
          scope.signal
        );

    if (isStale()) return;

    const deactivatedProjects = store.getState().recentlyDeactivated?.projects || [];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>مستكشف المشاريع الهندسية الموحد (P10)</h1>
          <p>استعراض كافة المشاريع المتاحة لك (E27) أو تصفية مشاريع فريق محدد (E26).</p>
        </div>
        <div class="page-header-actions">
          <form id="open-project-by-id-form" class="page-header-actions">
            <input name="project_id" type="number" min="1" class="form-control" style="width:12rem;" placeholder="فتح/استرجاع مشروع بالمعرف #" required />
            <button type="submit" class="btn btn-sm btn-outline">فتح المشروع (E28)</button>
          </form>
          ${
            teamsList.length > 0
              ? `<button type="button" id="explorer-create-project-btn" class="btn btn-primary">+ إنشاء مشروع جديد (E25)</button>`
              : ''
          }
        </div>
      </div>

      ${
        deactivatedProjects.length > 0
          ? `<div class="alert-banner alert-warning">
              <div>
                <strong>مشاريع تم تعطيلها مؤخراً في هذه الجلسة (قابلة للاستعادة عبر E29):</strong>
                <div class="page-header-actions" style="margin-top:0.4rem;">
                  ${deactivatedProjects
                    .map(
                      (dp) => `
                    <span class="badge badge-warning">
                      ${escapeHtml(dp.label)} (#${dp.id})
                      <button type="button" class="btn btn-sm btn-outline" data-restore-project="${dp.id}">إعادة تفعيل (E29)</button>
                      <a href="#/app/projects/${dp.id}" class="btn btn-sm btn-outline">فتح</a>
                    </span>
                  `
                    )
                    .join('')}
                </div>
              </div>
            </div>`
          : ''
      }

      <form id="projects-explorer-filter-form" class="filter-bar">
        <div class="form-group" style="min-width:14rem;">
          <label class="form-label" for="exp-team-filter">نطاق الفريق (E27 الكل / E26 فريق محدد)</label>
          <select id="exp-team-filter" name="team_id" class="form-control">
            <option value="">كل الفرق المتاحة (E27)</option>
            ${teamsList
              .map(
                (t) =>
                  `<option value="${t.id}" ${
                    String(filters.teamId) === String(t.id) ? 'selected' : ''
                  }>${escapeHtml(t.name)} (#${t.id})</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="form-group" style="min-width:13rem;">
          <label class="form-label" for="exp-status-filter">الحالة (status)</label>
          <select id="exp-status-filter" name="status" class="form-control">
            ${renderEnumSelect(ProjectStatus, 'ProjectStatus', filters.status, 'كل الحالات')}
          </select>
        </div>

        <div class="form-group" style="min-width:13rem;">
          <label class="form-label" for="exp-vis-filter">مستوى الظهور (visibility — E27)</label>
          <select id="exp-vis-filter" name="visibility" class="form-control" ${
            filters.teamId ? 'disabled' : ''
          }>
            ${renderEnumSelect(
              ProjectVisibility,
              'ProjectVisibility',
              filters.visibility,
              'كل مستويات الظهور'
            )}
          </select>
        </div>

        <div class="page-header-actions">
          <button type="submit" class="btn btn-primary">تطبيق التصفية</button>
          <button type="button" id="exp-reset-btn" class="btn btn-outline">إعادة ضبط</button>
        </div>
      </form>

      ${
        pageModel.items.length === 0
          ? ui.renderEmptyState('لا توجد مشاريع مطابقة لمعايير البحث الحالية')
          : `<div class="responsive-card-grid">
              ${pageModel.items
                .map(
                  (proj) => `
                <article class="card">
                  <div class="card-header">
                    <div>
                      <h3><a href="#/app/projects/${proj.id}">${escapeHtml(proj.title)}</a></h3>
                      <span class="field-hint mono">#${proj.id} | فريق #${proj.team_id} | ${escapeHtml(proj.slug)}</span>
                    </div>
                    <div class="page-header-actions">
                      ${ui.renderBadge('ProjectStatus', proj.status)}
                      ${ui.renderBadge('ProjectVisibility', proj.visibility)}
                    </div>
                  </div>
                  <p>${escapeHtml(proj.short_description)}</p>
                  <div class="page-header-actions">
                    <span class="badge">المهام المنجزة: ${Number(proj.tasks_completed_count || 0)}/${Number(proj.tasks_count || 0)}</span>
                    ${(proj.technologies || [])
                      .map((t) => `<span class="badge badge-brand">${escapeHtml(t.name)}</span>`)
                      .join('')}
                  </div>
                  <div class="card-footer">
                    <a href="#/app/teams/${proj.team_id}" class="btn btn-sm btn-outline">الفريق #${proj.team_id}</a>
                    <a href="#/app/projects/${proj.id}" class="btn btn-sm btn-primary">فتح مساحة المشروع وكانبان (P11)</a>
                  </div>
                </article>
              `
                )
                .join('')}
            </div>
            ${ui.renderPaginationBar(pageModel, 'projects-explorer')}`
      }
    `;

    // Open by ID
    const openByIdForm = container.querySelector('#open-project-by-id-form');
    openByIdForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pid = Number(new FormData(openByIdForm).get('project_id'));
      if (pid > 0) router.navigate(`#/app/projects/${pid}`);
    });

    // Restore Deactivated Project (E29)
    container.querySelectorAll('[data-restore-project]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pid = Number(btn.getAttribute('data-restore-project'));
        btn.disabled = true;
        try {
          await projectsService.update(pid, { is_active: false }, { is_active: true });
          ui.toast(`تمت إعادة تفعيل المشروع #${pid} بنجاح (E29).`, 'success');
          loadExplorer();
        } catch (err) {
          ui.toast(err.message || 'تعذر إعادة تفعيل المشروع.', 'error');
          btn.disabled = false;
        }
      });
    });

    // Create Project Modal (E25)
    const createBtn = container.querySelector('#explorer-create-project-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        openCreateProjectModal({
          teamId: filters.teamId ? Number(filters.teamId) : null,
          teamsList,
          onCreated: (created) => router.navigate(`#/app/projects/${created.id}`),
        });
      });
    }

    // Filter Submit
    const filterForm = container.querySelector('#projects-explorer-filter-form');
    filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(filterForm);
      filters.teamId = String(fd.get('team_id') || '');
      filters.status = String(fd.get('status') || '');
      filters.visibility = String(fd.get('visibility') || '');
      filters.offset = 0;
      loadExplorer();
    });

    container.querySelector('#exp-reset-btn').addEventListener('click', () => {
      filters.teamId = '';
      filters.status = '';
      filters.visibility = '';
      filters.offset = 0;
      loadExplorer();
    });

    ui.bindPaginationBar(
      container,
      pageModel,
      (nextOffset) => {
        filters.offset = nextOffset;
        loadExplorer();
      },
      'projects-explorer'
    );
  };

  await loadExplorer();
}

// ============================================================================
// P11: Project Workspace, Kanban Board, Tasks Table & Settings (#/app/projects/:projectId)
// Operations: E28, E29, E30, E31, E32, E33, E35, E36, E37, E38, E39, E40, E41, E22, E43, E44
// ============================================================================
export async function mountProjectWorkspacePage({ container, params, scope, router, isStale }) {
  const projectId = Number(params.projectId);
  let activeTab = 'kanban';
  let showArchivedColumn = false;
  let tableStatusFilter = '';
  let tableOffset = 0;

  const loadWorkspace = async () => {
    container.innerHTML = ui.renderLoadingSkeleton(`جاري تحميل مساحة عمل المشروع #${projectId} (E28)...`);

    let project = null;
    try {
      project = await projectsService.getById(projectId, scope.signal);
    } catch (err) {
      if (isStale()) return;
      container.innerHTML = `
        <div class="card">
          <h3>تعذر قراءة المشروع #${projectId}: ${escapeHtml(err.message)}</h3>
          <p>إذا كان هذا المشروع معطلاً (Inactive)، يمكن لقائد الفريق أو مدير النظام استعادته عبر العملية E29.</p>
          <div class="page-header-actions">
            <button type="button" id="emergency-reactivate-project-btn" class="btn btn-primary">إعادة تفعيل المشروع #${projectId} (E29)</button>
            <a href="#/app/projects" class="btn btn-outline">العودة لمستكشف المشاريع</a>
          </div>
        </div>
      `;
      const reactBtn = container.querySelector('#emergency-reactivate-project-btn');
      if (reactBtn) {
        reactBtn.addEventListener('click', async () => {
          reactBtn.disabled = true;
          try {
            await projectsService.update(projectId, { is_active: false }, { is_active: true });
            ui.toast('تمت إعادة تفعيل المشروع بنجاح (E29).', 'success');
            loadWorkspace();
          } catch (reErr) {
            ui.toast(reErr.message || 'تعذر إعادة التفعيل.', 'error');
            reactBtn.disabled = false;
          }
        });
      }
      return;
    }

    const [kanbanData, tasksTablePage, membersPage, techCatalogPage] = await Promise.all([
      tasksService.getKanban(projectId, scope.signal),
      tasksService.listByProject(
        projectId,
        { offset: tableOffset, limit: 25, status: tableStatusFilter },
        scope.signal
      ),
      membersService.list(project.team_id, { offset: 0, limit: 100 }, scope.signal).catch(() => ({
        items: [],
      })),
      technologiesService.list({ skip: 0, limit: 80 }, scope.signal).catch(() => ({ items: [] })),
    ]);

    if (isStale()) return;

    const state = store.getState();
    const teamId = project.team_id;
    const canManageProject = capabilities.canManageProject(state, teamId);
    const canCreateTask = capabilities.canCreateTask(state, teamId);
    const canDeleteTask = capabilities.canDeleteTask(state, teamId);
    const canComment = capabilities.canCommentOnTask(state, teamId);
    const allowedVisibilities = capabilities.getAllowedProjectVisibilities(state, teamId);

    const visibleKanbanStatuses = [
      TaskStatus.TODO,
      TaskStatus.IN_PROGRESS,
      TaskStatus.IN_REVIEW,
      TaskStatus.DONE,
      ...(showArchivedColumn ? [TaskStatus.ARCHIVED] : []),
    ];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-header-actions" style="margin-bottom:0.4rem;">
            <a href="#/app/teams/${teamId}" class="btn btn-sm btn-outline">→ الفريق #${teamId}</a>
            <span class="badge mono">#${project.id} (${escapeHtml(project.slug)})</span>
            ${ui.renderBadge('ProjectStatus', project.status)}
            ${ui.renderBadge('ProjectVisibility', project.visibility)}
            ${ui.renderBooleanBadge(project.is_active)}
          </div>
          <h1>${escapeHtml(project.title)} (P11)</h1>
          <p>${escapeHtml(project.short_description)}</p>
        </div>

        <div class="page-header-actions">
          ${
            canCreateTask
              ? `<button type="button" id="proj-create-task-btn" class="btn btn-primary">+ مهمة جديدة (E31)</button>`
              : ''
          }
          ${
            canManageProject
              ? project.is_active
                ? `<button type="button" id="proj-deactivate-btn" class="btn btn-danger">تعطيل المشروع (E30)</button>`
                : `<button type="button" id="proj-reactivate-btn" class="btn btn-success">إعادة تفعيل المشروع (E29)</button>`
              : ''
          }
        </div>
      </div>

      <div class="tabs-nav">
        <button type="button" class="tab-btn ${activeTab === 'kanban' ? 'is-active' : ''}" data-proj-tab="kanban">
          لوحة كانبان التفاعلية (E33 & E38)
        </button>
        <button type="button" class="tab-btn ${activeTab === 'table' ? 'is-active' : ''}" data-proj-tab="table">
          جدول المهام المرقّم (${tasksTablePage.total}) — E32
        </button>
        ${
          canManageProject
            ? `<button type="button" class="tab-btn ${activeTab === 'settings' ? 'is-active' : ''}" data-proj-tab="settings">
                إعدادات المشروع وحوكمة المعرض (E29)
              </button>`
            : ''
        }
      </div>

      <!-- TAB 1: Kanban Board (E33 & E38) -->
      <div id="proj-tab-kanban" class="${activeTab === 'kanban' ? '' : 'hidden'}">
        <div class="filter-bar">
          <div class="page-header-actions" style="width:100%;justify-content:space-between;">
            <span>اسحب البطاقات بين الأعمدة أو استخدم قائمة <strong>النقل السريع (E38)</strong> الوصولية لكل بطاقة.</span>
            <label class="checkbox-row">
              <input type="checkbox" id="toggle-archived-col" ${showArchivedColumn ? 'checked' : ''} />
              <span>إظهار عمود المهام المؤرشفة (archived)</span>
            </label>
          </div>
        </div>

        <div class="kanban-board-grid">
          ${visibleKanbanStatuses
            .map((colStatus) => {
              const colTasks = kanbanData?.columns?.[colStatus] || [];
              return `
                <section class="kanban-column" data-kanban-col="${colStatus}">
                  <div class="kanban-column-header">
                    <strong>${escapeHtml(formatEnumLabel('TaskStatus', colStatus))}</strong>
                    <span class="badge">${colTasks.length}</span>
                  </div>
                  <div class="kanban-task-list" data-kanban-dropzone="${colStatus}">
                    ${
                      colTasks.length === 0
                        ? `<div class="field-hint" style="text-align:center;padding:1.5rem 0;">لا توجد مهام في هذا العمود</div>`
                        : colTasks
                            .map((task) => {
                              const canMoveThis = capabilities.canModifyOrMoveTask(
                                state,
                                teamId,
                                task
                              );
                              return `
                                <article class="kanban-card" draggable="${canMoveThis ? 'true' : 'false'}" data-task-card="${task.id}" data-task-status="${task.status}">
                                  <div class="card-header">
                                    <span class="kanban-card-title">${escapeHtml(task.title)}</span>
                                    ${ui.renderBadge('TaskPriority', task.priority)}
                                  </div>
                                  <div class="page-header-actions">
                                    <span class="field-hint mono">#${task.id} | Pos: ${Number(task.position || 0)}</span>
                                    <span class="badge">${escapeHtml(task.assignee_name || task.assignee_username || 'غير مسندة')}</span>
                                    <span class="badge">💬 ${Number(task.comments_count || 0)}</span>
                                  </div>
                                  <div class="card-footer" style="padding-top:0.5rem;">
                                    <button type="button" class="btn btn-sm btn-primary" data-open-task-drawer="${task.id}">التفاصيل (E35)</button>
                                    ${
                                      canMoveThis
                                        ? `<select class="form-control" style="width:auto;padding:0.2rem 0.4rem;font-size:var(--text-xs);" data-quick-move-task="${task.id}" aria-label="نقل سريع للمهمة">
                                            <option value="">نقل سريع (E38)...</option>
                                            ${Object.values(TaskStatus)
                                              .filter((st) => st !== task.status)
                                              .map(
                                                (st) =>
                                                  `<option value="${st}">→ ${escapeHtml(
                                                    formatEnumLabel('TaskStatus', st)
                                                  )}</option>`
                                              )
                                              .join('')}
                                          </select>`
                                        : ''
                                    }
                                  </div>
                                </article>
                              `;
                            })
                            .join('')
                    }
                  </div>
                </section>
              `;
            })
            .join('')}
        </div>
      </div>

      <!-- TAB 2: Tasks Table View (E32) -->
      <div id="proj-tab-table" class="${activeTab === 'table' ? '' : 'hidden'}">
        <div class="filter-bar">
          <div class="form-group" style="min-width:14rem;">
            <label class="form-label" for="table-task-status-filter">تصفية جدول المهام حسب الحالة (E32 status)</label>
            <select id="table-task-status-filter" class="form-control">
              ${renderEnumSelect(TaskStatus, 'TaskStatus', tableStatusFilter, 'كل الحالات')}
            </select>
          </div>
        </div>

        <div class="table-scroll-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>العنوان</th>
                <th>الحالة</th>
                <th>الأولوية</th>
                <th>المسند إليه</th>
                <th>الموعد النهائي</th>
                <th>الترتيب</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${tasksTablePage.items
                .map(
                  (t) => `
                <tr>
                  <td class="mono">#${t.id}</td>
                  <td><strong>${escapeHtml(t.title)}</strong></td>
                  <td>${ui.renderBadge('TaskStatus', t.status)}</td>
                  <td>${ui.renderBadge('TaskPriority', t.priority)}</td>
                  <td>${escapeHtml(t.assignee_name || t.assignee_username || 'غير مسندة')}</td>
                  <td>${ui.formatDateTime(t.deadline)}</td>
                  <td class="mono">${Number(t.position || 0)}</td>
                  <td>
                    <button type="button" class="btn btn-sm btn-primary" data-open-task-drawer="${t.id}">فتح الدرج (E35)</button>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
        ${ui.renderPaginationBar(tasksTablePage, 'proj-tasks-table')}
      </div>

      <!-- TAB 3: Project Settings & Showcase Nomination (E29: 10 Fields in UpdateProjectRequest) -->
      ${
        canManageProject
          ? `<div id="proj-tab-settings" class="${activeTab === 'settings' ? '' : 'hidden'}">
              <form id="update-project-settings-form" class="card">
                <div class="card-header">
                  <div>
                    <h3>تعديل إعدادات المشروع وترشيح المعرض (E29 — UpdateProjectRequest)</h3>
                    <p class="field-hint">ملاحظة حوكمة RBAC-01: يمكن لقائد الفريق ترشيح المشروع إلى <code>pending_review</code>، بينما يعتمد مدير النظام الأعلى النشر إلى <code>public</code>.</p>
                  </div>
                </div>

                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label" for="up-title">عنوان المشروع (title) *</label>
                    <input id="up-title" name="title" type="text" class="form-control" required minlength="2" maxlength="150" value="${escapeHtml(project.title)}" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="up-status">حالة المشروع (status) *</label>
                    <select id="up-status" name="status" class="form-control" required>
                      ${renderEnumSelect(ProjectStatus, 'ProjectStatus', project.status)}
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="up-visibility">مستوى الظهور (visibility) *</label>
                    <select id="up-visibility" name="visibility" class="form-control" required>
                      ${Array.from(new Set([...allowedVisibilities, project.visibility]))
                        .map(
                          (v) =>
                            `<option value="${escapeHtml(v)}" ${
                              v === project.visibility ? 'selected' : ''
                            }>${escapeHtml(formatEnumLabel('ProjectVisibility', v))}</option>`
                        )
                        .join('')}
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="up-demo-url">رابط المعاينة (demo_url)</label>
                    <input id="up-demo-url" name="demo_url" type="url" class="form-control" value="${escapeHtml(project.demo_url || '')}" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="up-repo-url">رابط المستودع (repo_url)</label>
                    <input id="up-repo-url" name="repo_url" type="url" class="form-control" value="${escapeHtml(project.repo_url || '')}" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="up-deadline">الموعد النهائي (deadline)</label>
                    <input id="up-deadline" name="deadline" type="datetime-local" class="form-control" value="${escapeHtml(toDateTimeLocalInputValue(project.deadline))}" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="up-short-desc">الوصف المختصر (short_description) *</label>
                  <input id="up-short-desc" name="short_description" type="text" class="form-control" required minlength="5" maxlength="500" value="${escapeHtml(project.short_description)}" />
                </div>

                <div class="form-group">
                  <label class="form-label" for="up-desc">الوصف التفصيلي الكامل (description)</label>
                  <textarea id="up-desc" name="description" rows="3" class="form-control" maxlength="5000">${escapeHtml(project.description || '')}</textarea>
                </div>

                <div class="form-group">
                  <div class="card-header">
                    <label class="form-label">التقنيات المرتبطة بالمشروع (technology_ids — يدعم المسح [] والبحث E44)</label>
                    <button type="button" id="up-clear-techs-btn" class="btn btn-sm btn-outline">مسح كافة التقنيات ([])</button>
                  </div>
                  <div id="up-tech-chips-box" class="tech-chips-list"></div>
                </div>

                <div class="form-group">
                  <label class="checkbox-row">
                    <input type="checkbox" name="is_active" ${project.is_active ? 'checked' : ''} />
                    <span>المشروع نشط (is_active)</span>
                  </label>
                </div>

                <div class="card-footer">
                  <button type="submit" class="btn btn-primary">حفظ إعدادات المشروع (E29)</button>
                </div>
              </form>
            </div>`
          : ''
      }
    `;

    // Tab Switching
    container.querySelectorAll('[data-proj-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-proj-tab');
        loadWorkspace();
      });
    });

    // Toggle Archived Column in Kanban
    const toggleArchived = container.querySelector('#toggle-archived-col');
    if (toggleArchived) {
      toggleArchived.addEventListener('change', () => {
        showArchivedColumn = toggleArchived.checked;
        loadWorkspace();
      });
    }

    // Table Status Filter (E32)
    const tableFilter = container.querySelector('#table-task-status-filter');
    if (tableFilter) {
      tableFilter.addEventListener('change', () => {
        tableStatusFilter = tableFilter.value;
        tableOffset = 0;
        activeTab = 'table';
        loadWorkspace();
      });
    }

    ui.bindPaginationBar(
      container,
      tasksTablePage,
      (nextOffset) => {
        tableOffset = nextOffset;
        activeTab = 'table';
        loadWorkspace();
      },
      'proj-tasks-table'
    );

    // Open Task Drawer (E35)
    container.querySelectorAll('[data-open-task-drawer]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tid = Number(btn.getAttribute('data-open-task-drawer'));
        const allTasks = [
          ...tasksTablePage.items,
          ...Object.values(kanbanData?.columns || {}).flat(),
        ];
        const foundTask = allTasks.find((t) => Number(t.id) === tid) || { id: tid };
        openTaskDetailDrawer({
          taskId: tid,
          teamMembers: membersPage.items || [],
          canModify: capabilities.canModifyOrMoveTask(state, teamId, foundTask),
          canDelete: canDeleteTask,
          canComment,
          onUpdated: () => loadWorkspace(),
        });
      });
    });

    // Accessible Quick Move Select on Kanban Cards (E38)
    container.querySelectorAll('[data-quick-move-task]').forEach((selectEl) => {
      selectEl.addEventListener('change', async () => {
        const tid = Number(selectEl.getAttribute('data-quick-move-task'));
        const targetStatus = selectEl.value;
        if (!targetStatus) return;
        const targetColTasks = kanbanData?.columns?.[targetStatus] || [];
        const nextPosition = (targetColTasks.length + 1) * 1000.0;
        selectEl.disabled = true;
        try {
          await tasksService.move(tid, { status: targetStatus, position: nextPosition });
          ui.toast(`تم نقل المهمة #${tid} إلى ${formatEnumLabel('TaskStatus', targetStatus)} (E38).`, 'success');
          loadWorkspace();
        } catch (err) {
          ui.toast(err.message || 'تعذر نقل المهمة.', 'error');
          selectEl.disabled = false;
        }
      });
    });

    // HTML5 Drag & Drop on Kanban Columns (E38)
    let draggedTaskId = null;
    container.querySelectorAll('[data-task-card]').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        draggedTaskId = Number(card.getAttribute('data-task-card'));
        e.dataTransfer.effectAllowed = 'move';
      });
    });

    container.querySelectorAll('[data-kanban-col]').forEach((colEl) => {
      const targetStatus = colEl.getAttribute('data-kanban-col');
      colEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        colEl.classList.add('is-drag-over');
      });
      colEl.addEventListener('dragleave', () => {
        colEl.classList.remove('is-drag-over');
      });
      colEl.addEventListener('drop', async (e) => {
        e.preventDefault();
        colEl.classList.remove('is-drag-over');
        if (!draggedTaskId || !targetStatus) return;
        const targetColTasks = kanbanData?.columns?.[targetStatus] || [];
        const nextPosition = (targetColTasks.length + 1) * 1000.0;
        try {
          await tasksService.move(draggedTaskId, {
            status: targetStatus,
            position: nextPosition,
          });
          ui.toast(`تم إفلات المهمة #${draggedTaskId} وتحديث موضعها (E38).`, 'success');
          loadWorkspace();
        } catch (err) {
          ui.toast(err.message || 'تعذر نقل المهمة.', 'error');
        } finally {
          draggedTaskId = null;
        }
      });
    });

    // Create Task Modal (E31: 7 fields in CreateTaskRequest)
    const createTaskBtn = container.querySelector('#proj-create-task-btn');
    if (createTaskBtn) {
      createTaskBtn.addEventListener('click', () => {
        ui.openModal({
          title: 'إضافة مهمة هندسية جديدة (E31 — CreateTaskRequest)',
          bodyHtml: `
            <form id="create-task-modal-form" novalidate>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label" for="nt-title">عنوان المهمة (title) *</label>
                  <input id="nt-title" name="title" type="text" class="form-control" required minlength="2" maxlength="200" placeholder="مثال: بناء نقطة نهاية التصدير" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="nt-status">العمود الأولي (status)</label>
                  <select id="nt-status" name="status" class="form-control">
                    ${renderEnumSelect(TaskStatus, 'TaskStatus', TaskStatus.TODO)}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="nt-priority">الأولوية (priority)</label>
                  <select id="nt-priority" name="priority" class="form-control">
                    ${renderEnumSelect(TaskPriority, 'TaskPriority', TaskPriority.MEDIUM)}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="nt-position">الموضع الرقمي الاختياري (position >= 0)</label>
                  <input id="nt-position" name="position" type="number" min="0" step="100" class="form-control" placeholder="تلقائي (1000.0 increments)" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="nt-assignee">إسناد إلى عضو الفريق (assignee_to_id)</label>
                  <select id="nt-assignee" name="assignee_to_id" class="form-control">
                    <option value="">— غير مسندة حالياً —</option>
                    ${(membersPage.items || [])
                      .map(
                        (m) =>
                          `<option value="${m.member_id}">${escapeHtml(
                            m.name || m.username || `#${m.member_id}`
                          )} (${escapeHtml(m.role)})</option>`
                      )
                      .join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="nt-deadline">الموعد النهائي (deadline)</label>
                  <input id="nt-deadline" name="deadline" type="datetime-local" class="form-control" />
                </div>
              </div>
              <div class="form-group" style="margin-top:0.85rem;">
                <label class="form-label" for="nt-desc">الوصف الفني للمهمة (description)</label>
                <textarea id="nt-desc" name="description" rows="3" class="form-control" maxlength="5000"></textarea>
              </div>
              <div class="modal-footer" style="margin-top:1rem;padding:0;border:none;background:transparent;">
                <button type="button" class="btn btn-outline" data-close-modal="true">إلغاء</button>
                <button type="submit" id="nt-submit-btn" class="btn btn-primary">إنشاء المهمة (E31)</button>
              </div>
            </form>
          `,
          onMount: (dialog) => {
            const form = dialog.querySelector('#create-task-modal-form');
            form.addEventListener('submit', async (e) => {
              e.preventDefault();
              const btn = dialog.querySelector('#nt-submit-btn');
              btn.disabled = true;
              const fd = new FormData(form);
              const rawPos = String(fd.get('position') || '').trim();
              const rawAssignee = String(fd.get('assignee_to_id') || '').trim();
              try {
                const payload = {
                  title: String(fd.get('title') || '').trim(),
                  description: String(fd.get('description') || ''),
                  status: String(fd.get('status') || TaskStatus.TODO),
                  priority: String(fd.get('priority') || TaskPriority.MEDIUM),
                  position: rawPos !== '' ? Number(rawPos) : null,
                  deadline: toUtcIsoOrNull(fd.get('deadline')),
                  assignee_to_id: rawAssignee ? Number(rawAssignee) : null,
                };
                await tasksService.create(projectId, payload);
                ui.closeModal();
                ui.toast('تم إنشاء المهمة بنجاح (E31).', 'success');
                loadWorkspace();
              } catch (err) {
                ui.applyFieldErrors(form, err.fieldErrors);
                ui.toast(err.message || 'تعذر إنشاء المهمة.', 'error');
                btn.disabled = false;
              }
            });
          },
        });
      });
    }

    // Deactivate Project (E30)
    const deactProjBtn = container.querySelector('#proj-deactivate-btn');
    if (deactProjBtn) {
      deactProjBtn.addEventListener('click', async () => {
        deactProjBtn.disabled = true;
        try {
          await projectsService.deactivate(project);
          ui.toast(`تم تعطيل المشروع "${project.title}" وتسجيله للاستعادة (E30).`, 'warning');
          router.navigate('#/app/projects');
        } catch (err) {
          ui.toast(err.message || 'تعذر تعطيل المشروع.', 'error');
          deactProjBtn.disabled = false;
        }
      });
    }

    // Reactivate Project (E29)
    const reactProjBtn = container.querySelector('#proj-reactivate-btn');
    if (reactProjBtn) {
      reactProjBtn.addEventListener('click', async () => {
        reactProjBtn.disabled = true;
        try {
          await projectsService.update(projectId, project, { is_active: true });
          ui.toast('تمت إعادة تفعيل المشروع بنجاح (E29).', 'success');
          loadWorkspace();
        } catch (err) {
          ui.toast(err.message || 'تعذر إعادة التفعيل.', 'error');
          reactProjBtn.disabled = false;
        }
      });
    }

    // Project Settings & Technology Picker (E29)
    const settingsForm = container.querySelector('#update-project-settings-form');
    if (settingsForm) {
      const selectedTechs = new Set((project.technologies || []).map((t) => Number(t.id)));
      const chipsBox = settingsForm.querySelector('#up-tech-chips-box');
      const allTechs = techCatalogPage.items || [];

      const renderSettingsTechChips = () => {
        chipsBox.innerHTML = allTechs
          .map((t) => {
            const isSel = selectedTechs.has(Number(t.id));
            return `
              <button type="button" class="tech-chip-option ${isSel ? 'is-selected' : ''}" data-up-tech="${t.id}">
                <span>${isSel ? '✓' : '+'}</span>
                <span>${escapeHtml(t.name)}</span>
              </button>
            `;
          })
          .join('');
        chipsBox.querySelectorAll('[data-up-tech]').forEach((chip) => {
          chip.addEventListener('click', () => {
            const id = Number(chip.getAttribute('data-up-tech'));
            if (selectedTechs.has(id)) selectedTechs.delete(id);
            else selectedTechs.add(id);
            renderSettingsTechChips();
          });
        });
      };
      renderSettingsTechChips();

      settingsForm.querySelector('#up-clear-techs-btn').addEventListener('click', () => {
        selectedTechs.clear();
        renderSettingsTechChips();
      });

      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(settingsForm);
        try {
          const formValues = {
            title: String(fd.get('title') || '').trim(),
            short_description: String(fd.get('short_description') || '').trim(),
            description: String(fd.get('description') || '').trim() || null,
            status: String(fd.get('status') || project.status),
            visibility: String(fd.get('visibility') || project.visibility),
            demo_url: normalizeOptionalUrl(fd.get('demo_url')),
            repo_url: normalizeOptionalUrl(fd.get('repo_url')),
            deadline: toUtcIsoOrNull(fd.get('deadline')),
            is_active: fd.get('is_active') === 'on',
            technology_ids: Array.from(selectedTechs),
          };
          await projectsService.update(projectId, project, formValues);
          ui.toast('تم حفظ إعدادات المشروع بنجاح (E29).', 'success');
          loadWorkspace();
        } catch (err) {
          ui.applyFieldErrors(settingsForm, err.fieldErrors);
          ui.toast(err.message || 'تعذر حفظ إعدادات المشروع.', 'error');
        }
      });
    }
  };

  await loadWorkspace();
}

