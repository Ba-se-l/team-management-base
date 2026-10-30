/**
 * @fileoverview DevStation Main Application Controller
 * Orchestrates Dual-Mode experience (Public Showcase Portal + Developer Workspace),
 * Kanban drag-and-drop state, Sprint Task lifecycle, and Inquiries Triage.
 */

// Application State
const state = {
    currentMode: 'showcase',
    currentUser: null,
    projects: [],
    activeProjectId: null,
    kanbanTasks: [],
    currentDetailTask: null,
    activeTechFilter: ''
};

// -----------------------------------------------------------------------------
// Boot & Initialization
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    setupModeNavigation();
    setupAuthListeners();
    setupInquiryForm();
    setupWorkspaceNavigation();
    setupKanbanListeners();
    setupModals();

    // Check existing authentication
    await checkInitialAuth();

    // Initial load: Public Showcase
    await loadShowcaseData();
});

// -----------------------------------------------------------------------------
// Dual-Mode Switching
// -----------------------------------------------------------------------------
function setupModeNavigation() {
    const btnShowcase = document.getElementById('btn-mode-showcase');
    const btnWorkspace = document.getElementById('btn-mode-workspace');
    const viewShowcase = document.getElementById('view-showcase');
    const viewWorkspace = document.getElementById('view-workspace');
    const heroWorkspaceBtn = document.getElementById('btn-hero-workspace');

    function switchMode(mode) {
        state.currentMode = mode;
        if (mode === 'showcase') {
            btnShowcase.classList.add('active');
            btnWorkspace.classList.remove('active');
            viewShowcase.style.display = 'block';
            viewWorkspace.style.display = 'none';
            loadShowcaseData();
        } else {
            btnWorkspace.classList.add('active');
            btnShowcase.classList.remove('active');
            viewShowcase.style.display = 'none';
            viewWorkspace.style.display = 'flex';
            loadWorkspaceProjects();
        }
    }

    btnShowcase.addEventListener('click', () => switchMode('showcase'));
    btnWorkspace.addEventListener('click', () => switchMode('workspace'));
    if (heroWorkspaceBtn) {
        heroWorkspaceBtn.addEventListener('click', () => switchMode('workspace'));
    }
}

// -----------------------------------------------------------------------------
// Authentication & Profiles
// -----------------------------------------------------------------------------
function unwrapCurrentUser(meData) {
    if (!meData) return null;
    if (meData.user) {
        return { ...meData.user, memberships: meData.memberships || [] };
    }
    return meData;
}

async function checkInitialAuth() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        updateAuthDisplay(null);
        return;
    }

    try {
        const meData = await apiGetCurrentUser();
        const user = unwrapCurrentUser(meData);
        state.currentUser = user;
        updateAuthDisplay(user);
    } catch {
        localStorage.removeItem('access_token');
        updateAuthDisplay(null);
    }
}

function updateAuthDisplay(user) {
    const userDisplay = document.getElementById('user-display-name');
    const userDot = document.getElementById('user-status-dot');
    const authBtnLabel = document.getElementById('auth-btn-label');
    const btnLogout = document.getElementById('btn-logout');

    if (user) {
        userDisplay.textContent = `${user.name || user.full_name || user.username || user.email}`;
        userDot.style.background = 'var(--accent-emerald)';
        userDot.style.boxShadow = '0 0 8px var(--accent-emerald)';
        authBtnLabel.textContent = 'Account';
        btnLogout.style.display = 'inline-flex';
    } else {
        userDisplay.textContent = 'Guest Visitor';
        userDot.style.background = 'var(--text-muted)';
        userDot.style.boxShadow = 'none';
        authBtnLabel.textContent = 'Sign In';
        btnLogout.style.display = 'none';
    }
}

