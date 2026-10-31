// static/js/contracts/serializers.js — 19 Request Schemas (92 Fields) & Smart PATCH Builder

export const REQUEST_SCHEMAS = Object.freeze({
  // 1. CreateUserRequest (12 fields) — Used by E03 (/auth/register) & E09 (POST /users)
  CreateUserRequest: [
    'name',
    'email',
    'password',
    'username',
    'job_title',
    'bio',
    'avatar_url',
    'github_url',
    'linkedin_url',
    'website_url',
    'is_super_admin',
    'is_public_member',
  ],
  // 2. LoginRequest (2 fields) — E04
  LoginRequest: ['email', 'password'],
  // 3. RefreshRequest (1 field) — E05
  RefreshRequest: ['refresh_token'],
  // 4. UpdateSchemaRequest (9 fields) — E12 (PATCH /users/me)
  UpdateSchemaRequest: [
    'name',
    'job_title',
    'bio',
    'avatar_url',
    'github_url',
    'linkedin_url',
    'website_url',
    'is_public_member',
    'status',
  ],
  // 5. ChangePasswordRequest (2 fields) — E14
  ChangePasswordRequest: ['old_password', 'new_password'],
  // 6. CreateTeamRequest (3 fields) — E16
  CreateTeamRequest: ['name', 'slug', 'description'],
  // 7. UpdateTeamRequest (3 fields) — E19
  UpdateTeamRequest: ['name', 'description', 'is_active'],
  // 8. AddMemberRequest (2 fields) — E21
  AddMemberRequest: ['user_id', 'role'],
  // 9. UpdateMemberRoleRequest (1 field) — E23
  UpdateMemberRoleRequest: ['role'],
  // 10. CreateProjectRequest (10 fields) — E25
  CreateProjectRequest: [
    'title',
    'slug',
    'short_description',
    'description',
    'visibility',
    'status',
    'demo_url',
    'repo_url',
    'deadline',
    'technology_ids',
  ],
  // 11. UpdateProjectRequest (10 fields) — E29
  UpdateProjectRequest: [
    'title',
    'short_description',
    'description',
    'status',
    'visibility',
    'demo_url',
    'repo_url',
    'deadline',
    'is_active',
    'technology_ids',
  ],
  // 12. CreateTaskRequest (7 fields) — E31
  CreateTaskRequest: [
    'title',
    'description',
    'status',
    'priority',
    'position',
    'deadline',
    'assignee_to_id',
  ],
  // 13. UpdateTaskRequest (8 fields) — E36
  UpdateTaskRequest: [
    'title',
    'description',
    'status',
    'priority',
    'position',
    'deadline',
    'assignee_to_id',
    'is_active',
  ],
  // 14. MoveTaskRequest (2 fields) — E38
  MoveTaskRequest: ['status', 'position'],
  // 15. CreateCommentRequest (1 field) — E39
  CreateCommentRequest: ['content'],
  // 16. CreateTechnologyRequest (5 fields) — E42
  CreateTechnologyRequest: [
    'name',
    'category',
    'description',
    'documentation_url',
    'icon_url',
  ],
  // 17. UpdateTechnologyRequest (5 fields) — E46
  UpdateTechnologyRequest: [
    'name',
    'category',
    'description',
    'documentation_url',
    'icon_url',
  ],
  // 18. CreateInquiryRequest (7 fields) — E53
  CreateInquiryRequest: [
    'client_name',
    'client_email',
    'company_name',
    'service_type',
    'budget_range',
    'message',
    'honeypot',
  ],
  // 19. UpdateInquiryStatusRequest (2 fields) — E56
  UpdateInquiryStatusRequest: ['status', 'admin_notes'],
});

// Exact per-schema _NON_NULLABLE_FIELDS matching backend Pydantic models
export const SCHEMA_NON_NULLABLE_FIELDS = Object.freeze({
  UpdateSchemaRequest: new Set(['name', 'is_public_member', 'status']),
  UpdateTeamRequest: new Set(['name', 'is_active']),
  UpdateMemberRoleRequest: new Set(['role']),
  UpdateProjectRequest: new Set([
    'title',
    'short_description',
    'status',
    'visibility',
    'is_active',
    'technology_ids',
  ]),
  UpdateTaskRequest: new Set([
    'title',
    'description',
    'status',
    'priority',
    'position',
    'is_active',
  ]),
  UpdateTechnologyRequest: new Set(['name', 'category']),
  UpdateInquiryStatusRequest: new Set(['status']),
});

