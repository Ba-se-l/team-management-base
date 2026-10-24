/**
 * @fileoverview UI Controller & Helpers
 * Manages Toast notifications, Modal dialogs, and component rendering helpers.
 */

/**
 * Displays a non-blocking toast notification.
 * 
 * @param {string} message - Toast message text
 * @param {'success'|'error'|'info'} [type='success'] - Toast level
 */
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-icons-round';
    iconSpan.textContent = type === 'success' ? 'check_circle' : type === 'error' ? 'error_outline' : 'info';

    const textSpan = document.createElement('span');
    textSpan.textContent = message;

    toast.appendChild(iconSpan);
    toast.appendChild(textSpan);
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(60px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Opens a modal dialog by ID.
 * 
 * @param {string} modalId - Element ID of the modal overlay
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('open');
    }
}

/**
 * Closes a modal dialog by ID.
 * 
 * @param {string} modalId - Element ID of the modal overlay
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('open');
    }
}

/**
 * Formats an ISO datetime string into human readable format.
 * 
 * @param {string|null} isoStr - ISO 8601 string
 * @returns {string} Formatted date
 */
function formatDate(isoStr) {
    if (!isoStr) return 'N/A';
    try {
        const d = new Date(isoStr);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return isoStr;
    }
}

/**
 * Returns initials from a full name.
 * 
 * @param {string} name - Full user name
 * @returns {string} Uppercase initials (e.g. "JD")
 */
function getInitials(name) {
    if (!name) return '??';
    return name.split(' ')
        .map(n => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();
}
