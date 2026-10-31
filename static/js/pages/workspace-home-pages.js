// static/js/pages/workspace-home-pages.js — Screens P07 (Dashboard), P12 (My Tasks) & P13 (Account)
import {
  JobTitle,
  UserStatus,
  TaskStatus,
  TaskPriority,
  formatEnumLabel,
} from '../contracts/enums.js';
import {
  normalizeOptionalUrl,
  toDateTimeLocalInputValue,
  toUtcIsoOrNull,
} from '../contracts/serializers.js';
import { store } from '../core/store.js';
import { ui, escapeHtml } from '../core/ui.js';
import { authService } from '../services/auth.js';
import { usersService } from '../services/users.js';
import { teamsService } from '../services/teams.js';
import { projectsService } from '../services/projects.js';
import { tasksService } from '../services/tasks.js';

function renderEnumSelect(enumObj, groupName, selectedValue = '', emptyLabel = '') {
  const options = [];
  if (emptyLabel) {
    options.push(`<option value="">${escapeHtml(emptyLabel)}</option>`);
  }
  for (const val of Object.values(enumObj)) {
    const isSelected = String(val) === String(selectedValue) ? 'selected' : '';
    options.push(
      `<option value="${escapeHtml(val)}" ${isSelected}>${escapeHtml(
        formatEnumLabel(groupName, val)
      )}</option>`
    );
  }
  return options.join('');
}

