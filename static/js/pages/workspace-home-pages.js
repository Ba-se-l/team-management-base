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
import { t, tr } from '../core/i18n.js';
import { renderIcon } from '../components/icon.js';
import { renderAvatar, bindLiveAvatarPreview } from '../components/avatar.js';
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
    title: tr(`تفاصيل المهمة #${taskId}`, `Task Details #${taskId}`),
    bodyHtml: ui.renderLoadingSkeleton(
      tr('جاري تحميل بيانات المهمة والتعليقات (E35)...', 'Loading task details and comments (E35)...')
    ),
  });

  let task = null;
  try {
    task = await tasksService.getById(taskId);
  } catch (err) {
    ui.openDrawer({
      title: tr(`تفاصيل المهمة #${taskId}`, `Task Details #${taskId}`),
      bodyHtml: ui.renderErrorState(
        err.message || tr('تعذر تحميل المهمة.', 'Failed to load task.'),
        false
      ),
    });
    return;
  }

  const currentUserId = Number(store.getState().user?.id);
  const isSuperAdmin = Boolean(store.getState().user?.is_super_admin);

  const renderDrawerContent = (currentTask) => {
    const comments = currentTask.comments || [];

    ui.openDrawer({
      title: `${tr('المهمة', 'Task')} #${currentTask.id}: ${currentTask.title}`,
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
                <span>${escapeHtml(tr('هذه المهمة غير مسندة حالياً. يمكنك التقاطها وإسنادها لنفسك فوراً.', 'This task is currently unassigned. You can claim and assign it to yourself immediately.'))}</span>
                <button type="button" id="drawer-claim-task-btn" class="btn btn-sm btn-primary">${renderIcon('user-check', { size: 14 })} <span>${escapeHtml(tr('التقاط المهمة (Claim Task)', 'Claim Task'))}</span></button>
              </div>`
            : ''
        }

        <!-- Quick Accessible Move Bar (E38: PATCH /api/v1/tasks/{task_id}/move) -->
        <form id="drawer-move-task-form" class="card" style="background:var(--bg-subtle);">
          <h4>${escapeHtml(tr('نقل سريع لحالة وترتيب المهمة (E38 — MoveTaskRequest)', 'Quick Move Task Status & Position (E38 — MoveTaskRequest)'))}</h4>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="move-task-status">${escapeHtml(tr('العمود / الحالة (status)', 'Column / Status (status)'))}</label>
              <select id="move-task-status" name="status" class="form-control" ${canModify ? '' : 'disabled'}>
                ${renderEnumSelect(TaskStatus, 'TaskStatus', currentTask.status)}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="move-task-position">${escapeHtml(tr('الموضع الرقمي (position >= 0)', 'Numeric Position (position >= 0)'))}</label>
              <input id="move-task-position" name="position" type="number" min="0" step="100" class="form-control" value="${Number(currentTask.position || 1000)}" ${canModify ? '' : 'disabled'} />
            </div>
          </div>
          <div class="page-header-actions" style="margin-block-start:0.5rem;">
            <button type="submit" class="btn btn-sm btn-primary" ${canModify ? '' : 'disabled'}>${renderIcon('move', { size: 14 })} <span>${escapeHtml(tr('تنفيذ النقل (E38)', 'Execute Move (E38)'))}</span></button>
          </div>
        </form>

        <!-- Full UpdateTaskRequest Form (E36: 8 fields) -->
        <form id="drawer-update-task-form" class="card">
          <h4>${escapeHtml(tr('تحديث بيانات المهمة (E36 — UpdateTaskRequest)', 'Update Task Details (E36 — UpdateTaskRequest)'))}</h4>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="upd-task-title">${escapeHtml(tr('عنوان المهمة (title) *', 'Task Title (title) *'))}</label>
              <input id="upd-task-title" name="title" type="text" class="form-control" required minlength="2" maxlength="200" value="${escapeHtml(currentTask.title)}" ${canModify ? '' : 'disabled'} />
            </div>
            <div class="form-group">
              <label class="form-label" for="upd-task-status">${escapeHtml(tr('الحالة (status)', 'Status (status)'))}</label>
              <select id="upd-task-status" name="status" class="form-control" ${canModify ? '' : 'disabled'}>
                ${renderEnumSelect(TaskStatus, 'TaskStatus', currentTask.status)}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="upd-task-priority">${escapeHtml(tr('الأولوية (priority)', 'Priority (priority)'))}</label>
              <select id="upd-task-priority" name="priority" class="form-control" ${canModify ? '' : 'disabled'}>
                ${renderEnumSelect(TaskPriority, 'TaskPriority', currentTask.priority)}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="upd-task-position">${escapeHtml(tr('الترتيب (position)', 'Position (position)'))}</label>
              <input id="upd-task-position" name="position" type="number" min="0" step="100" class="form-control" value="${Number(currentTask.position || 0)}" ${canModify ? '' : 'disabled'} />
            </div>
            <div class="form-group">
              <label class="form-label" for="upd-task-assignee">${escapeHtml(tr('المطور المسند إليه (assignee_to_id)', 'Assigned Developer (assignee_to_id)'))}</label>
              ${
                teamMembers.length > 0
                  ? `<select id="upd-task-assignee" name="assignee_to_id" class="form-control" ${canModify ? '' : 'disabled'}>
                      <option value="">${escapeHtml(tr('— غير مسندة (Unassigned / null) —', '— Unassigned (null) —'))}</option>
                      ${teamMembers
                        .map(
                          (m) =>
                            `<option value="${m.member_id}" ${
                              Number(currentTask.assignee_to_id) === Number(m.member_id)
                                ? 'selected'
                                : ''
                            }>${escapeHtml(m.name || m.username || `#${m.member_id}`)} (${escapeHtml(formatEnumLabel('TeamRole', m.role))})</option>`
                        )
                        .join('')}
                    </select>`
                  : `<input id="upd-task-assignee" name="assignee_to_id" type="number" min="1" class="form-control" value="${currentTask.assignee_to_id ?? ''}" placeholder="${escapeHtml(tr('معرف العضو أو اتركه فارغاً لإلغاء الإسناد', 'Member ID or leave blank to unassign'))}" ${canModify ? '' : 'disabled'} />`
              }
            </div>
            <div class="form-group">
              <label class="form-label" for="upd-task-deadline">${escapeHtml(tr('الموعد النهائي (deadline)', 'Deadline (deadline)'))}</label>
              <input id="upd-task-deadline" name="deadline" type="datetime-local" class="form-control" value="${escapeHtml(toDateTimeLocalInputValue(currentTask.deadline))}" ${canModify ? '' : 'disabled'} />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="upd-task-desc">${escapeHtml(tr('الوصف التفصيلي (description)', 'Detailed Description (description)'))}</label>
            <textarea id="upd-task-desc" name="description" rows="3" class="form-control" maxlength="5000" ${canModify ? '' : 'disabled'}>${escapeHtml(currentTask.description || '')}</textarea>
          </div>

          <div class="form-group">
            <label class="checkbox-row">
              <input type="checkbox" name="is_active" ${currentTask.is_active !== false ? 'checked' : ''} ${canModify ? '' : 'disabled'} />
              <span>${escapeHtml(tr('المهمة نشطة (is_active)', 'Task is active (is_active)'))}</span>
            </label>
          </div>

          <div class="card-footer">
            <button type="submit" class="btn btn-primary" ${canModify ? '' : 'disabled'}>${renderIcon('check', { size: 15 })} <span>${escapeHtml(tr('حفظ التعديلات (E36)', 'Save Changes (E36)'))}</span></button>
            ${
              canDelete
                ? `<button type="button" id="drawer-delete-task-btn" class="btn btn-danger">${renderIcon('trash-2', { size: 15 })} <span>${escapeHtml(tr('حذف المهمة (E37)', 'Delete Task (E37)'))}</span></button>`
                : ''
            }
          </div>
        </form>

        <!-- Comments Section (E39, E40, E41) -->
        <div class="card">
          <div class="card-header">
            <h4>${renderIcon('message-square', { size: 16 })} <span>${escapeHtml(tr(`التعليقات والمناقشات الهندسية (${comments.length})`, `Engineering Comments & Discussion (${comments.length})`))}</span></h4>
            <span class="field-hint">${escapeHtml(tr('ملاحظة V1: التعليقات للقراءة أو الحذف فقط بعد النشر.', 'V1 Note: Comments are read/delete only after posting.'))}</span>
          </div>

          ${
            comments.length === 0
              ? `<p class="field-hint">${escapeHtml(tr('لا توجد تعليقات على هذه المهمة حتى الآن.', 'No comments on this task yet.'))}</p>`
              : `<div class="form-group" style="gap:0.75rem;">
                  ${comments
                    .map((c) => {
                      const canDelThis =
                        isSuperAdmin || canDelete || Number(c.author_id) === currentUserId;
                      const authorObj = {
                        name: c.author_name || c.author_username || `U${c.author_id}`,
                        username: c.author_username,
                        avatar_url: c.author_avatar_url,
                      };
                      return `
                        <div class="card" style="padding:0.75rem;background:var(--bg-canvas);">
                          <div class="card-header">
                            <div class="avatar-row">
                              ${renderAvatar(authorObj, { size: 'sm' })}
                              <div class="avatar-meta">
                                <strong class="avatar-name">${escapeHtml(c.author_name || c.author_username || `User #${c.author_id}`)}</strong>
                                <span class="avatar-sub mono">(#${c.id}) — ${ui.formatDateTime(c.created_at)}</span>
                              </div>
                            </div>
                            ${
                              canDelThis
                                ? `<div class="page-header-actions">
                                    <button type="button" class="btn btn-sm btn-danger" data-del-task-comment="${c.id}" title="DELETE /api/v1/tasks/{task_id}/comments/{comment_id}">${renderIcon('trash-2', { size: 13 })} <span>${escapeHtml(tr('حذف سياقي (E40)', 'Scoped Delete (E40)'))}</span></button>
                                    <button type="button" class="btn btn-sm btn-outline" data-del-direct-comment="${c.id}" title="DELETE /api/v1/tasks/comments/{comment_id}">${renderIcon('trash-2', { size: 13 })} <span>${escapeHtml(tr('حذف مباشر (E41)', 'Direct Delete (E41)'))}</span></button>
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
              ? `<form id="drawer-add-comment-form" style="margin-block-start:0.75rem;">
                  <div class="form-group">
                    <label class="form-label" for="new-comment-content">${escapeHtml(tr('إضافة تعليق جديد (E39 — CreateCommentRequest) *', 'Add New Comment (E39 — CreateCommentRequest) *'))}</label>
                    <textarea id="new-comment-content" name="content" rows="2" class="form-control" required minlength="1" maxlength="2000" placeholder="${escapeHtml(tr('اكتب ملاحظتك أو تحديثك الفني...', 'Write your technical note or update...'))}"></textarea>
                  </div>
                  <div class="page-header-actions" style="margin-block-start:0.5rem;">
                    <button type="submit" class="btn btn-sm btn-primary">${renderIcon('send', { size: 14 })} <span>${escapeHtml(tr('نشر التعليق (E39)', 'Post Comment (E39)'))}</span></button>
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
              ui.toast(tr('تم إسناد المهمة إليك بنجاح.', 'Task assigned to you successfully.'), 'success');
              await refreshTaskInDrawer();
            } catch (err) {
              ui.toast(err.message || tr('تعذر التقاط المهمة.', 'Failed to claim task.'), 'error');
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
              ui.toast(tr('تم نقل المهمة وتحديث ترتيبها (E38).', 'Task moved and reordered (E38).'), 'success');
              await refreshTaskInDrawer();
            } catch (err) {
              ui.toast(err.message || tr('تعذر نقل المهمة.', 'Failed to move task.'), 'error');
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
              ui.toast(tr('تم حفظ تعديلات المهمة (E36).', 'Task changes saved (E36).'), 'success');
              await refreshTaskInDrawer();
            } catch (err) {
              ui.applyFieldErrors(updForm, err.fieldErrors);
              ui.toast(err.message || tr('تعذر تحديث المهمة.', 'Failed to update task.'), 'error');
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
              ui.toast(tr('تم حذف المهمة بنجاح (E37).', 'Task deleted successfully (E37).'), 'success');
              ui.closeDrawer();
              if (typeof onUpdated === 'function') onUpdated(null);
            } catch (err) {
              ui.toast(err.message || tr('تعذر حذف المهمة.', 'Failed to delete task.'), 'error');
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
              ui.toast(tr('تمت إضافة التعليق (E39).', 'Comment added (E39).'), 'success');
              await refreshTaskInDrawer();
            } catch (err) {
              ui.toast(err.message || tr('تعذر إضافة التعليق.', 'Failed to add comment.'), 'error');
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
              ui.toast(tr('تم حذف التعليق عبر المسار السياقي (E40).', 'Comment deleted via scoped endpoint (E40).'), 'success');
              await refreshTaskInDrawer();
            } catch (err) {
              ui.toast(err.message || tr('تعذر حذف التعليق.', 'Failed to delete comment.'), 'error');
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
              ui.toast(tr('تم حذف التعليق عبر المسار المباشر (E41).', 'Comment deleted via direct endpoint (E41).'), 'success');
              await refreshTaskInDrawer();
            } catch (err) {
              ui.toast(err.message || tr('تعذر حذف التعليق.', 'Failed to delete comment.'), 'error');
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
  container.innerHTML = ui.renderLoadingSkeleton(
    tr('جاري تجميع مؤشرات لوحة المطور (E13)...', 'Aggregating developer dashboard metrics (E13)...')
  );

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
      <div class="avatar-row">
        ${renderAvatar(user, { size: 'lg' })}
        <div class="avatar-meta">
          <h1>${escapeHtml(tr(`مرحباً، ${user?.name || user?.username || 'مطور'} (P07)`, `Welcome, ${user?.name || user?.username || 'Developer'} (P07)`))}</h1>
          <p>${escapeHtml(tr('ملخص عبء العمل الهندسي، عضويات الفرق، والمهام المسندة إليك.', 'Summary of your engineering workload, team memberships, and assigned tasks.'))}</p>
        </div>
      </div>
      <div class="page-header-actions">
        <a href="#/app/my-tasks" class="btn btn-primary">${renderIcon('check-square', { size: 15 })} <span>${escapeHtml(tr('عرض كافة مهامي (P12)', 'View All My Tasks (P12)'))}</span></a>
        <a href="#/app/teams" class="btn btn-outline">${renderIcon('users', { size: 15 })} <span>${escapeHtml(tr('الفرق الهندسية (P08)', 'Engineering Teams (P08)'))}</span></a>
      </div>
    </div>

    <div class="stats-grid" style="margin-block-end:1.5rem;">
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(tr('إجمالي المهام المسندة', 'Total Assigned Tasks'))}</div>
        <div class="stat-value">${Number(stats.total_assigned_tasks || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(tr('في الانتظار (Pending)', 'Pending (To Do)'))}</div>
        <div class="stat-value">${Number(stats.pending_tasks || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(tr('قيد التنفيذ (In Progress)', 'In Progress'))}</div>
        <div class="stat-value">${Number(stats.in_progress_tasks || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(tr('قيد المراجعة (In Review)', 'In Review'))}</div>
        <div class="stat-value">${Number(stats.review_tasks || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(tr('مكتملة (Completed)', 'Completed (Done)'))}</div>
        <div class="stat-value">${Number(stats.completed_tasks || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(tr('متأخرة (Overdue)', 'Overdue Tasks'))}</div>
        <div class="stat-value" style="color:var(--status-danger-fg);">${Number(stats.overdue_tasks || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(tr('الفرق النشطة', 'Active Teams'))}</div>
        <div class="stat-value">${Number(stats.active_teams_count || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(tr('المشاريع النشطة', 'Active Projects'))}</div>
        <div class="stat-value">${Number(stats.active_projects_count || 0)}</div>
      </div>
    </div>

    <div class="split-grid">
      <div class="card">
        <div class="card-header">
          <h3>${escapeHtml(tr('أولويات مهامي المسندة (E34 — مرتبة حسب الأولوية)', 'My Priority Assigned Tasks (E34 — Priority Ordered)'))}</h3>
          <a href="#/app/my-tasks" class="btn btn-sm btn-outline"><span>${escapeHtml(tr('الكل', 'All'))}</span> ${renderIcon('arrow-right', { size: 14 })}</a>
        </div>
        ${
          myTasksPage.items.length === 0
            ? ui.renderEmptyState(tr('لا توجد مهام مسندة إليك حالياً', 'No tasks currently assigned to you'))
            : `<div class="table-scroll-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>${escapeHtml(tr('المهمة', 'Task'))}</th>
                      <th>${escapeHtml(tr('الأولوية', 'Priority'))}</th>
                      <th>${escapeHtml(tr('الحالة', 'Status'))}</th>
                      <th>${escapeHtml(tr('إجراء', 'Action'))}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${myTasksPage.items
                      .map(
                        (task) => `
                      <tr>
                        <td>
                          <strong>${escapeHtml(task.title)}</strong>
                          <div class="field-hint">${escapeHtml(tr('مشروع', 'Project'))} #${task.project_id}</div>
                        </td>
                        <td>${ui.renderBadge('TaskPriority', task.priority)}</td>
                        <td>${ui.renderBadge('TaskStatus', task.status)}</td>
                        <td>
                          <button type="button" class="btn btn-sm btn-outline" data-open-task="${task.id}">${renderIcon('eye', { size: 14 })} <span>${escapeHtml(tr('فتح (E35)', 'Inspect (E35)'))}</span></button>
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
          <h3>${escapeHtml(tr(`عضوياتي في الفرق (${memberships.length}) والمشاريع (${projectsPage.total})`, `My Teams (${memberships.length}) & Projects (${projectsPage.total})`))}</h3>
          <a href="#/app/projects" class="btn btn-sm btn-outline"><span>${escapeHtml(tr('المشاريع', 'Projects'))}</span> ${renderIcon('arrow-right', { size: 14 })}</a>
        </div>
        ${
          teamsPage.items.length === 0
            ? ui.renderEmptyState(
                tr('لست عضواً في أي فريق بعد', 'Not a member of any team yet'),
                tr('يمكن لأي مطور إنشاء فريق جديد ليصبح قائداً له.', 'Any developer can create a new team and become its Team Admin.'),
                `<a href="#/app/teams" class="btn btn-sm btn-primary">${renderIcon('plus', { size: 14 })} <span>${escapeHtml(tr('إنشاء فريق جديد', 'Create New Team'))}</span></a>`
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
                      <a href="#/app/teams/${team.id}" class="btn btn-sm btn-outline"><span>${escapeHtml(tr('فتح الفريق', 'Open Team'))}</span> ${renderIcon('arrow-right', { size: 14 })}</a>
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
    container.innerHTML = ui.renderLoadingSkeleton(
      tr('جاري تحميل مهامك المسندة عبر المشاريع (E34)...', 'Loading your assigned tasks across projects (E34)...')
    );
    const pageModel = await tasksService.listMyTasks({ offset, limit }, scope.signal);
    if (isStale()) return;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${escapeHtml(tr('مهامي المسندة عبر المشاريع (P12)', 'My Assigned Tasks Across Projects (P12)'))}</h1>
          <p>${escapeHtml(tr('مرتبة دلالياً من الخادم حسب الأولوية (Critical → High → Medium → Low).', 'Semantically ordered by the server according to priority (Critical → High → Medium → Low).'))}</p>
        </div>
        <div class="page-header-actions">
          <form id="direct-comment-delete-form" class="page-header-actions">
            <input name="comment_id" type="number" min="1" class="form-control" style="inline-size:12rem;" placeholder="${escapeHtml(tr('معرف تعليق لحذفه (E41)', 'Comment ID to delete (E41)'))}" required />
            <button type="submit" class="btn btn-sm btn-danger">${renderIcon('trash-2', { size: 14 })} <span>${escapeHtml(tr('حذف تعليق بالمعرف (E41)', 'Delete Comment by ID (E41)'))}</span></button>
          </form>
        </div>
      </div>

      ${
        pageModel.items.length === 0
          ? ui.renderEmptyState(tr('لا توجد مهام مسندة إليك حالياً', 'No tasks currently assigned to you'))
          : `<div class="table-scroll-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>${escapeHtml(tr('العنوان', 'Title'))}</th>
                    <th>${escapeHtml(tr('المشروع', 'Project'))}</th>
                    <th>${escapeHtml(tr('الأولوية', 'Priority'))}</th>
                    <th>${escapeHtml(tr('الحالة', 'Status'))}</th>
                    <th>${escapeHtml(tr('الموعد النهائي', 'Deadline'))}</th>
                    <th>${escapeHtml(tr('التعليقات', 'Comments'))}</th>
                    <th>${escapeHtml(tr('إجراءات', 'Actions'))}</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageModel.items
                    .map(
                      (task) => `
                    <tr>
                      <td class="mono">#${task.id}</td>
                      <td><strong>${escapeHtml(task.title)}</strong></td>
                      <td><a href="#/app/projects/${task.project_id}" class="badge badge-brand">${escapeHtml(tr('مشروع', 'Project'))} #${task.project_id}</a></td>
                      <td>${ui.renderBadge('TaskPriority', task.priority)}</td>
                      <td>${ui.renderBadge('TaskStatus', task.status)}</td>
                      <td>${ui.formatDateTime(task.deadline)}</td>
                      <td><span class="badge">${renderIcon('message-square', { size: 13 })} ${Number(task.comments_count || 0)}</span></td>
                      <td>
                        <div class="page-header-actions">
                          <button type="button" class="btn btn-sm btn-primary" data-inspect-task="${task.id}">${renderIcon('eye', { size: 14 })} <span>${escapeHtml(tr('التفاصيل والتعليقات (E35)', 'Details & Comments (E35)'))}</span></button>
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
          ui.toast(
            tr(`تم حذف التعليق #${cid} بنجاح (E41).`, `Comment #${cid} deleted successfully (E41).`),
            'success'
          );
          directDelForm.reset();
          loadTasks();
        } catch (err) {
          ui.toast(err.message || tr('تعذر حذف التعليق.', 'Failed to delete comment.'), 'error');
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
  container.innerHTML = ui.renderLoadingSkeleton(
    tr('جاري تحميل بيانات الحساب والأمان (E10 & E08)...', 'Loading account profile and security context (E10 & E08)...')
  );

  const [profile, meContext] = await Promise.all([
    usersService.getProfile(scope.signal),
    authService.getMe(scope.signal),
  ]);
  if (isStale()) return;

  container.innerHTML = `
    <div class="page-header">
      <div class="avatar-row">
        ${renderAvatar(profile, { size: 'xl' })}
        <div class="avatar-meta">
          <h1>${escapeHtml(tr('إعدادات الحساب والأمان (P13)', 'Account & Security Settings (P13)'))}</h1>
          <p>${escapeHtml(tr('تحديث الملف الشخصي (E12)، تغيير كلمة المرور (E14)، إدارة الجلسات (E06/E07)، أو تعطيل الحساب (E11).', 'Update profile (E12), change password (E14), manage sessions (E06/E07), or deactivate account (E11).'))}</p>
        </div>
      </div>
      <div class="page-header-actions">
        ${ui.renderBadge('UserStatus', profile.status)}
        <span class="badge mono">${renderIcon('shield-check', { size: 13 })} Security Version: v${Number(profile.security_version || 1)}</span>
      </div>
    </div>

    <div class="split-grid">
      <!-- E12: PATCH /api/v1/users/me (9 fields in UpdateSchemaRequest) -->
      <form id="account-profile-form" class="card" novalidate>
        <h3>${escapeHtml(tr('تحديث الملف الشخصي (E12 — UpdateSchemaRequest)', 'Update Profile (E12 — UpdateSchemaRequest)'))}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="prof-name">${escapeHtml(tr('الاسم الكامل (name) *', 'Full Name (name) *'))}</label>
            <input id="prof-name" name="name" type="text" class="form-control" required minlength="1" maxlength="100" value="${escapeHtml(profile.name)}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-status">${escapeHtml(tr('حالة التواجد (status) *', 'Availability Status (status) *'))}</label>
            <select id="prof-status" name="status" class="form-control" required>
              ${renderEnumSelect(UserStatus, 'UserStatus', profile.status)}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-job-title">${escapeHtml(tr('المسمى الوظيفي (job_title)', 'Job Title (job_title)'))}</label>
            <select id="prof-job-title" name="job_title" class="form-control">
              ${renderEnumSelect(JobTitle, 'JobTitle', profile.job_title || '', tr('— غير محدد (null) —', '— Unspecified (null) —'))}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-avatar-url">${escapeHtml(tr('رابط الصورة الرمزية (avatar_url)', 'Avatar Image URL (avatar_url)'))}</label>
            <input id="prof-avatar-url" name="avatar_url" type="url" class="form-control" value="${escapeHtml(profile.avatar_url || '')}" placeholder="https://..." />
            <div class="avatar-preview-box">
              <span id="prof-avatar-preview"></span>
              <span class="field-hint">${escapeHtml(t('common.avatarPreviewHint'))}</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-github-url">${escapeHtml(tr('رابط GitHub (github_url)', 'GitHub URL (github_url)'))}</label>
            <input id="prof-github-url" name="github_url" type="url" class="form-control" value="${escapeHtml(profile.github_url || '')}" placeholder="https://github.com/..." />
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-linkedin-url">${escapeHtml(tr('رابط LinkedIn (linkedin_url)', 'LinkedIn URL (linkedin_url)'))}</label>
            <input id="prof-linkedin-url" name="linkedin_url" type="url" class="form-control" value="${escapeHtml(profile.linkedin_url || '')}" placeholder="https://linkedin.com/in/..." />
          </div>
          <div class="form-group">
            <label class="form-label" for="prof-website-url">${escapeHtml(tr('رابط الموقع الشخصي / المعرض (website_url)', 'Website / Portfolio URL (website_url)'))}</label>
            <input id="prof-website-url" name="website_url" type="url" class="form-control" value="${escapeHtml(profile.website_url || '')}" placeholder="https://..." />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="prof-bio">${escapeHtml(tr('النبذة التعريفية (bio)', 'Professional Bio (bio)'))}</label>
          <textarea id="prof-bio" name="bio" rows="3" class="form-control" maxlength="500">${escapeHtml(profile.bio || '')}</textarea>
        </div>

        <div class="form-group">
          <label class="checkbox-row">
            <input type="checkbox" name="is_public_member" ${profile.is_public_member ? 'checked' : ''} />
            <span>${escapeHtml(tr('إظهار ملفي الشخصي في دليل الكفاءات العام للزوار (is_public_member)', 'Display my profile in the public engineering roster (is_public_member)'))}</span>
          </label>
        </div>

        <div class="card-footer">
          <span class="field-hint">${escapeHtml(tr('تُرسل فقط الحقول المعدلة عبر buildPatchPayload.', 'Only modified fields are sent via buildPatchPayload.'))}</span>
          <button type="submit" id="save-profile-btn" class="btn btn-primary">${renderIcon('check', { size: 15 })} <span>${escapeHtml(tr('حفظ التغييرات (E12)', 'Save Changes (E12)'))}</span></button>
        </div>
      </form>

      <div class="form-group" style="gap:1.25rem;">
        <!-- E14: PATCH /api/v1/users/me/password (ChangePasswordRequest) -->
        <form id="account-password-form" class="card" novalidate>
          <h3>${escapeHtml(tr('تغيير كلمة المرور (E14 — ChangePasswordRequest)', 'Change Password (E14 — ChangePasswordRequest)'))}</h3>
          <p class="field-hint">${escapeHtml(tr('تنبيه أمني: تغيير كلمة المرور يرفع رقم إصدار الأمان (security_version) ويُبطل كافة الجلسات الحالية فوراً.', 'Security Notice: Changing password increments security_version and immediately revokes all active sessions.'))}</p>
          <div class="form-group">
            <label class="form-label" for="pw-old">${escapeHtml(tr('كلمة المرور الحالية (old_password) *', 'Current Password (old_password) *'))}</label>
            <input id="pw-old" name="old_password" type="password" class="form-control" required minlength="8" maxlength="128" />
          </div>
          <div class="form-group">
            <label class="form-label" for="pw-new">${escapeHtml(tr('كلمة المرور الجديدة (new_password) *', 'New Password (new_password) *'))}</label>
            <input id="pw-new" name="new_password" type="password" class="form-control" required minlength="8" maxlength="100" />
          </div>
          <div class="card-footer">
            <button type="submit" id="change-pw-btn" class="btn btn-primary">${renderIcon('key', { size: 15 })} <span>${escapeHtml(tr('تحديث كلمة المرور وإعادة الدخول (E14)', 'Update Password & Re-authenticate (E14)'))}</span></button>
          </div>
        </form>

        <!-- E06, E07 & E11 Session & Account Lifecycle Controls -->
        <div class="card">
          <h3>${escapeHtml(tr('إدارة الجلسات النشطة ومنطقة الخطر', 'Active Session Management & Danger Zone'))}</h3>
          <p class="field-hint">${escapeHtml(tr('عدد عضويات الفرق النشطة في الجلسة (E08):', 'Active team memberships in session (E08):'))} <strong>${(meContext?.memberships || []).length}</strong></p>
          <div class="page-header-actions">
            <button type="button" id="acc-logout-btn" class="btn btn-outline">${renderIcon('log-out', { size: 15 })} <span>${escapeHtml(tr('تسجيل الخروج من هذا المتصفح (E06)', 'Logout Current Browser (E06)'))}</span></button>
            <button type="button" id="acc-logout-all-btn" class="btn btn-warning">${renderIcon('shield-alert', { size: 15 })} <span>${escapeHtml(tr('إنهاء كافة الجلسات على جميع الأجهزة (E07)', 'Revoke All Sessions Across Devices (E07)'))}</span></button>
          </div>
          <div class="card-footer">
            <div>
              <strong style="color:var(--status-danger-fg);">${escapeHtml(tr('تعطيل الحساب الذاتي (E11 — DELETE /api/v1/users/me)', 'Self Account Deactivation (E11 — DELETE /api/v1/users/me)'))}</strong>
              <p class="field-hint">${escapeHtml(tr('يُعطل حسابك ويمنع الدخول مستقبلاً (محمي من تعطيل آخر Super Admin).', 'Deactivates your account and prevents future sign-in (protected against deactivating the last Super Admin).'))}</p>
            </div>
            <button type="button" id="acc-deactivate-self-btn" class="btn btn-danger">${renderIcon('trash-2', { size: 15 })} <span>${escapeHtml(tr('تعطيل حسابي نهائياً (E11)', 'Deactivate My Account (E11)'))}</span></button>
          </div>
        </div>
      </div>
    </div>
  `;

  const profileForm = container.querySelector('#account-profile-form');
  bindLiveAvatarPreview({
    inputEl: profileForm.querySelector('#prof-avatar-url'),
    nameInputEl: profileForm.querySelector('#prof-name'),
    previewContainerEl: profileForm.querySelector('#prof-avatar-preview'),
    fallbackName: profile.name || profile.username || 'TM',
  });

  // E12 Handler
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
      ui.toast(tr('تم تحديث الملف الشخصي بنجاح (E12).', 'Profile updated successfully (E12).'), 'success');
      await mountAccountPage({ container, scope, router, isStale });
    } catch (err) {
      ui.applyFieldErrors(profileForm, err.fieldErrors);
      ui.toast(err.message || tr('تعذر تحديث الملف الشخصي.', 'Failed to update profile.'), 'error');
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
      ui.toast(
        tr('تم تغيير كلمة المرور وإبطال الجلسات السابقة. يرجى تسجيل الدخول مجدداً.', 'Password changed and previous sessions revoked. Please sign in again.'),
        'success'
      );
      router.navigate('#/login');
    } catch (err) {
      ui.applyFieldErrors(pwForm, err.fieldErrors);
      ui.toast(err.message || tr('تعذر تغيير كلمة المرور.', 'Failed to change password.'), 'error');
      btn.disabled = false;
    }
  });

  // E06 Handler
  container.querySelector('#acc-logout-btn').addEventListener('click', async () => {
    await authService.logout();
    ui.toast(t('errors.logoutSuccess'), 'info');
    router.navigate('#/login');
  });

  // E07 Handler
  container.querySelector('#acc-logout-all-btn').addEventListener('click', async () => {
    await authService.logoutAll();
    ui.toast(
      tr('تم إبطال جميع الجلسات النشطة على كافة الأجهزة (E07).', 'All active sessions across all devices have been revoked (E07).'),
      'warning'
    );
    router.navigate('#/login');
  });

  // E11 Handler
  container.querySelector('#acc-deactivate-self-btn').addEventListener('click', () => {
    ui.openModal({
      title: tr('تأكيد تعطيل الحساب الذاتي (E11)', 'Confirm Self Account Deactivation (E11)'),
      bodyHtml: `
        <div class="alert-banner alert-danger">
          <span>${escapeHtml(tr('هل أنت متأكد من رغبتك في تعطيل حسابك الشخصي؟ سيتم إنهاء جلستك فوراً ولن تتمكن من الدخول مرة أخرى.', 'Are you sure you want to deactivate your personal account? Your session will end immediately and you will not be able to sign in again.'))}</span>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-outline" data-close-modal="true">${escapeHtml(t('common.cancel'))}</button>
        <button type="button" id="confirm-self-deactivate-btn" class="btn btn-danger">${renderIcon('trash-2', { size: 14 })} <span>${escapeHtml(tr('تأكيد تعطيل الحساب (E11)', 'Confirm Account Deactivation (E11)'))}</span></button>
      `,
      onMount: (dialog) => {
        const confirmBtn = dialog.querySelector('#confirm-self-deactivate-btn');
        confirmBtn.addEventListener('click', async () => {
          confirmBtn.disabled = true;
          try {
            await usersService.deactivateSelf();
            ui.closeModal();
            ui.toast(
              tr('تم تعطيل حسابك وإنهاء الجلسة بنجاح (E11).', 'Account deactivated and session terminated (E11).'),
              'warning'
            );
            router.navigate('#/login');
          } catch (err) {
            ui.toast(
              err.message || tr('تعذر تعطيل الحساب (قد تكون آخر Super Admin نشط).', 'Failed to deactivate account (you may be the last active Super Admin).'),
              'error'
            );
            confirmBtn.disabled = false;
          }
        });
      },
    });
  });
}