function clearWorkspaceStateAndDOM() {
    state.projects = [];
    state.activeProjectId = null;
    state.kanbanTasks = [];
    state.currentDetailTask = null;
    clearKanbanColumns();
    const selector = document.getElementById('select-kanban-project');
    if (selector) selector.innerHTML = '<option value="">Sign in to view projects</option>';
    const wsProjects = document.getElementById('ws-projects-grid');
    if (wsProjects) wsProjects.innerHTML = '<div style="color: var(--text-muted);">Please sign in to view internal projects.</div>';
    const wsTeams = document.getElementById('ws-teams-container');
    if (wsTeams) wsTeams.innerHTML = '<div style="color: var(--text-muted);">Please sign in to view engineering teams.</div>';
    const wsInq = document.getElementById('inquiries-table-container');
    if (wsInq) wsInq.innerHTML = '<div style="color: var(--text-muted);">Please sign in as Super Admin to view inquiries.</div>';
}

function setupAuthListeners() {
    const btnOpenAuth = document.getElementById('btn-open-auth');
    const btnLogout = document.getElementById('btn-logout');
    const formLogin = document.getElementById('form-auth-login');
    const btnQuickAdmin = document.getElementById('btn-quick-admin');
    const btnQuickDev = document.getElementById('btn-quick-dev');
    const demoContainer = document.getElementById('demo-profiles-container');

    if (demoContainer && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        demoContainer.style.display = 'block';
    }

    btnOpenAuth.addEventListener('click', () => {
        if (!state.currentUser) {
            openModal('modal-auth');
        } else {
            showToast(`Signed in as ${state.currentUser.email}`);
        }
    });

    btnLogout.addEventListener('click', async () => {
        await apiLogout();
        state.currentUser = null;
        updateAuthDisplay(null);
        clearWorkspaceStateAndDOM();
        showToast('Successfully logged out.');
        if (state.currentMode === 'workspace') {
            document.getElementById('btn-mode-showcase').click();
        }
    });

    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        try {
            await apiLogin(email, password);
            const meData = await apiGetCurrentUser();
            const user = unwrapCurrentUser(meData);
            state.currentUser = user;
            updateAuthDisplay(user);
            closeModal('modal-auth');
            showToast(`Welcome back, ${user.name || user.full_name || user.email}!`);
            if (state.currentMode === 'workspace') {
                loadWorkspaceProjects();
            }
        } catch (err) {
            // Error handled by apiCall toast
        }
    });

    // Quick Demo Logins (local development only)
    if (btnQuickAdmin) {
        btnQuickAdmin.addEventListener('click', async () => {
            try {
                await apiLogin('alex@agency.io', 'AgencyAdmin2026!');
                const meData = await apiGetCurrentUser();
                const user = unwrapCurrentUser(meData);
                state.currentUser = user;
                updateAuthDisplay(user);
                showToast('Authenticated as Tech Lead (Super Admin)');
                loadWorkspaceProjects();
            } catch (e) {
                showToast('Quick login failed: ' + e.message, 'error');
            }
        });
    }

    if (btnQuickDev) {
        btnQuickDev.addEventListener('click', async () => {
            try {
                await apiLogin('sarah@agency.io', 'DeveloperPass123!');
                const meData = await apiGetCurrentUser();
                const user = unwrapCurrentUser(meData);
                state.currentUser = user;
                updateAuthDisplay(user);
                showToast('Authenticated as Senior Dev (Team Admin)');
                loadWorkspaceProjects();
            } catch (e) {
                showToast('Quick login failed: ' + e.message, 'error');
            }
        });
    }
}

// -----------------------------------------------------------------------------
// Public Showcase Module
// -----------------------------------------------------------------------------
async function loadShowcaseData() {
    await Promise.all([
        loadStats(),
        loadTechnologies(),
        loadShowcaseProjects(),
        loadTeamRoster()
    ]);
}

async function loadStats() {
    try {
        const overview = await apiGetShowcaseStats();
        const stats = overview.metrics || overview;
        document.getElementById('stat-projects').textContent = stats.total_projects ?? stats.active_projects ?? 0;
        document.getElementById('stat-teams').textContent = stats.total_teams ?? 0;
        document.getElementById('stat-members').textContent = stats.total_public_members ?? stats.public_members ?? 0;
        document.getElementById('stat-tasks').textContent = (stats.featured_projects ? stats.featured_projects.length : (stats.open_tasks ?? 0));
        document.getElementById('stat-techs').textContent = (stats.technologies ? stats.technologies.length : (stats.technologies_count ?? 0));
    } catch (err) {
        console.error('Failed to load showcase stats', err);
    }
}

