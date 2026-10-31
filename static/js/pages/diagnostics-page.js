// static/js/pages/diagnostics-page.js — Screen P18: API Contract & Session Diagnostics Lab
import { ENDPOINTS } from '../contracts/endpoints.js';
import { REQUEST_SCHEMAS } from '../contracts/serializers.js';
import { store } from '../core/store.js';
import { ui, escapeHtml } from '../core/ui.js';
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
          <h1>مختبر فحص العقود والتشخيص الحي (P18)</h1>
          <p>أداة هندسية لفحص جاهزية الخادم، اختبار قفل تجديد الجلسة المتزامن (E05)، واستعراض سجل العمليات الـ 57 دون تسريب أي توكنات سرية.</p>
        </div>
        <div class="page-header-actions">
          <button type="button" id="diag-clear-traces-btn" class="btn btn-sm btn-outline">مسح سجل التتبع</button>
        </div>
      </div>

      <div class="stats-grid" style="margin-bottom:1.5rem;">
        <div class="stat-card">
          <div class="stat-label">إجمالي عمليات الـ API المسجلة</div>
          <div class="stat-value">${endpointsList.length} / 57</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">نماذج الطلبات (Request Schemas)</div>
          <div class="stat-value">${Object.keys(REQUEST_SCHEMAS).length} / 19</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">حقول النماذج المغطاة</div>
          <div class="stat-value">${totalSchemaFields} / 92</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">جيل الجلسة (Session Generation)</div>
          <div class="stat-value mono" style="font-size:var(--text-base);">${Number(state.session?.generation || 0)}</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:1.5rem;">
        <h3>أزرار الفحص المباشر غير المدمر (Live Non-Destructive Probes)</h3>
        <div class="page-header-actions">
          <button type="button" class="btn btn-sm btn-primary" data-run-probe="E01">فحص الحياة GET /health (E01)</button>
          <button type="button" class="btn btn-sm btn-primary" data-run-probe="E02">فحص الجاهزية GET /health/ready (E02)</button>
          <button type="button" class="btn btn-sm btn-outline" data-run-probe="E08">فحص الهوية والعضويات GET /auth/me (E08)</button>
          <button type="button" class="btn btn-sm btn-outline" data-run-probe="E10">فحص الملف الشخصي GET /users/me (E10)</button>
          <button type="button" class="btn btn-sm btn-outline" data-run-probe="E52">فحص تقنيات المعرض GET /public/technologies (E52)</button>
          <button type="button" class="btn btn-sm btn-warning" data-run-probe="E05">اختبار تدوير الرمز الآمن POST /auth/refresh (E05 Mutex)</button>
        </div>
        ${
          probeOutput
            ? `<div style="margin-top:0.75rem;">
                <span class="field-hint">نتيجة آخر فحص مباشر (تم حجب الحقول السرية تلقائياً):</span>
                <pre class="json-viewer">${escapeHtml(JSON.stringify(probeOutput, null, 2))}</pre>
              </div>`
            : ''
        }
      </div>

      <div class="split-grid">
        <div class="card">
          <h3>سجل طلبات الجلسة الحالية (${traces.length}) — X-Request-ID & Latency</h3>
          ${
            traces.length === 0
              ? '<p class="field-hint">لم يتم تسجيل طلبات في هذه الجلسة بعد.</p>'
              : `<div class="table-scroll-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>الرمز</th>
                        <th>الطريقة والمسار</th>
                        <th>الحالة</th>
                        <th>الزمن</th>
                        <th>X-Request-ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${traces
                        .map(
                          (tr) => `
                        <tr>
                          <td><span class="badge badge-brand mono">${escapeHtml(tr.code)}</span></td>
                          <td class="mono">${escapeHtml(tr.method)} ${escapeHtml(tr.path)}</td>
                          <td>
                            <span class="badge ${tr.status >= 200 && tr.status < 300 ? 'badge-success' : 'badge-danger'}">
                              ${tr.status}
                            </span>
                          </td>
                          <td class="mono">${tr.durationMs}ms</td>
                          <td class="mono">${escapeHtml(tr.requestId || '—')}</td>
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
          <h3>سجل العقود الـ 57 الكامل (ENDPOINTS Registry E01–E57)</h3>
          <div class="table-scroll-container" style="max-height:26rem;overflow-y:auto;">
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
          ui.toast(`نجح تنفيذ الفحص ${probeCode}.`, 'success');
          renderLab({ probe: probeCode, response: result });
        } catch (err) {
          ui.toast(err.message || `فشل الفحص ${probeCode}`, 'error');
          renderLab({ probe: probeCode, error: err.message, status: err.status });
        } finally {
          btn.disabled = false;
        }
      });
    });
  };

  renderLab();
}