// Global union of non-nullable PATCH fields across all schemas
export const NON_NULLABLE_PATCH_FIELDS = new Set([
  'name',
  'is_public_member',
  'status',
  'is_active',
  'role',
  'title',
  'short_description',
  'visibility',
  'technology_ids',
  'priority',
  'position',
  'category',
]);

export const NULLABLE_PATCH_FIELDS = new Set([
  'job_title',
  'bio',
  'avatar_url',
  'github_url',
  'linkedin_url',
  'website_url',
  'description',
  'demo_url',
  'repo_url',
  'deadline',
  'assignee_to_id',
  'documentation_url',
  'icon_url',
  'admin_notes',
]);

export function toUtcIsoOrNull(localDateTimeValue) {
  if (!localDateTimeValue || String(localDateTimeValue).trim() === '') {
    return null;
  }
  const date = new Date(localDateTimeValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error('صيغة التاريخ والوقت غير صالحة.');
  }
  return date.toISOString();
}

export function toDateTimeLocalInputValue(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function normalizeOptionalUrl(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  const trimmed = String(rawValue).trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error(`الرابط "${trimmed}" يجب أن يبدأ بـ http:// أو https://`);
  }
  return trimmed;
}

/**
 * Builds a dirty-only PATCH payload that strictly respects backend _NON_NULLABLE_FIELDS:
 * - Unchanged fields are omitted.
 * - Required/non-nullable fields NEVER send null (even if cleared in UI; Task description sends "" instead of null).
 * - Nullable fields send explicit `null` when cleared from a previously non-empty value.
 * - Array fields (e.g., technology_ids) send `[]` when cleared.
 * - Boolean fields preserve explicit `false`.
 */
export function buildPatchPayload(originalData = {}, currentFormValues = {}, schemaName = null) {
  const payload = {};
  const schemaNonNullable =
    (schemaName && SCHEMA_NON_NULLABLE_FIELDS[schemaName]) || NON_NULLABLE_PATCH_FIELDS;

  for (const [key, rawNext] of Object.entries(currentFormValues)) {
    const prevVal = originalData[key];

    if (Array.isArray(rawNext)) {
      const prevIds = Array.isArray(prevVal)
        ? prevVal.map((item) => (typeof item === 'object' && item !== null ? Number(item.id) : Number(item))).sort((a, b) => a - b)
        : [];
      const nextIds = rawNext.map(Number).sort((a, b) => a - b);
      if (JSON.stringify(prevIds) !== JSON.stringify(nextIds)) {
        payload[key] = rawNext.map(Number);
      }
      continue;
    }

    if (typeof rawNext === 'boolean') {
      if (rawNext !== Boolean(prevVal)) {
        payload[key] = rawNext;
      }
      continue;
    }

    if (typeof rawNext === 'number') {
      if (Number.isFinite(rawNext) && rawNext !== Number(prevVal)) {
        payload[key] = rawNext;
      }
      continue;
    }

    const isEmptyString = typeof rawNext === 'string' && rawNext.trim() === '';

    if (isEmptyString || rawNext === null || rawNext === undefined) {
      // Special case: UpdateTaskRequest.description is non-nullable string (default ""), not Optional[str]
      if (schemaName === 'UpdateTaskRequest' && key === 'description') {
        if ((prevVal || '') !== '') {
          payload.description = '';
        }
        continue;
      }
      if (schemaNonNullable.has(key)) {
        continue;
      }
      if (NULLABLE_PATCH_FIELDS.has(key) && prevVal !== null && prevVal !== undefined && prevVal !== '') {
        payload[key] = null;
      }
      continue;
    }

    const normalizedNext = typeof rawNext === 'string' ? rawNext.trim() : rawNext;
    if (normalizedNext !== prevVal) {
      payload[key] = normalizedNext;
    }
  }

  return payload;
}