async function loadTechnologies() {
    try {
        const techs = await apiGetShowcaseTechnologies();
        const container = document.getElementById('tech-filter-bar');
        // Keep "All Technologies" button
        container.innerHTML = '<button type="button" class="btn btn-sm btn-primary filter-tech-btn active" data-slug="">All Technologies</button>';
        
        techs.forEach(tech => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-sm btn-secondary filter-tech-btn';
            btn.dataset.slug = tech.slug;
            btn.textContent = tech.name;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-tech-btn').forEach(b => {
                    b.classList.remove('btn-primary', 'active');
                    b.classList.add('btn-secondary');
                });
                btn.classList.add('btn-primary', 'active');
                btn.classList.remove('btn-secondary');
                state.activeTechFilter = tech.slug;
                loadShowcaseProjects(tech.slug);
            });
            container.appendChild(btn);
        });

        // Attach listener to All
        container.querySelector('[data-slug=""]').addEventListener('click', (e) => {
            document.querySelectorAll('.filter-tech-btn').forEach(b => {
                b.classList.remove('btn-primary', 'active');
                b.classList.add('btn-secondary');
            });
            e.target.classList.add('btn-primary', 'active');
            e.target.classList.remove('btn-secondary');
            state.activeTechFilter = '';
            loadShowcaseProjects('');
        });
    } catch (err) {
        console.error('Failed to load technologies', err);
    }
}

async function loadShowcaseProjects(techSlug = '') {
    try {
        const projects = await apiGetShowcaseProjects(techSlug || null);
        const grid = document.getElementById('showcase-projects-grid');
        grid.innerHTML = '';

        if (!projects || projects.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No public deployments found for this filter.</div>`;
            return;
        }

        projects.forEach(project => {
            const card = document.createElement('article');
            card.className = 'project-card';
            
            const techsHtml = (project.technologies || [])
                .map(t => `<span class="tech-tag">${escapeHtml(t.name)}</span>`)
                .join('');

            const statusUpper = (project.status || 'active').toUpperCase();
            const statusClass = statusUpper === 'ACTIVE' ? 'status-active' : statusUpper === 'PLANNING' ? 'status-planning' : 'status-completed';
            const projectName = project.title || project.name || 'Untitled System';
            const projectTeam = project.team_name || project.team?.name || 'Engineering Guild';
            const projectDesc = project.short_description || project.description || 'Production digital architecture.';

            card.innerHTML = `
                <div>
                    <div class="project-badge-row">
                        <span class="team-pill">${escapeHtml(projectTeam)}</span>
                        <span class="status-pill ${statusClass}">${escapeHtml(statusUpper)}</span>
                    </div>
                    <h3 class="project-title">${escapeHtml(projectName)}</h3>
                    <p class="project-desc">${escapeHtml(projectDesc)}</p>
                </div>
                <div>
                    <div class="tech-tag-row">${techsHtml}</div>
                    <div class="card-footer">
                        <span style="font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                            <span class="material-icons-round" style="font-size: 14px;">terminal</span> Production Ready
                        </span>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="switchAndOpenProject(${project.id})">
                            <span class="material-icons-round">open_in_new</span> Sprint Board
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        console.error('Failed to load showcase projects', err);
    }
}

async function loadTeamRoster() {
    try {
        const members = await apiGetShowcaseTeam();
        const grid = document.getElementById('showcase-team-grid');
        grid.innerHTML = '';

        if (!members || members.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No public engineering profiles available.</div>`;
            return;
        }

        members.forEach(member => {
            const card = document.createElement('div');
            card.className = 'member-card';
            const displayName = member.name || member.full_name || member.username;
            const initials = getInitials(displayName);
            const jobTitle = member.job_title || 'Staff Engineer';

            card.innerHTML = `
                <div class="member-avatar">${initials}</div>
                <h4 class="member-name">${escapeHtml(displayName)}</h4>
                <div class="member-role">${escapeHtml(jobTitle)}</div>
                <div class="member-socials">
                    <span class="social-link" title="Full Stack"><span class="material-icons-round" style="font-size: 16px;">code</span></span>
                    <span class="social-link" title="Architecture"><span class="material-icons-round" style="font-size: 16px;">storage</span></span>
                    <span class="social-link" title="DevOps"><span class="material-icons-round" style="font-size: 16px;">cloud</span></span>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        console.error('Failed to load team roster', err);
    }
}

function setupInquiryForm() {
    const form = document.getElementById('form-inquiry');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-inquiry');
        const origContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'Transmitting...';

        const payload = {
            name: document.getElementById('inq-name').value.trim(),
            email: document.getElementById('inq-email').value.trim(),
            company: document.getElementById('inq-company').value.trim() || null,
            budget: document.getElementById('inq-budget').value || null,
            message: document.getElementById('inq-message').value.trim(),
            // Bot honeypot field
            company_website: document.getElementById('honeypot-field').value.trim() || null
        };

        try {
            await apiSubmitInquiry(payload);
            showToast('Consultation request transmitted successfully! An architect will reach out within 24 hours.');
            form.reset();
        } catch (err) {
            // Handled by apiCall toast
        } finally {
            btn.disabled = false;
            btn.innerHTML = origContent;
        }
    });
}