// ============================================================================
// Shared Task Detail & Comments Drawer (E35, E36, E37, E38, E39, E40, E41)
// ============================================================================
export async function openTaskDetailDrawer({
  taskId,
  teamMembers = [],
  canModify = true,
  canDelete = false,
  canComment = true,
  onUpdated = null,
}) {
  ui.openDrawer({
    title: `تفاصيل المهمة #${taskId}`,
    bodyHtml: ui.renderLoadingSkeleton('جاري تحميل بيانات المهمة والتعليقات (E35)...'),
  });

  let task = null;
  try {
    task = await tasksService.getById(taskId);
  } catch (err) {
    ui.openDrawer({
      title: `تفاصيل المهمة #${taskId}`,
      bodyHtml: ui.renderErrorState(err.message || 'تعذر تحميل المهمة.', false),
    });
    return;
  }

  const currentUserId = Number(store.getState().user?.id);
  const isSuperAdmin = Boolean(store.getState().user?.is_super_admin);

  const renderDrawerContent = (currentTask) => {
    const comments = currentTask.comments || [];

    ui.openDrawer({
      title: `المهمة #${currentTask.id}: ${currentTask.title}`,
      bodyHtml: `
        <div class="page-header-actions">
          ${ui.renderBadge('TaskStatus', currentTask.status)}
          ${ui.renderBadge('TaskPriority', currentTask.priority)}
          ${ui.renderBooleanBadge(currentTask.is_active)}
          <span class="badge mono">Position: ${Number(currentTask.position || 0)}</span>
        </div>

        ${
          currentTask.assignee_to_id === null && canModify
            ? `<div class="alert-banner">
                <span>هذه المهمة غير مسندة حالياً. يمكنك التقاطها وإسنادها لنفسك فوراً.</span>
                <button type="button" id="drawer-claim-task-btn" class="btn btn-sm btn-primary">التقاط المهمة (Claim Task)</button>
              </div>`
            : ''
        }

        <!-- Quick Accessible Move Bar (E38: PATCH /api/v1/tasks/{task_id}/move) -->
        <form id="drawer-move-task-form" class="card" style="background:var(--bg-subtle);">
          <h4>نقل سريع لحالة وترتيب المهمة (E38 — MoveTaskRequest)</h4>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="move-task-status">العمود / الحالة (status)</label>
              <select id="move-task-status" name="status" class="form-control" ${canModify ? '' : 'disabled'}>
                ${renderEnumSelect(TaskStatus, 'TaskStatus', currentTask.status)}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="move-task-position">الموضع الرقمي (position >= 0)</label>
              <input id="move-task-position" name="position" type="number" min="0" step="100" class="form-control" value="${Number(currentTask.position || 1000)}" ${canModify ? '' : 'disabled'} />
            </div>
          </div>
          <div class="page-header-actions" style="margin-top:0.5rem;">
            <button type="submit" class="btn btn-sm btn-primary" ${canModify ? '' : 'disabled'}>تنفيذ النقل (E38)</button>
          </div>
        </form>

        <!-- Full UpdateTaskRequest Form (E36: 8 fields) -->
        <form id="drawer-update-task-form" class="card">
          <h4>تحديث بيانات المهمة (E36 — UpdateTaskRequest)</h4>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="upd-task-title">عنوان المهمة (title) *</label>
              <input id="upd-task-title" name="title" type="text" class="form-control" required minlength="2" maxlength="200" value="${escapeHtml(currentTask.title)}" ${canModify ? '' : 'disabled'} />
            </div>
            <div class="form-group">
              <label class="form-label" for="upd-task-status">الحالة (status)</label>
              <select id="upd-task-status" name="status" class="form-control" ${canModify ? '' : 'disabled'}>
                ${renderEnumSelect(TaskStatus, 'TaskStatus', currentTask.status)}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="upd-task-priority">الأولوية (priority)</label>
              <select id="upd-task-priority" name="priority" class="form-control" ${canModify ? '' : 'disabled'}>
                ${renderEnumSelect(TaskPriority, 'TaskPriority', currentTask.priority)}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="upd-task-position">الترتيب (position)</label>
              <input id="upd-task-position" name="position" type="number" min="0" step="100" class="form-control" value="${Number(currentTask.position || 0)}" ${canModify ? '' : 'disabled'} />
            </div>
            <div class="form-group">
              <label class="form-label" for="upd-task-assignee">المطور المسند إليه (assignee_to_id)</label>
              ${
                teamMembers.length > 0
                  ? `<select id="upd-task-assignee" name="assignee_to_id" class="form-control" ${canModify ? '' : 'disabled'}>
                      <option value="">— غير مسندة (Unassigned / null) —</option>
                      ${teamMembers
                        .map(
                          (m) =>
                            `<option value="${m.member_id}" ${
                              Number(currentTask.assignee_to_id) === Number(m.member_id)
                                ? 'selected'
                                : ''
                            }>${escapeHtml(m.name || m.username || `#${m.member_id}`)} (${escapeHtml(m.role)})</option>`
                        )
                        .join('')}
                    </select>`
                  : `<input id="upd-task-assignee" name="assignee_to_id" type="number" min="1" class="form-control" value="${currentTask.assignee_to_id ?? ''}" placeholder="معرف العضو أو اتركه فارغاً لإلغاء الإسناد" ${canModify ? '' : 'disabled'} />`
              }
            </div>
            <div class="form-group">
              <label class="form-label" for="upd-task-deadline">الموعد النهائي (deadline)</label>
              <input id="upd-task-deadline" name="deadline" type="datetime-local" class="form-control" value="${escapeHtml(toDateTimeLocalInputValue(currentTask.deadline))}" ${canModify ? '' : 'disabled'} />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="upd-task-desc">الوصف التفصيلي (description)</label>
            <textarea id="upd-task-desc" name="description" rows="3" class="form-control" maxlength="5000" ${canModify ? '' : 'disabled'}>${escapeHtml(currentTask.description || '')}</textarea>
          </div>

          <div class="form-group">
            <label class="checkbox-row">
              <input type="checkbox" name="is_active" ${currentTask.is_active !== false ? 'checked' : ''} ${canModify ? '' : 'disabled'} />
              <span>المهمة نشطة (is_active)</span>
            </label>
          </div>

          <div class="card-footer">
            <button type="submit" class="btn btn-primary" ${canModify ? '' : 'disabled'}>حفظ التعديلات (E36)</button>
            ${
              canDelete
                ? `<button type="button" id="drawer-delete-task-btn" class="btn btn-danger">حذف المهمة (E37)</button>`
                : ''
            }
          </div>
        </form>

        <!-- Comments Section (E39, E40, E41) -->
        <div class="card">
          <div class="card-header">
            <h4>التعليقات والمناقشات الهندسية (${comments.length})</h4>
            <span class="field-hint">ملاحظة V1: التعليقات للقراءة أو الحذف فقط بعد النشر.</span>
          </div>

          ${
            comments.length === 0
              ? '<p class="field-hint">لا توجد تعليقات على هذه المهمة حتى الآن.</p>'
              : `<div class="form-group" style="gap:0.75rem;">
                  ${comments
                    .map((c) => {
                      const canDelThis =
                        isSuperAdmin || canDelete || Number(c.author_id) === currentUserId;
                      return `
                        <div class="card" style="padding:0.75rem;background:var(--bg-canvas);">
                          <div class="card-header">
                            <div>
                              <strong>${escapeHtml(c.author_name || c.author_username || `User #${c.author_id}`)}</strong>
                              <span class="field-hint mono">(#${c.id}) — ${ui.formatDateTime(c.created_at)}</span>
                            </div>
                            ${
                              canDelThis
                                ? `<div class="page-header-actions">
                                    <button type="button" class="btn btn-sm btn-danger" data-del-task-comment="${c.id}" title="DELETE /api/v1/tasks/{task_id}/comments/{comment_id}">حذف سياقي (E40)</button>
                                    <button type="button" class="btn btn-sm btn-outline" data-del-direct-comment="${c.id}" title="DELETE /api/v1/tasks/comments/{comment_id}">حذف مباشر (E41)</button>
                                  </div>`
                                : ''
                            }
                          </div>
                          <p style="white-space:pre-line;">${escapeHtml(c.content)}</p>
                        </div>
                      `;
                    })
                    .join('')}
                </div>`
          }

          ${
            canComment
              ? `<form id="drawer-add-comment-form" style="margin-top:0.75rem;">
                  <div class="form-group">
                    <label class="form-label" for="new-comment-content">إضافة تعليق جديد (E39 — CreateCommentRequest) *</label>
                    <textarea id="new-comment-content" name="content" rows="2" class="form-control" required minlength="1" maxlength="2000" placeholder="اكتب ملاحظتك أو تحديثك الفني..."></textarea>
                  </div>
                  <div class="page-header-actions" style="margin-top:0.5rem;">
                    <button type="submit" class="btn btn-sm btn-primary">نشر التعليق (E39)</button>
                  </div>
                </form>`
              : ''
          }
        </div>
      `,
      onMount: (panel) => {
        const refreshTaskInDrawer = async () => {
          const refreshed = await tasksService.getById(currentTask.id);
          renderDrawerContent(refreshed);
          if (typeof onUpdated === 'function') onUpdated(refreshed);
        };

        // Claim Task Button (E36)
        const claimBtn = panel.querySelector('#drawer-claim-task-btn');
        if (claimBtn) {
          claimBtn.addEventListener('click', async () => {
            claimBtn.disabled = true;
            try {
              await tasksService.update(currentTask.id, currentTask, {
                assignee_to_id: currentUserId,
              });
              ui.toast('تم إسناد المهمة إليك بنجاح.', 'success');
              await refreshTaskInDrawer();
            } catch (err) {
              ui.toast(err.message || 'تعذر التقاط المهمة.', 'error');
              claimBtn.disabled = false;
            }
          });
        }

        // Move Task Form (E38)
        const moveForm = panel.querySelector('#drawer-move-task-form');
        if (moveForm) {
          moveForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(moveForm);
            try {
              await tasksService.move(currentTask.id, {
                status: String(fd.get('status') || currentTask.status),
                position: Number(fd.get('position') || 0),
              });
              ui.toast('تم نقل المهمة وتحديث ترتيبها (E38).', 'success');
              await refreshTaskInDrawer();
            } catch (err) {
              ui.toast(err.message || 'تعذر نقل المهمة.', 'error');
            }
          });
        }

        // Update Task Form (E36)
        const updForm = panel.querySelector('#drawer-update-task-form');
        if (updForm) {
          updForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(updForm);
            const rawAssignee = String(fd.get('assignee_to_id') || '').trim();
            try {
              const formValues = {
                title: String(fd.get('title') || '').trim(),
                description: String(fd.get('description') || ''),
                status: String(fd.get('status') || currentTask.status),
                priority: String(fd.get('priority') || currentTask.priority),
                position: Number(fd.get('position') || 0),
                assignee_to_id: rawAssignee ? Number(rawAssignee) : null,
                deadline: toUtcIsoOrNull(fd.get('deadline')),
                is_active: fd.get('is_active') === 'on',
              };
              await tasksService.update(currentTask.id, currentTask, formValues);
              ui.toast('تم حفظ تعديلات المهمة (E36).', 'success');
              await refreshTaskInDrawer();
            } catch (err) {
              ui.applyFieldErrors(updForm, err.fieldErrors);
              ui.toast(err.message || 'تعذر تحديث المهمة.', 'error');
            }
          });
        }

        // Delete Task Button (E37)
        const delTaskBtn = panel.querySelector('#drawer-delete-task-btn');
        if (delTaskBtn) {
          delTaskBtn.addEventListener('click', async () => {
            delTaskBtn.disabled = true;
            try {
              await tasksService.remove(currentTask.id);
              ui.toast('تم حذف المهمة بنجاح (E37).', 'success');
              ui.closeDrawer();
              if (typeof onUpdated === 'function') onUpdated(null);
            } catch (err) {
              ui.toast(err.message || 'تعذر حذف المهمة.', 'error');
              delTaskBtn.disabled = false;
            }
          });
        }

        // Add Comment Form (E39)
        const addCommentForm = panel.querySelector('#drawer-add-comment-form');
        if (addCommentForm) {
          addCommentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(addCommentForm);
            try {
              await tasksService.addComment(currentTask.id, fd.get('content'));
              ui.toast('تمت إضافة التعليق (E39).', 'success');
              await refreshTaskInDrawer();
            } catch (err) {
              ui.toast(err.message || 'تعذر إضافة التعليق.', 'error');
            }
          });
        }

        // Scoped Comment Delete (E40)
        panel.querySelectorAll('[data-del-task-comment]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const cid = Number(btn.getAttribute('data-del-task-comment'));
            btn.disabled = true;
            try {
              await tasksService.deleteTaskComment(currentTask.id, cid);
              ui.toast('تم حذف التعليق عبر المسار السياقي (E40).', 'success');
              await refreshTaskInDrawer();
            } catch (err) {
              ui.toast(err.message || 'تعذر حذف التعليق.', 'error');
              btn.disabled = false;
            }
          });
        });

        // Direct Comment Delete (E41)
        panel.querySelectorAll('[data-del-direct-comment]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const cid = Number(btn.getAttribute('data-del-direct-comment'));
            btn.disabled = true;
            try {
              await tasksService.deleteCommentById(cid);
              ui.toast('تم حذف التعليق عبر المسار المباشر (E41).', 'success');
              await refreshTaskInDrawer();
            } catch (err) {
              ui.toast(err.message || 'تعذر حذف التعليق.', 'error');
              btn.disabled = false;
            }
          });
        });
      },
    });
  };

  renderDrawerContent(task);
}

// ============================================================================
// P07: Developer Dashboard (#/app/dashboard) — E08, E13, E34, E17, E27
// ============================================================================
export async function mountDashboardPage({ container, scope, isStale }) {
  container.innerHTML = ui.renderLoadingSkeleton('جاري تجميع مؤشرات لوحة المطور (E13)...');

  const [meInfo, stats, myTasksPage, teamsPage, projectsPage] = await Promise.all([
    authService.getMe(scope.signal),
    usersService.getDashboard(scope.signal),
    tasksService.listMyTasks({ offset: 0, limit: 6 }, scope.signal),
    teamsService.list({ offset: 0, limit: 6 }, scope.signal),
    projectsService.listAll({ offset: 0, limit: 6 }, scope.signal),
  ]);

  if (isStale()) return;

  const user = meInfo?.user || store.getState().user;
  const memberships = meInfo?.memberships || [];

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>مرحباً، ${escapeHtml(user?.name || user?.username || 'مطور')} (P07)</h1>
        <p>ملخص عبء العمل الهندسي، عضويات الفرق، والمهام المسندة إليك.</p>
      </div>
      <div class="page-header-actions">
        <a href="#/app/my-tasks" class="btn btn-primary">عرض كافة مهامي (P12)</a>
        <a href="#/app/teams" class="btn btn-outline">الفرق الهندسية (P08)</a>
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:1.5rem;">
      <div class="stat-card">
        <div class="stat-label">إجمالي المهام المسندة</div>
        <div class="stat-value">${Number(stats.total_assigned_tasks || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">في الانتظار (Pending)</div>
        <div class="stat-value">${Number(stats.pending_tasks || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">قيد التنفيذ (In Progress)</div>
        <div class="stat-value">${Number(stats.in_progress_tasks || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">قيد المراجعة (In Review)</div>
        <div class="stat-value">${Number(stats.review_tasks || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">مكتملة (Completed)</div>
        <div class="stat-value">${Number(stats.completed_tasks || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">متأخرة (Overdue)</div>
        <div class="stat-value" style="color:var(--status-danger-fg);">${Number(stats.overdue_tasks || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">الفرق النشطة</div>
        <div class="stat-value">${Number(stats.active_teams_count || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">المشاريع النشطة</div>
        <div class="stat-value">${Number(stats.active_projects_count || 0)}</div>
      </div>
    </div>

    <div class="split-grid">
      <div class="card">
        <div class="card-header">
          <h3>أولويات مهامي المسندة (E34 — مرتبة حسب الأولوية)</h3>
          <a href="#/app/my-tasks" class="btn btn-sm btn-outline">الكل ←</a>
        </div>
        ${
          myTasksPage.items.length === 0
            ? ui.renderEmptyState('لا توجد مهام مسندة إليك حالياً')
            : `<div class="table-scroll-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>المهمة</th>
                      <th>الأولوية</th>
                      <th>الحالة</th>
                      <th>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${myTasksPage.items
                      .map(
                        (t) => `
                      <tr>
                        <td>
                          <strong>${escapeHtml(t.title)}</strong>
                          <div class="field-hint">مشروع #${t.project_id}</div>
                        </td>
                        <td>${ui.renderBadge('TaskPriority', t.priority)}</td>
                        <td>${ui.renderBadge('TaskStatus', t.status)}</td>
                        <td>
                          <button type="button" class="btn btn-sm btn-outline" data-open-task="${t.id}">فتح (E35)</button>
                        </td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
      </div>

      <div class="card">
        <div class="card-header">
          <h3>عضوياتي في الفرق (${memberships.length}) والمشاريع (${projectsPage.total})</h3>
          <a href="#/app/projects" class="btn btn-sm btn-outline">المشاريع ←</a>
        </div>
        ${
          teamsPage.items.length === 0
            ? ui.renderEmptyState(
                'لست عضواً في أي فريق بعد',
                'يمكن لأي مطور إنشاء فريق جديد ليصبح قائداً له.',
                `<a href="#/app/teams" class="btn btn-sm btn-primary">إنشاء فريق جديد</a>`
              )
            : `<div class="form-group" style="gap:0.65rem;">
                ${teamsPage.items
                  .map(
                    (team) => `
                  <div class="card" style="padding:0.85rem;background:var(--bg-canvas);">
                    <div class="card-header">
                      <div>
                        <strong><a href="#/app/teams/${team.id}">${escapeHtml(team.name)}</a></strong>
                        <span class="field-hint mono">(${escapeHtml(team.slug)})</span>
                      </div>
                      <a href="#/app/teams/${team.id}" class="btn btn-sm btn-outline">فتح الفريق</a>
                    </div>
                  </div>
                `
                  )
                  .join('')}
              </div>`
        }
      </div>
    </div>
  `;

  container.querySelectorAll('[data-open-task]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tid = Number(btn.getAttribute('data-open-task'));
      openTaskDetailDrawer({
        taskId: tid,
        canModify: true,
        canDelete: Boolean(user?.is_super_admin),
        canComment: true,
        onUpdated: () => mountDashboardPage({ container, scope, isStale }),
      });
    });
  });
}

// ============================================================================
// P12: My Assigned Tasks (#/app/my-tasks) — E34, E35, E36, E38, E39, E40, E41
// ============================================================================
export async function mountMyTasksPage({ container, scope, isStale }) {
  let offset = 0;
  const limit = 20;

  const loadTasks = async () => {
    container.innerHTML = ui.renderLoadingSkeleton('جاري تحميل مهامك المسندة عبر المشاريع (E34)...');
    const pageModel = await tasksService.listMyTasks({ offset, limit }, scope.signal);
    if (isStale()) return;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>مهامي المسندة عبر المشاريع (P12)</h1>
          <p>مرتبة دلالياً من الخادم حسب الأولوية (Critical → High → Medium → Low).</p>
        </div>
        <div class="page-header-actions">
          <form id="direct-comment-delete-form" class="page-header-actions">
            <input name="comment_id" type="number" min="1" class="form-control" style="width:12rem;" placeholder="معرف تعليق لحذفه (E41)" required />
            <button type="submit" class="btn btn-sm btn-danger">حذف تعليق بالمعرف (E41)</button>
          </form>
        </div>
      </div>

      ${
        pageModel.items.length === 0
          ? ui.renderEmptyState('لا توجد مهام مسندة إليك حالياً')
          : `<div class="table-scroll-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>العنوان</th>
                    <th>المشروع</th>
                    <th>الأولوية</th>
                    <th>الحالة</th>
                    <th>الموعد النهائي</th>
                    <th>التعليقات</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageModel.items
                    .map(
                      (task) => `
                    <tr>
                      <td class="mono">#${task.id}</td>
                      <td><strong>${escapeHtml(task.title)}</strong></td>
                      <td><a href="#/app/projects/${task.project_id}" class="badge badge-brand">مشروع #${task.project_id}</a></td>
                      <td>${ui.renderBadge('TaskPriority', task.priority)}</td>
                      <td>${ui.renderBadge('TaskStatus', task.status)}</td>
                      <td>${ui.formatDateTime(task.deadline)}</td>
                      <td><span class="badge">${Number(task.comments_count || 0)}</span></td>
                      <td>
                        <div class="page-header-actions">
                          <button type="button" class="btn btn-sm btn-primary" data-inspect-task="${task.id}">التفاصيل والتعليقات (E35)</button>
                        </div>
                      </td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
            ${ui.renderPaginationBar(pageModel, 'my-tasks')}`
      }
    `;

    const directDelForm = container.querySelector('#direct-comment-delete-form');
    if (directDelForm) {
      directDelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(directDelForm);
        const cid = Number(fd.get('comment_id'));
        if (!cid) return;
        try {
          await tasksService.deleteCommentById(cid);
          ui.toast(`تم حذف التعليق #${cid} بنجاح (E41).`, 'success');
          directDelForm.reset();
          loadTasks();
        } catch (err) {
          ui.toast(err.message || 'تعذر حذف التعليق.', 'error');
        }
      });
    }

    container.querySelectorAll('[data-inspect-task]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tid = Number(btn.getAttribute('data-inspect-task'));
        openTaskDetailDrawer({
          taskId: tid,
          canModify: true,
          canDelete: Boolean(store.getState().user?.is_super_admin),
          canComment: true,
          onUpdated: () => loadTasks(),
        });
      });
    });

    ui.bindPaginationBar(
      container,
      pageModel,
      (nextOffset) => {
        offset = nextOffset;
        loadTasks();
      },
      'my-tasks'
    );
  };

  await loadTasks();
}

// ============================================================================
// P13: Account, Profile & Security Settings (#/app/account) — E08, E10, E12, E14, E06, E07, E11
// ============================================================================
export async function mountAccountPage({ container, scope, router, isStale }) {
  container.innerHTML = ui.renderLoadingSkeleton('جاري تحميل بيانات الحساب والأمان (E10 & E08)...');

  const [profile, meContext] = await Promise.all([
    usersService.getProfile(scope.signal),
    authService.getMe(scope.signal),
  ]);
  if (isStale()) return;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>إعدادات الحساب والأمان (P13)</h1>
        <p>تحديث الملف الشخصي (E12)، تغيير كلمة المرور (E14)، إدارة الجلسات (E06/E07)، أو تعطيل الحساب (E11).</p>
      </div>
      <div class="page-header-actions">
        ${ui.renderBadge('UserStatus', profile.status)}
        <span class="badge mono">Security Version: v${Number(profile.security_version || 1)}</span>
      </div>
    </div>

    <div class="split-grid">
      <!-- E12: PATCH /api/v1/users/me (9 fields in UpdateSchemaRequest) -->
      <form id="account-profile-form" class="card" novalidate>
        <h3>تحديث الملف الشخصي (E12 — UpdateSchemaRequest)</h3>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="prof-name">الاسم الكامل (name) *</label>
            <input id="prof-name" name="name" type="text" class="form-control" required minlength="1" maxlength="100" value="${escapeHtml(profile.name)}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-status">حالة التواجد (status) *</label>
            <select id="prof-status" name="status" class="form-control" required>
              ${renderEnumSelect(UserStatus, 'UserStatus', profile.status)}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-job-title">المسمى الوظيفي (job_title)</label>
            <select id="prof-job-title" name="job_title" class="form-control">
              ${renderEnumSelect(JobTitle, 'JobTitle', profile.job_title || '', '— غير محدد (null) —')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-avatar-url">رابط الصورة الرمزية (avatar_url)</label>
            <input id="prof-avatar-url" name="avatar_url" type="url" class="form-control" value="${escapeHtml(profile.avatar_url || '')}" placeholder="https://..." />
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-github-url">رابط GitHub (github_url)</label>
            <input id="prof-github-url" name="github_url" type="url" class="form-control" value="${escapeHtml(profile.github_url || '')}" placeholder="https://github.com/..." />
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-linkedin-url">رابط LinkedIn (linkedin_url)</label>
            <input id="prof-linkedin-url" name="linkedin_url" type="url" class="form-control" value="${escapeHtml(profile.linkedin_url || '')}" placeholder="https://linkedin.com/in/..." />
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-website-url">رابط الموقع الشخصي / المعرض (website_url)</label>
            <input id="prof-website-url" name="website_url" type="url" class="form-control" value="${escapeHtml(profile.website_url || '')}" placeholder="https://..." />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="prof-bio">النبذة التعريفية (bio)</label>
          <textarea id="prof-bio" name="bio" rows="3" class="form-control" maxlength="500">${escapeHtml(profile.bio || '')}</textarea>
        </div>

        <div class="form-group">
          <label class="checkbox-row">
            <input type="checkbox" name="is_public_member" ${profile.is_public_member ? 'checked' : ''} />
            <span>إظهار ملفي الشخصي في دليل الكفاءات العام للزوار (is_public_member)</span>
          </label>
        </div>

        <div class="card-footer">
          <span class="field-hint">تُرسل فقط الحقول المعدلة عبر buildPatchPayload.</span>
          <button type="submit" id="save-profile-btn" class="btn btn-primary">حفظ التغييرات (E12)</button>
        </div>
      </form>

      <div class="form-group" style="gap:1.25rem;">
        <!-- E14: PATCH /api/v1/users/me/password (ChangePasswordRequest) -->
        <form id="account-password-form" class="card" novalidate>
          <h3>تغيير كلمة المرور (E14 — ChangePasswordRequest)</h3>
          <p class="field-hint">تنبيه أمني: تغيير كلمة المرور يرفع رقم إصدار الأمان (security_version) ويُبطل كافة الجلسات الحالية فوراً.</p>
          <div class="form-group">
            <label class="form-label" for="pw-old">كلمة المرور الحالية (old_password) *</label>
            <input id="pw-old" name="old_password" type="password" class="form-control" required minlength="8" maxlength="128" />
          </div>
          <div class="form-group">
            <label class="form-label" for="pw-new">كلمة المرور الجديدة (new_password) *</label>
            <input id="pw-new" name="new_password" type="password" class="form-control" required minlength="8" maxlength="100" />
          </div>
          <div class="card-footer">
            <button type="submit" id="change-pw-btn" class="btn btn-primary">تحديث كلمة المرور وإعادة الدخول (E14)</button>
          </div>
        </form>

        <!-- E06, E07 & E11 Session & Account Lifecycle Controls -->
        <div class="card">
          <h3>إدارة الجلسات النشطة ومنطقة الخطر</h3>
          <p class="field-hint">عدد عضويات الفرق النشطة في الجلسة (E08): <strong>${(meContext?.memberships || []).length}</strong></p>
          <div class="page-header-actions">
            <button type="button" id="acc-logout-btn" class="btn btn-outline">تسجيل الخروج من هذا المتصفح (E06)</button>
            <button type="button" id="acc-logout-all-btn" class="btn btn-warning">إنهاء كافة الجلسات على جميع الأجهزة (E07)</button>
          </div>
          <div class="card-footer">
            <div>
              <strong style="color:var(--status-danger-fg);">تعطيل الحساب الذاتي (E11 — DELETE /api/v1/users/me)</strong>
              <p class="field-hint">يُعطل حسابك ويمنع الدخول مستقبلاً (محمي من تعطيل آخر Super Admin).</p>
            </div>
            <button type="button" id="acc-deactivate-self-btn" class="btn btn-danger">تعطيل حسابي نهائياً (E11)</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // E12 Handler
  const profileForm = container.querySelector('#account-profile-form');
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = container.querySelector('#save-profile-btn');
    btn.disabled = true;
    const fd = new FormData(profileForm);
    try {
      const formValues = {
        name: String(fd.get('name') || '').trim(),
        status: String(fd.get('status') || profile.status),
        job_title: String(fd.get('job_title') || '') || null,
        bio: String(fd.get('bio') || '').trim() || null,
        avatar_url: normalizeOptionalUrl(fd.get('avatar_url')),
        github_url: normalizeOptionalUrl(fd.get('github_url')),
        linkedin_url: normalizeOptionalUrl(fd.get('linkedin_url')),
        website_url: normalizeOptionalUrl(fd.get('website_url')),
        is_public_member: fd.get('is_public_member') === 'on',
      };
      await usersService.updateProfile(profile, formValues);
      ui.toast('تم تحديث الملف الشخصي بنجاح (E12).', 'success');
      await mountAccountPage({ container, scope, router, isStale });
    } catch (err) {
      ui.applyFieldErrors(profileForm, err.fieldErrors);
      ui.toast(err.message || 'تعذر تحديث الملف الشخصي.', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // E14 Handler (Trap 8: Immediate session cleanup + redirect to #/login)
  const pwForm = container.querySelector('#account-password-form');
  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = container.querySelector('#change-pw-btn');
    btn.disabled = true;
    const fd = new FormData(pwForm);
    try {
      await usersService.changePassword({
        old_password: String(fd.get('old_password') || ''),
        new_password: String(fd.get('new_password') || ''),
      });
      ui.toast('تم تغيير كلمة المرور وإبطال الجلسات السابقة. يرجى تسجيل الدخول مجدداً.', 'success');
      router.navigate('#/login');
    } catch (err) {
      ui.applyFieldErrors(pwForm, err.fieldErrors);
      ui.toast(err.message || 'تعذر تغيير كلمة المرور.', 'error');
      btn.disabled = false;
    }
  });

  // E06 Handler
  container.querySelector('#acc-logout-btn').addEventListener('click', async () => {
    await authService.logout();
    ui.toast('تم تسجيل الخروج بنجاح (E06).', 'info');
    router.navigate('#/login');
  });

  // E07 Handler
  container.querySelector('#acc-logout-all-btn').addEventListener('click', async () => {
    await authService.logoutAll();
    ui.toast('تم إبطال جميع الجلسات النشطة على كافة الأجهزة (E07).', 'warning');
    router.navigate('#/login');
  });

  // E11 Handler
  container.querySelector('#acc-deactivate-self-btn').addEventListener('click', () => {
    ui.openModal({
      title: 'تأكيد تعطيل الحساب الذاتي (E11)',
      bodyHtml: `
        <div class="alert-banner alert-danger">
          <span>هل أنت متأكد من رغبتك في تعطيل حسابك الشخصي؟ سيتم إنهاء جلستك فوراً ولن تتمكن من الدخول مرة أخرى.</span>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-outline" data-close-modal="true">إلغاء</button>
        <button type="button" id="confirm-self-deactivate-btn" class="btn btn-danger">تأكيد تعطيل الحساب (E11)</button>
      `,
      onMount: (dialog) => {
        const confirmBtn = dialog.querySelector('#confirm-self-deactivate-btn');
        confirmBtn.addEventListener('click', async () => {
          confirmBtn.disabled = true;
          try {
            await usersService.deactivateSelf();
            ui.closeModal();
            ui.toast('تم تعطيل حسابك وإنهاء الجلسة بنجاح (E11).', 'warning');
            router.navigate('#/login');
          } catch (err) {
            ui.toast(err.message || 'تعذر تعطيل الحساب (قد تكون آخر Super Admin نشط).', 'error');
            confirmBtn.disabled = false;
          }
        });
      },
    });
  });
}

