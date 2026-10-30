/**
 * @fileoverview Central API Client and Network Bridge
 * Enterprise API client supporting Bearer token authorization,
 * standard ErrorResponse extraction, and automatic DataEnvelope unwrapping.
 */

const API_BASE = '/api/v1';

let refreshPromise = null;

async function performSilentRefresh() {
    if (refreshPromise) {
        return refreshPromise;
    }
    refreshPromise = (async () => {
        try {
            const storedRefresh = localStorage.getItem('refresh_token');
            const refreshPayload = storedRefresh ? JSON.stringify({ refresh_token: storedRefresh }) : undefined;
            const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: refreshPayload,
                credentials: 'same-origin',
            });

            if (refreshRes.ok) {
                const refreshJson = await refreshRes.json();
                const tokenData = refreshJson.data || refreshJson;
                if (tokenData && tokenData.access_token) {
                    localStorage.setItem('access_token', tokenData.access_token);
                    if (tokenData.refresh_token) {
                        localStorage.setItem('refresh_token', tokenData.refresh_token);
                    }
                    return tokenData.access_token;
                }
            }
            throw new Error('Refresh token invalid or expired');
        } catch (err) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            throw err;
        } finally {
            refreshPromise = null;
        }
    })();
    return refreshPromise;
}

/**
 * Executes an HTTP request against the backend API with automatic retry and silent token refresh.
 * 
 * @param {string} endpoint - Relative API path (e.g., '/showcase/stats')
 * @param {RequestInit} [options={}] - Fetch configuration options
 * @returns {Promise<any>} The unwrapped response data
 */
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    const token = localStorage.getItem('access_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        // Intercept 401 Unauthorized for silent rotational refresh
        const isAuthRoute = endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh');
        if (response.status === 401 && !options._retry && !isAuthRoute) {
            options._retry = true;
            try {
                await performSilentRefresh();
                return await apiCall(endpoint, options);
            } catch (refreshErr) {
                console.warn('Silent token refresh failed:', refreshErr);
            }
        }

        const json = await response.json().catch(() => null);

        if (!response.ok) {
            let errorMsg = 'An unexpected error occurred';
            let errorCode = 'REQUEST_FAILED';

            if (json) {
                if (json.error) {
                    errorMsg = json.error.message || errorMsg;
                    errorCode = json.error.code || errorCode;
                    if (json.error.details && Array.isArray(json.error.details)) {
                        const detailStr = json.error.details.map(d => d.msg || JSON.stringify(d)).join('; ');
                        errorMsg = `${errorMsg}: ${detailStr}`;
                    }
                } else if (json.detail) {
                    if (Array.isArray(json.detail)) {
                        errorMsg = json.detail.map(d => d.msg || JSON.stringify(d)).join(', ');
                    } else {
                        errorMsg = json.detail;
                    }
                } else if (json.message) {
                    errorMsg = json.message;
                }
            }

            if (typeof showToast === 'function') {
                showToast(`[${errorCode}] ${errorMsg}`, 'error');
            }
            const err = new Error(errorMsg);
            err.code = errorCode;
            err.status = response.status;
            throw err;
        }

        // Automatic envelope unwrapping
        if (json && typeof json === 'object' && 'data' in json) {
            return json.data;
        }
        return json;
    } catch (err) {
        console.error(`[API Network Error] ${options.method || 'GET'} ${endpoint}:`, err);
        throw err;
    }
}

// -----------------------------------------------------------------------------
// Authentication Endpoints
// -----------------------------------------------------------------------------
async function apiLogin(email, password) {
    const payload = { email, password };
    const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    if (data && data.access_token) {
        localStorage.setItem('access_token', data.access_token);
        if (data.refresh_token) {
            localStorage.setItem('refresh_token', data.refresh_token);
        }
    }
    return data;
}

async function apiLogout() {
    try {
        await apiCall('/auth/logout', { method: 'POST' });
    } catch (e) {
        console.warn('Logout notification failed on backend, clearing client tokens.');
    } finally {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    }
}

async function apiGetCurrentUser() {
    return await apiCall('/auth/me');
}

// -----------------------------------------------------------------------------
// Public Showcase Endpoints
// -----------------------------------------------------------------------------
async function apiGetShowcaseStats() {
    return await apiCall('/public/overview');
}

async function apiGetShowcaseProjects(techSlug = null) {
    const query = techSlug ? `?technology=${encodeURIComponent(techSlug)}` : '';
    const res = await apiCall(`/public/projects${query}`);
    return res.items || res;
}

async function apiGetShowcaseTechnologies() {
    return await apiCall('/public/technologies');
}

async function apiGetShowcaseTeam() {
    const res = await apiCall('/public/members');
    return res.items || res;
}

async function apiSubmitInquiry(inquiryData) {
    return await apiCall('/public/inquiries', {
        method: 'POST',
        body: JSON.stringify(inquiryData)
    });
}

// -----------------------------------------------------------------------------
// Workspace Endpoints: Projects, Teams, Tasks, Comments, Developer Dashboard
// -----------------------------------------------------------------------------
async function apiGetMyTasks() {
    const res = await apiCall('/tasks/my?limit=100');
    return res.items || res;
}

async function apiGetDeveloperDashboard() {
    return await apiCall('/users/me/dashboard');
}
async function apiGetProjects() {
    const res = await apiCall('/projects?limit=100');
    return res.items || res;
}

async function apiGetTeams() {
    const res = await apiCall('/teams?limit=100');
    return res.items || res;
}

async function apiGetProjectTasks(projectId) {
    const res = await apiCall(`/projects/${projectId}/tasks?limit=100`);
    return res.items || res;
}

async function apiGetProjectKanban(projectId) {
    return await apiCall(`/projects/${projectId}/tasks/kanban`);
}

async function apiMoveTask(taskId, status, position) {
    return await apiCall(`/tasks/${taskId}/move`, {
        method: 'PATCH',
        body: JSON.stringify({ status, position })
    });
}

async function apiCreateTask(taskData) {
    return await apiCall(`/projects/${taskData.project_id}/tasks`, {
        method: 'POST',
        body: JSON.stringify(taskData)
    });
}

async function apiGetTaskDetails(taskId) {
    return await apiCall(`/tasks/${taskId}`);
}

async function apiGetTaskComments(taskId) {
    const task = await apiCall(`/tasks/${taskId}`);
    return task.comments || [];
}

async function apiCreateTaskComment(taskId, content) {
    return await apiCall(`/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content })
    });
}

async function apiDeleteTaskComment(commentId) {
    return await apiCall(`/tasks/comments/${commentId}`, {
        method: 'DELETE'
    });
}

async function apiGetInquiries() {
    const res = await apiCall('/inquiries?limit=50');
    return res.items || res;
}

async function apiUpdateInquiryStatus(inquiryId, status, adminNotes = null) {
    const body = { status };
    if (adminNotes !== null) {
        body.admin_notes = adminNotes;
    }
    return await apiCall(`/inquiries/${inquiryId}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
}