// -----------------------------------------------------------------------------
// Workspace Navigation & Sub-views
// -----------------------------------------------------------------------------
function setupWorkspaceNavigation() {
    const navKanban = document.getElementById('ws-nav-kanban');
    const navProjects = document.getElementById('ws-nav-projects');
    const navTeams = document.getElementById('ws-nav-teams');
    const navInquiries = document.getElementById('ws-nav-inquiries');

    const subKanban = document.getElementById('ws-sub-kanban');
    const subProjects = document.getElementById('ws-sub-projects');
    const subTeams = document.getElementById('ws-sub-teams');
    const subInquiries = document.getElementById('ws-sub-inquiries');

    const buttons = [navKanban, navProjects, navTeams, navInquiries];
    const sections = [subKanban, subProjects, subTeams, subInquiries];

    function activateSection(targetBtn, targetSec) {
        buttons.forEach(b => b.classList.remove('active'));
        sections.forEach(s => s.style.display = 'none');
        targetBtn.classList.add('active');
        targetSec.style.display = 'block';
    }

    navKanban.addEventListener('click', () => {
        activateSection(navKanban, subKanban);
        if (state.activeProjectId) loadKanbanTasks(state.activeProjectId);
    });

    navProjects.addEventListener('click', () => {
        activateSection(navProjects, subProjects);
        renderWorkspaceProjectsView();
    });

    navTeams.addEventListener('click', () => {
        activateSection(navTeams, subTeams);
        renderWorkspaceTeamsView();
    });

    navInquiries.addEventListener('click', () => {
        activateSection(navInquiries, subInquiries);
        loadInquiriesTriage();
    });
}

// -----------------------------------------------------------------------------
// Workspace Projects & Kanban State
// -----------------------------------------------------------------------------
async function loadWorkspaceProjects() {
    try {
        const projects = await apiGetProjects();
        state.projects = projects || [];
        populateProjectSelector(state.projects);

        if (state.projects.length > 0) {
            const selectedId = state.activeProjectId || state.projects[0].id;
            state.activeProjectId = selectedId;
            document.getElementById('select-kanban-project').value = selectedId;
            await loadKanbanTasks(selectedId);
        } else {
            clearKanbanColumns();
        }
    } catch (err) {
        console.error('Failed to load workspace projects', err);
    }
}

function populateProjectSelector(projects) {
    const selector = document.getElementById('select-kanban-project');
    selector.innerHTML = '';

    if (projects.length === 0) {
        selector.innerHTML = '<option value="">No projects found</option>';
        return;
    }

    projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        const name = p.title || p.name || `Project #${p.id}`;
        const team = p.team_name || p.team?.name || 'General';
        opt.textContent = `${name} (${team})`;
        selector.appendChild(opt);
    });

    selector.addEventListener('change', (e) => {
        const newId = parseInt(e.target.value, 10);
        state.activeProjectId = newId;
        loadKanbanTasks(newId);
    });
}

