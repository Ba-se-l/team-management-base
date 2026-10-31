// static/js/core/http.js — Unified HTTP Client (ApiError, 204/200, Retry-After, X-Request-ID)
import { sessionManager } from './session.js';
import { store } from './store.js';

export class ApiError extends Error {
  constructor({ status, code, message, detail, fieldErrors, requestId, retryAfter, endpoint }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || `HTTP_${status}`;
    this.detail = detail;
    this.fieldErrors = fieldErrors || {};
    this.requestId = requestId || null;
    this.retryAfter = retryAfter || null;
    this.endpoint = endpoint || null;
  }
}

function parseErrorPayload(status, payload, headers, endpointCode) {
  const requestId = headers.get('X-Request-ID') || headers.get('x-request-id') || null;
  const retryAfterRaw = headers.get('Retry-After') || headers.get('retry-after');
  const retryAfter = retryAfterRaw ? Number(retryAfterRaw) || retryAfterRaw : null;

  const fieldErrors = {};
  let message = `فشل الطلب برمز حالة HTTP ${status}`;
  let errorCode = `HTTP_${status}`;

  if (status === 429) {
    errorCode = 'RATE_LIMIT_EXCEEDED';
    message = retryAfter
      ? `تم تجاوز حد الطلبات المسموح (429). يرجى الانتظار ${retryAfter} ثانية قبل إعادة المحاولة.`
      : 'تم تجاوز حد الطلبات المسموح (429 Too Many Requests).';
  } else if (payload && typeof payload === 'object') {
    if (payload.error && typeof payload.error === 'object') {
      errorCode = payload.error.code || errorCode;
      message = payload.error.message || message;
      if (Array.isArray(payload.error.details)) {
        for (const item of payload.error.details) {
          const loc = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : item.field || 'form';
          fieldErrors[String(loc)] = item.msg || item.message || 'قيمة غير صالحة';
        }
      }
    } else if (typeof payload.detail === 'string') {
      message = payload.detail;
    } else if (Array.isArray(payload.detail)) {
      message = 'يرجى مراجعة الحقول المدخلة وتصحيح الأخطاء الموضحة.';
      for (const item of payload.detail) {
        const loc = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : 'form';
        fieldErrors[String(loc)] = item.msg || 'قيمة غير صالحة';
      }
    } else if (typeof payload.message === 'string') {
      message = payload.message;
    }
  }

  return new ApiError({
    status,
    code: errorCode,
    message,
    detail: payload?.error ?? payload?.detail ?? payload,
    fieldErrors,
    requestId,
    retryAfter,
    endpoint: endpointCode,
  });
}

export async function apiRequest(endpointSpec, options = {}) {
  const {
    pathParams = {},
    query = null,
    body = undefined,
    signal = undefined,
    skipAuthRefresh = false,
  } = options;

  let resolvedPath = endpointSpec.path;
  for (const [key, val] of Object.entries(pathParams)) {
    resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(String(val)));
  }

  if (query && typeof query === 'object') {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, String(v));
      }
    }
    const qs = searchParams.toString();
    if (qs) {
      resolvedPath = `${resolvedPath}?${qs}`;
    }
  }

  const executeFetch = async (tokenOverride = null) => {
    const headers = new Headers({ Accept: 'application/json' });
    const activeToken = tokenOverride || sessionManager.getAccessToken();

    if (endpointSpec.auth !== 'public' && activeToken) {
      headers.set('Authorization', `Bearer ${activeToken}`);
    }

    let serializedBody = undefined;
    if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
      serializedBody = JSON.stringify(body);
    }

    const startTime = performance.now();
    const response = await fetch(resolvedPath, {
      method: endpointSpec.method,
      headers,
      body: serializedBody,
      credentials: endpointSpec.includeCredentials ? 'include' : 'same-origin',
      signal,
    });
    const durationMs = Math.round(performance.now() - startTime);

    store.recordDiagnosticTrace({
      code: endpointSpec.code,
      method: endpointSpec.method,
      path: resolvedPath,
      status: response.status,
      durationMs,
      requestId: response.headers.get('X-Request-ID') || null,
      timestamp: new Date().toISOString(),
    });

    return response;
  };

  const genBefore = sessionManager.getGeneration();
  let response = await executeFetch();

  if (
    response.status === 401 &&
    endpointSpec.auth !== 'public' &&
    !skipAuthRefresh &&
    endpointSpec.code !== 'E04' &&
    endpointSpec.code !== 'E05'
  ) {
    try {
      const refreshedToken = await sessionManager.refreshTokenSingleFlight(genBefore);
      response = await executeFetch(refreshedToken);
    } catch {
      window.location.hash = '#/login';
      throw new ApiError({
        status: 401,
        code: 'SESSION_EXPIRED',
        message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً.',
        endpoint: endpointSpec.code,
      });
    }
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('Content-Type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw parseErrorPayload(response.status, payload, response.headers, endpointSpec.code);
  }

  return payload;
}

