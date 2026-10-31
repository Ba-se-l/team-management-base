// static/js/components/avatar.js — Safe Avatar Renderer with Instant Fallback & Live Preview

function escapeAttr(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isSafeHttpUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function extractInitials(user) {
  const source = String(
    user?.name ||
    user?.full_name ||
    user?.assignee_name ||
    user?.author_name ||
    user?.username ||
    user?.assignee_username ||
    user?.author_username ||
    user?.email ||
    'TM'
  ).trim();
  if (!source) return 'TM';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function renderAvatar(user = {}, { size = 'md', className = '' } = {}) {
  const initials = extractInitials(user);
  const rawUrl =
    user?.avatar_url || user?.assignee_avatar_url || user?.author_avatar_url || '';
  const hasValidUrl = isSafeHttpUrl(rawUrl);
  const label =
    user?.name ||
    user?.assignee_name ||
    user?.author_name ||
    user?.username ||
    user?.assignee_username ||
    user?.author_username ||
    'User';
  const sizeClass = `avatar-${size}`;

  return `<span class="avatar ${sizeClass} ${escapeAttr(className)}" title="${escapeAttr(label)}"><span class="avatar-fallback" aria-hidden="true">${escapeAttr(initials)}</span>${hasValidUrl
      ? `<img class="avatar-img" src="${escapeAttr(rawUrl.trim())}" alt="${escapeAttr(label)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-avatar-img="true" />`
      : ''
    }</span>`;
}

/**
 * Global capture-phase error listener for all <img data-avatar-img="true"> elements.
 * Immediately hides any broken image so the underlying .avatar-fallback initials remain clean.
 */
export function initGlobalAvatarFallbackHandler() {
  document.addEventListener(
    'error',
    (event) => {
      const target = event.target;
      if (target && target.tagName === 'IMG' && target.hasAttribute('data-avatar-img')) {
        target.classList.add('is-broken');
      }
    },
    true
  );
}

/**
 * Binds a live preview container to an avatar_url input field (used in P06, P13, P14).
 */
export function bindLiveAvatarPreview(arg1, previewContainerEl, getUserContext) {
  let inputEl = arg1;
  let nameInputEl = null;
  let containerEl = previewContainerEl;
  let resolveContext = getUserContext;

  if (arg1 && typeof arg1 === 'object' && !(arg1 instanceof HTMLElement) && 'inputEl' in arg1) {
    inputEl = arg1.inputEl;
    nameInputEl = arg1.nameInputEl || null;
    containerEl = arg1.previewContainerEl;
    const fallbackName = arg1.fallbackName || 'TM';
    resolveContext = () => ({
      name: nameInputEl?.value?.trim() || fallbackName,
    });
  }

  if (!inputEl || !containerEl) return;

  const updatePreview = () => {
    const baseUser = typeof resolveContext === 'function' ? resolveContext() : {};
    const nextUrl = inputEl.value.trim();
    containerEl.innerHTML = renderAvatar(
      { ...baseUser, avatar_url: nextUrl },
      { size: 'lg' }
    );
  };

  inputEl.addEventListener('input', updatePreview);
  if (nameInputEl) {
    nameInputEl.addEventListener('input', updatePreview);
  }
  updatePreview();
}