function window_switchAndOpenProject(projectId) {
    document.getElementById('btn-mode-workspace').click();
    setTimeout(() => {
        const selector = document.getElementById('select-kanban-project');
        selector.value = projectId;
        state.activeProjectId = projectId;
        loadKanbanTasks(projectId);
    }, 100);
}
window.switchAndOpenProject = window_switchAndOpenProject;

async function loadKanbanTasks(projectId) {
    if (!projectId) return;
    try {
        const tasks = await apiGetProjectTasks(projectId);
        state.kanbanTasks = tasks || [];
        renderKanbanBoard(state.kanbanTasks);
    } catch (err) {
        console.error('Failed to load project tasks', err);
    }
}

function clearKanbanColumns() {
    ['todo', 'in-progress', 'in-review', 'done'].forEach(col => {
        const container = document.getElementById(`cards-container-${col}`);
        if (container) container.innerHTML = '';
        const count = document.getElementById(`count-${col}`);
        if (count) count.textContent = '0';
    });
}

function renderKanbanBoard(tasks) {
    clearKanbanColumns();

    const columnMap = {
        'todo': { container: document.getElementById('cards-container-todo'), count: document.getElementById('count-todo'), items: [] },
        'in_progress': { container: document.getElementById('cards-container-in-progress'), count: document.getElementById('count-in-progress'), items: [] },
        'in_review': { container: document.getElementById('cards-container-in-review'), count: document.getElementById('count-in-review'), items: [] },
        'done': { container: document.getElementById('cards-container-done'), count: document.getElementById('count-done'), items: [] }
    };

    tasks.forEach(task => {
        const status = (task.status || 'todo').toLowerCase();
        if (columnMap[status]) {
            columnMap[status].items.push(task);
        }
    });

    Object.keys(columnMap).forEach(status => {
        const { container, count, items } = columnMap[status];
        count.textContent = items.length;

        // Sort by position ascending
        items.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

        items.forEach(task => {
            const card = createKanbanCardElement(task);
            container.appendChild(card);
        });
    });
}

function createKanbanCardElement(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.taskId = task.id;
    card.dataset.status = (task.status || 'todo').toLowerCase();

    const priorityClass = `priority-${(task.priority || 'medium').toLowerCase()}`;
    const assigneeLabel = task.assignee_name || (task.assignee ? (task.assignee.name || task.assignee.full_name || task.assignee.email) : null) || 'Unassigned';

    card.innerHTML = `
        <div class="task-top-row">
            <span class="priority-chip ${priorityClass}">${escapeHtml((task.priority || 'medium').toUpperCase())}</span>
            <span style="font-size: 11px; color: var(--text-muted);">#${task.id}</span>
        </div>
        <div class="task-card-title">${escapeHtml(task.title)}</div>
        <div class="task-card-bottom">
            <span class="comments-indicator">
                <span class="material-icons-round" style="font-size: 14px;">chat_bubble_outline</span>
                <span>${task.comments ? task.comments.length : 0}</span>
            </span>
            <span>${escapeHtml(assigneeLabel)}</span>
        </div>
    `;

    // Native Drag and Drop Listeners
    card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', JSON.stringify({
            taskId: task.id,
            currentStatus: task.status
        }));
        e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
    });

    // Click to open details & comments modal
    card.addEventListener('click', (e) => {
        // Prevent trigger if clicking drag handle
        openTaskDetailsModal(task);
    });

    return card;
}

