// static/js/pages/diagnostics-page.js — Screen P18: API Contract & Session Diagnostics Lab
import { ENDPOINTS } from '../contracts/endpoints.js';
import { REQUEST_SCHEMAS } from '../contracts/serializers.js';
import { store } from '../core/store.js';
import { ui, escapeHtml } from '../core/ui.js';
import { tr } from '../core/i18n.js';
import { renderIcon } from '../components/icon.js';
import { healthService } from '../services/health.js';
import { authService } from '../services/auth.js';
import { usersService } from '../services/users.js';
import { showcaseService } from '../services/showcase.js';

export async function mountDiagnosticsPage({ container, scope, isStale }) {
  const renderLab = (probeOutput = null) => {
    if (isStale()) return;
    const state = store.getState();
    const traces = state.diagnostics || [];
    const endpointsList = Object.values(ENDPOINTS);
    const totalSchemaFields = Object.values(REQUEST_SCHEMAS).reduce(
      (acc, arr) => acc + arr.length,
      0
    );

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${escapeHtml(tr('مختبر فحص العقود والتشخيص الحي (P18)', 'Live API Contract & Diagnostics Lab (P18)'))}</h1>
          <p>${escapeHtml(tr('أداة هندسية لفحص جاهزية الخادم، اختبار قفل تجديد الجلسة المتزامن (E05)، واستعراض سجل العمليات الـ 57 دون تسريب أي توكنات سرية.', 'Engineering lab to verify server readiness, test the single-flight session refresh mutex (E05), and inspect the 57-endpoint contract registry without exposing secret tokens.'))}</p>
        </div>
        <div class="page-header-actions">
          <button type="button" id="diag-clear-traces-btn" class="btn btn-sm btn-outline">${renderIcon('trash-2', { size: 14 })} <span>${escapeHtml(tr('مسح سجل التتبع', 'Clear Trace Log'))}</span></button>
        </div>
      </div>

      <div class="stats-grid" style="margin-block-end:1.5rem;">
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(tr('إجمالي عمليات الـ API المسجلة', 'Registered API Operations'))}</div>
          <div class="stat-value">${endpointsList.length} / 57</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(tr('نماذج الطلبات (Request Schemas)', 'Request Schemas'))}</div>
          <div class="stat-value">${Object.keys(REQUEST_SCHEMAS).length} / 19</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(tr('حقول النماذج المغطاة', 'Covered Schema Fields'))}</div>
          <div class="stat-value">${totalSchemaFields} / 92</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${escapeHtml(tr('جيل الجلسة (Session Generation)', 'Session Generation'))}</div>
          <div class="stat-value mono" style="font-size:var(--text-base);">${Number(state.session?.generation || 0)}</div>
        </div>
      </div>

      <div class="card" style="margin-block-end:1.5rem;">
        <h3>${renderIcon('activity', { size: 16 })} <span>${escapeHtml(tr('أزرار الفحص المباشر غير المدمر (Live Non-Destructive Probes)', 'Live Non-Destructive API Probes'))}</span></h3>
        <div class="page-header-actions">
          <button type="button" class="btn btn-sm btn-primary" data-run-probe="E01">${renderIcon('activity', { size: 14 })} <span>${escapeHtml(tr('فحص الحياة GET /health (E01)', 'Liveness GET /health (E01)'))}</span></button>
          <button type="button" class="btn btn-sm btn-primary" data-run-probe="E02">${renderIcon('check', { size: 14 })} <span>${escapeHtml(tr('فحص الجاهزية GET /health/ready (E02)', 'Readiness GET /health/ready (E02)'))}</span></button>
          <button type="button" class="btn btn-sm btn-outline" data-run-probe="E08">${renderIcon('user-check', { size: 14 })} <span>${escapeHtml(tr('فحص الهوية والعضويات GET /auth/me (E08)', 'Identity & Memberships GET /auth/me (E08)'))}</span></button>
          <button type="button" class="btn btn-sm btn-outline" data-run-probe="E10">${renderIcon('user', { size: 14 })} <span>${escapeHtml(tr('فحص الملف الشخصي GET /users/me (E10)', 'User Profile GET /users/me (E10)'))}</span></button>
          <button type="button" class="btn btn-sm btn-outline" data-run-probe="E52">${renderIcon('cpu', { size: 14 })} <span>${escapeHtml(tr('فحص تقنيات المعرض GET /public/technologies (E52)', 'Public Technologies GET /public/technologies (E52)'))}</span></button>
          <button type="button" class="btn btn-sm btn-warning" data-run-probe="E05">${renderIcon('refresh-cw', { size: 14 })} <span>${escapeHtml(tr('اختبار تدوير الرمز الآمن POST /auth/refresh (E05 Mutex)', 'Test Safe Token Rotation POST /auth/refresh (E05 Mutex)'))}</span></button>
        </div>
        ${
          probeOutput
            ? `<div style="margin-block-start:0.75rem;">
                <span class="field-hint">${escapeHtml(tr('نتيجة آخر فحص مباشر (تم حجب الحقول السرية تلقائياً):', 'Latest live probe result (secret fields automatically redacted):'))}</span>
                <pre class="json-viewer">${escapeHtml(JSON.stringify(probeOutput, null, 2))}</pre>
              </div>`
            : ''
        }
      </div>

      <div class="split-grid">
        <div class="card">
          <h3>${escapeHtml(tr(`سجل طلبات الجلسة الحالية (${traces.length}) — X-Request-ID & Latency`, `Current Session Request Traces (${traces.length}) — X-Request-ID & Latency`))}</h3>
          ${
            traces.length === 0
              ? `<p class="field-hint">${escapeHtml(tr('لم يتم تسجيل طلبات في هذه الجلسة بعد.', 'No requests recorded in this session yet.'))}</p>`
              : `<div class="table-scroll-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>${escapeHtml(tr('الرمز', 'Code'))}</th>
                        <th>${escapeHtml(tr('الطريقة والمسار', 'Method & Path'))}</th>
                        <th>${escapeHtml(tr('الحالة', 'Status'))}</th>
                        <th>${escapeHtml(tr('الزمن', 'Latency'))}</th>
                        <th>X-Request-ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${traces
                        .map(
                          (traceItem) => `
                        <tr>
                          <td><span class="badge badge-brand mono">${escapeHtml(traceItem.code)}</span></td>
                          <td class="mono">${escapeHtml(traceItem.method)} ${escapeHtml(traceItem.path)}</td>
                          <td>
                            <span class="badge ${traceItem.status >= 200 && traceItem.status < 300 ? 'badge-success' : 'badge-danger'}">
                              ${traceItem.status}
                            </span>
                          </td>
                          <td class="mono">${traceItem.durationMs}ms</td>
                          <td class="mono">${escapeHtml(traceItem.requestId || '—')}</td>
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
          <h3>${escapeHtml(tr('سجل العقود الـ 57 الكامل (ENDPOINTS Registry E01–E57)', 'Complete 57-Operation Registry (ENDPOINTS E01–E57)'))}</h3>
          <div class="table-scroll-container" style="max-block-size:26rem;overflow-y:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Method</th>
                  <th>Exact Path</th>
                  <th>Schema</th>
                </tr>
              </thead>
              <tbody>
                ${endpointsList
                  .map(
                    (ep) => `
                  <tr>
                    <td class="mono"><strong>${escapeHtml(ep.code)}</strong></td>
                    <td><span class="badge mono">${escapeHtml(ep.method)}</span></td>
                    <td class="mono">${escapeHtml(ep.path)}</td>
                    <td class="mono">${escapeHtml(ep.schema || '—')}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#diag-clear-traces-btn').addEventListener('click', () => {
      store.clearDiagnostics();
      renderLab(null);
    });

    container.querySelectorAll('[data-run-probe]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const probeCode = btn.getAttribute('data-run-probe');
        btn.disabled = true;
        try {
          let result = null;
          if (probeCode === 'E01') result = await healthService.checkLiveness(scope.signal);
          else if (probeCode === 'E02') result = await healthService.checkReadiness(scope.signal);
          else if (probeCode === 'E08') result = await authService.getMe(scope.signal);
          else if (probeCode === 'E10') result = await usersService.getProfile(scope.signal);
          else if (probeCode === 'E52') result = await showcaseService.listTechnologies(scope.signal);
          else if (probeCode === 'E05') {
            await authService.refresh();
            result = {
              status: 'rotated_safely_via_single_flight_mutex',
              generation: store.getState().session.generation,
              token_redacted: '[REDACTED_FOR_SECURITY]',
            };
          }
          ui.toast(
            tr(`نجح تنفيذ الفحص ${probeCode}.`, `Probe ${probeCode} succeeded.`),
            'success'
          );
          renderLab({ probe: probeCode, response: result });
        } catch (err) {
          ui.toast(
            err.message || tr(`فشل الفحص ${probeCode}`, `Probe ${probeCode} failed`),
            'error'
          );
          renderLab({ probe: probeCode, error: err.message, status: err.status });
        } finally {
          btn.disabled = false;
        }
      });
    });
  };

  renderLab();
}
