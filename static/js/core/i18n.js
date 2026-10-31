// static/js/core/i18n.js — Instant Bilingual Engine (AR/EN) & RTL/LTR Controller
import { AR_LOCALE } from '../contracts/locales/ar.js';
import { EN_LOCALE } from '../contracts/locales/en.js';

const STORAGE_KEY = 'app_lang';
const SUPPORTED_LANGS = new Set(['ar', 'en']);
const DICTIONARIES = Object.freeze({
  ar: AR_LOCALE,
  en: EN_LOCALE,
});

let currentLang = detectInitialLanguage();
const langListeners = new Set();

function detectInitialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGS.has(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'ar';
}

function resolvePath(obj, dotPath) {
  if (!obj || !dotPath) return undefined;
  return String(dotPath)
    .split('.')
    .reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

export function getLanguage() {
  return currentLang;
}

export function isRtl() {
  return currentLang === 'ar';
}

export function t(key, params = {}) {
  const dict = DICTIONARIES[currentLang] || DICTIONARIES.ar;
  const fallbackDict = DICTIONARIES.en;
  let template = resolvePath(dict, key);
  if (template === undefined) {
    template = resolvePath(fallbackDict, key);
  }
  if (template === undefined) {
    return String(key);
  }
  return String(template).replace(/\{(\w+)\}/g, (_, token) =>
    params[token] !== undefined && params[token] !== null ? String(params[token]) : `{${token}}`
  );
}

/**
 * Inline bilingual selector for rich templates while preserving 100% instant AR/EN switching.
 */
export function tr(arText, enText, params = {}) {
  const raw = currentLang === 'en' ? enText : arText;
  return String(raw).replace(/\{(\w+)\}/g, (_, token) =>
    params[token] !== undefined && params[token] !== null ? String(params[token]) : `{${token}}`
  );
}

/**
 * Translates an Enum display label while keeping its programmatic value untouched.
 */
export function tEnum(groupName, rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') return '—';
  const key = `enums.${groupName}.${String(rawValue)}`;
  const translated = t(key);
  return translated === key ? String(rawValue) : translated;
}

export function formatLocalizedDateTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return String(isoString);
  const localeCode = currentLang === 'ar' ? 'ar-EG' : 'en-US';
  return new Intl.DateTimeFormat(localeCode, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function applyDomTranslations(root = document) {
  if (!root) return;

  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });

  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.setAttribute('placeholder', t(key));
  });

  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.setAttribute('title', t(key));
  });

  root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key) el.setAttribute('aria-label', t(key));
  });
}

export function syncDocumentDirection() {
  const dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = currentLang;
  document.documentElement.dir = dir;
  document.title = t('app.documentTitle');
  applyDomTranslations(document);
}

function captureActiveFormState(container) {
  if (!container) return null;
  const snapshot = [];
  container.querySelectorAll('input, textarea, select').forEach((input) => {
    const key = input.id || input.name;
    if (!key) return;
    snapshot.push({
      id: input.id || null,
      name: input.name || null,
      type: input.type,
      value: input.value,
      checked: input.checked,
    });
  });
  return snapshot;
}

function restoreActiveFormState(container, snapshot) {
  if (!container || !Array.isArray(snapshot)) return;
  for (const item of snapshot) {
    const selector = item.id ? `#${item.id}` : `[name="${item.name}"]`;
    let el = null;
    try {
      el = container.querySelector(selector);
    } catch {
      el = null;
    }
    if (!el) continue;
    if (item.type === 'checkbox' || item.type === 'radio') {
      el.checked = Boolean(item.checked);
    } else {
      el.value = item.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

export function setLanguage(nextLang) {
  const normalized = SUPPORTED_LANGS.has(nextLang) ? nextLang : 'ar';
  currentLang = normalized;
  try {
    localStorage.setItem(STORAGE_KEY, currentLang);
  } catch {
    // Ignore storage errors
  }

  const pubRoot = document.getElementById('public-view-root');
  const wsRoot = document.getElementById('workspace-view-root');
  const pubSnapshot = captureActiveFormState(pubRoot);
  const wsSnapshot = captureActiveFormState(wsRoot);

  syncDocumentDirection();

  for (const listener of langListeners) {
    try {
      listener(currentLang, () => {
        restoreActiveFormState(pubRoot, pubSnapshot);
        restoreActiveFormState(wsRoot, wsSnapshot);
      });
    } catch (err) {
      console.error('Language listener error:', err);
    }
  }
}

export function toggleLanguage() {
  setLanguage(currentLang === 'ar' ? 'en' : 'ar');
}

export function onLanguageChange(listener) {
  langListeners.add(listener);
  return () => langListeners.delete(listener);
}

export const i18n = {
  getLanguage,
  isRtl,
  t,
  tr,
  tEnum,
  formatLocalizedDateTime,
  applyDomTranslations,
  syncDocumentDirection,
  setLanguage,
  toggleLanguage,
  onLanguageChange,
};