// -----------------------------------------------------------------------------
// Kanban Drag and Drop Columns
// -----------------------------------------------------------------------------
function setupKanbanListeners() {
    const columns = document.querySelectorAll('.kanban-column');

    columns.forEach(col => {
        col.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            col.classList.add('drag-over');
        });

        col.addEventListener('dragleave', () => {
            col.classList.remove('drag-over');
        });

        col.addEventListener('drop', async (e) => {
            e.preventDefault();
            col.classList.remove('drag-over');

            const targetStatus = (col.dataset.status || 'todo').toLowerCase();
            const dataRaw = e.dataTransfer.getData('text/plain');
            if (!dataRaw) return;

            try {
                const { taskId, currentStatus } = JSON.parse(dataRaw);
                if (targetStatus === (currentStatus || '').toLowerCase()) return;

                // Fire move API call
                await apiMoveTask(taskId, targetStatus, 0);
                showToast(`Task #${taskId} moved to ${targetStatus.toUpperCase()}`);

                // Reload active project tasks
                if (state.activeProjectId) {
                    await loadKanbanTasks(state.activeProjectId);
                }
            } catch (err) {
                console.error('Failed to move task', err);
            }
        });
    });

    document.getElementById('btn-refresh-kanban').addEventListener('click', () => {
        if (state.activeProjectId) {
            loadKanbanTasks(state.activeProjectId);
            showToast('Sprint board refreshed');
        }
    });

    document.getElementById('btn-open-create-task').addEventListener('click', () => {
        if (!state.currentUser) {
            showToast('Please sign in to create sprint tasks', 'error');
            openModal('modal-auth');
            return;
        }
        openModal('modal-create-task');
    });
}

// -----------------------------------------------------------------------------
// Modals & Task Lifecycle
// -----------------------------------------------------------------------------
function setupModals() {
    // Create Task Form
    const formCreateTask = document.getElementById('form-create-task');
    formCreateTask.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.activeProjectId) {
            showToast('No active project selected', 'error');
            return;
        }

        const title = document.getElementById('create-task-title').value.trim();
        const priority = document.getElementById('create-task-priority').value;
        const status = document.getElementById('create-task-status').value;
        const description = document.getElementById('create-task-desc').value.trim();

        try {
            await apiCreateTask({
                project_id: state.activeProjectId,
                title,
                priority,
                status,
                description: description || null
            });

            closeModal('modal-create-task');
            formCreateTask.reset();
            showToast('Sprint task created successfully!');
            await loadKanbanTasks(state.activeProjectId);
        } catch (err) {
            // Handled by apiCall toast
        }
    });

    // Add Comment Form
    const formAddComment = document.getElementById('form-add-comment');
    formAddComment.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.currentUser) {
            showToast('Please sign in to participate in discussion', 'error');
            openModal('modal-auth');
            return;
        }

        if (!state.currentDetailTask) return;

        const input = document.getElementById('input-new-comment');
        const content = input.value.trim();
        if (!content) return;

        try {
            await apiCreateTaskComment(state.currentDetailTask.id, content);
            input.value = '';
            await reloadTaskComments(state.currentDetailTask.id);
            // Refresh kanban card comment counts in background
            loadKanbanTasks(state.activeProjectId);
        } catch (err) {
            // Handled by apiCall toast
        }
    });
}

async function openTaskDetailsModal(task) {
    state.currentDetailTask = task;

    document.getElementById('detail-task-title').textContent = task.title;
    document.getElementById('detail-task-desc').textContent = task.description || 'No detailed specifications provided.';
    
    const priBadge = document.getElementById('detail-priority-badge');
    priBadge.className = `priority-chip priority-${(task.priority || 'medium').toLowerCase()}`;
    priBadge.textContent = (task.priority || 'medium').toUpperCase();

    const statBadge = document.getElementById('detail-status-badge');
    statBadge.textContent = (task.status || 'todo').toUpperCase();

    const assigneeLabel = task.assignee_name || (task.assignee ? (task.assignee.name || task.assignee.full_name || task.assignee.email) : null) || 'Unassigned';
    document.getElementById('detail-assignee').textContent = assigneeLabel;
    document.getElementById('detail-due-date').textContent = formatDate(task.deadline || task.due_date);

    openModal('modal-task-details');
    await reloadTaskComments(task.id);
}

async function reloadTaskComments(taskId) {
    const list = document.getElementById('task-comments-list');
    list.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;">Loading discussion activity...</div>';

    try {
        const comments = await apiGetTaskComments(taskId);
        list.innerHTML = '';

        if (!comments || comments.length === 0) {
            list.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; font-style: italic;">No comments posted yet. Start the discussion below.</div>';
            return;
        }

        comments.forEach(c => {
            const bubble = document.createElement('div');
            bubble.className = 'comment-bubble';

            const authorName = c.author_name || (c.author ? (c.author.name || c.author.full_name || c.author.email) : null) || 'Team Member';
            const isAuthor = state.currentUser && (c.author_id === state.currentUser.id || state.currentUser.is_super_admin);

            bubble.innerHTML = `
                <div class="comment-author-row">
                    <span class="comment-author-name">${escapeHtml(authorName)}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span>${formatDate(c.created_at)}</span>
                        ${isAuthor ? `<button type="button" style="background: none; border: none; color: var(--accent-rose); cursor: pointer; font-size: 11px;" onclick="handleDeleteComment(${c.id})"><span class="material-icons-round" style="font-size: 14px;">delete</span></button>` : ''}
                    </div>
                </div>
                <div class="comment-content">${escapeHtml(c.content)}</div>
            `;
            list.appendChild(bubble);
        });
    } catch (err) {
        list.innerHTML = '<div style="color: var(--accent-rose); font-size: 13px;">Failed to load comments.</div>';
    }
}

async function window_handleDeleteComment(commentId) {
    try {
        await apiDeleteTaskComment(commentId);
        showToast('Comment deleted');
        if (state.currentDetailTask) {
            await reloadTaskComments(state.currentDetailTask.id);
            loadKanbanTasks(state.activeProjectId);
        }
    } catch (err) {
        // Handled by apiCall
    }
}
window.handleDeleteComment = window_handleDeleteComment;

// -----------------------------------------------------------------------------
// Workspace Projects & Teams Sub-views
// -----------------------------------------------------------------------------
async function renderWorkspaceProjectsView() {
    const container = document.getElementById('ws-projects-grid');
    container.innerHTML = '<div style="color: var(--text-muted);">Loading internal projects...</div>';

    try {
        const projects = await apiGetProjects();
        container.innerHTML = '';

        if (!projects || projects.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted);">No projects registered.</div>';
            return;
        }

        projects.forEach(p => {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.innerHTML = `
                <div>
                    <div class="project-badge-row">
                        <span class="team-pill">${escapeHtml(p.team?.name || 'General')}</span>
                        <span class="status-pill status-active">${escapeHtml(p.status || 'ACTIVE')}</span>
                    </div>
                    <h3 class="project-title">${escapeHtml(p.title || p.name)}</h3>
                    <p class="project-desc">${escapeHtml(p.short_description || p.description || 'Enterprise project repository.')}</p>
                </div>
                <div class="card-footer">
                    <span style="font-size: 12px; color: var(--text-muted);">Slug: ${escapeHtml(p.slug || '')}</span>
                    <button type="button" class="btn btn-primary btn-sm" onclick="switchAndOpenProject(${p.id})">
                        Open Board
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        container.innerHTML = '<div style="color: var(--accent-rose);">Failed to load projects.</div>';
    }
}

async function renderWorkspaceTeamsView() {
    const container = document.getElementById('ws-teams-container');
    container.innerHTML = '<div style="color: var(--text-muted);">Loading engineering teams...</div>';

    try {
        const teams = await apiGetTeams();
        container.innerHTML = '';

        if (!teams || teams.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted);">No teams registered.</div>';
            return;
        }

        teams.forEach(t => {
            const card = document.createElement('div');
            card.className = 'inquiry-card';
            card.style.maxWidth = '100%';
            card.style.marginBottom = '20px';

            const membersHtml = (t.members || []).map(m => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-surface); border-radius: var(--radius-sm); margin-bottom: 6px;">
                    <div>
                        <strong>${escapeHtml(m.user?.full_name || m.user?.email || 'User')}</strong>
                        <span style="color: var(--text-muted); font-size: 12px; margin-left: 8px;">${escapeHtml(m.user?.email || '')}</span>
                    </div>
                    <span class="team-pill" style="text-transform: uppercase;">${escapeHtml(m.role || 'MEMBER')}</span>
                </div>
            `).join('');

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                        <h3 style="font-size: 20px;">${escapeHtml(t.name)}</h3>
                        <p style="color: var(--text-secondary); font-size: 13px;">${escapeHtml(t.description || 'Guild engineering squad')}</p>
                    </div>
                    <span class="status-pill status-active">ACTIVE GUILD</span>
                </div>
                <div style="margin-top: 12px;">
                    <h5 style="font-size: 13px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">Guild Roster (${(t.members || []).length})</h5>
                    ${membersHtml || '<div style="color: var(--text-muted); font-size: 13px;">No members assigned.</div>'}
                </div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        container.innerHTML = '<div style="color: var(--accent-rose);">Failed to load teams.</div>';
    }
}

// -----------------------------------------------------------------------------
// Inquiries Triage Sub-view
// -----------------------------------------------------------------------------
async function loadInquiriesTriage() {
    const container = document.getElementById('inquiries-table-container');
    container.innerHTML = '<div style="color: var(--text-muted);">Loading incoming inquiries...</div>';

    try {
        const inquiries = await apiGetInquiries();
        container.innerHTML = '';

        if (!inquiries || inquiries.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">No client inquiries pending triage.</div>';
            return;
        }

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontSize = '13px';

        table.innerHTML = `
            <thead>
                <tr style="border-bottom: 1px solid var(--border-subtle); color: var(--text-secondary); text-align: left;">
                    <th style="padding: 10px;">ID</th>
                    <th style="padding: 10px;">Client</th>
                    <th style="padding: 10px;">Email</th>
                    <th style="padding: 10px;">Company</th>
                    <th style="padding: 10px;">Budget</th>
                    <th style="padding: 10px;">Status</th>
                    <th style="padding: 10px;">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${inquiries.map(inq => `
                    <tr style="border-bottom: 1px solid var(--border-subtle);">
                        <td style="padding: 10px;">#${inq.id}</td>
                        <td style="padding: 10px; font-weight: 600;">${escapeHtml(inq.client_name || inq.name)}</td>
                        <td style="padding: 10px; color: var(--text-secondary);">${escapeHtml(inq.client_email || inq.email)}</td>
                        <td style="padding: 10px;">${escapeHtml(inq.company_name || inq.company || '-')}</td>
                        <td style="padding: 10px;">${escapeHtml(inq.budget_range || inq.budget || '-')}</td>
                        <td style="padding: 10px;">
                            <span class="status-pill ${inq.status === 'converted' || inq.status === 'responded' ? 'status-active' : inq.status === 'new' || inq.status === 'in_review' ? 'status-planning' : 'status-completed'}">${escapeHtml((inq.status || 'new').toUpperCase())}</span>
                        </td>
                        <td style="padding: 10px;">
                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                <button type="button" class="btn btn-secondary btn-sm" onclick="handleTriageStatus(${inq.id}, 'in_review')">Review</button>
                                <button type="button" class="btn btn-secondary btn-sm" onclick="handleTriageStatus(${inq.id}, 'responded')">Responded</button>
                                <button type="button" class="btn btn-secondary btn-sm" onclick="handleTriageStatus(${inq.id}, 'converted')">Convert</button>
                                <button type="button" class="btn btn-secondary btn-sm" onclick="handleTriageStatus(${inq.id}, 'closed')">Close</button>
                                <button type="button" class="btn btn-secondary btn-sm" onclick="handleTriageStatus(${inq.id}, 'spam')">Spam</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        container.appendChild(table);
    } catch (err) {
        container.innerHTML = '<div style="color: var(--accent-rose);">Admin privileges required to view inquiry leads. Please sign in as Tech Lead.</div>';
    }
}

async function window_handleTriageStatus(inquiryId, status) {
    try {
        await apiUpdateInquiryStatus(inquiryId, status);
        showToast(`Inquiry #${inquiryId} updated to ${status}`);
        loadInquiriesTriage();
    } catch (err) {
        // Handled by apiCall
    }
}
window.handleTriageStatus = window_handleTriageStatus;

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
