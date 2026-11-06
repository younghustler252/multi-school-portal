# Audit Module

> **Source snapshot:** refactor/modules, reviewed 2026-11-06. This guide documents the shared audit write service, school/platform read APIs, actor enrichment and failure reporting. The audit failure test was inspected but not executed.

## Responsibility and boundaries

Audit is a cross-cutting platform service, not a tenant-owned business module. It records who performed an action, what entity changed, when/where it happened, request correlation and impersonation context.

Responsibilities:
- Shared AuditService used by feature modules.
- Automatic RequestContext enrichment (actor, membership, request ID, IP, user agent).
- Impersonation attribution.
- USER, SUPER_ADMIN and SYSTEM actor handling.
- School-scoped activity history.
- Platform-wide audit search.
- Batched actor-name enrichment.
- Audit write failure reporting to console and Sentry without breaking the business request.

Audit rows live in the public schema so platform staff can search across schools. School business records remain in each tenant schema.

## Runtime composition and route mounts

Registered in apps/api/src/routes/index.ts:
- /api/v1/audit — current school's audit log.
- /api/v1/platform/audit — platform-wide audit log.

AuditService is a singleton because it uses static AsyncLocalStorage RequestContext for request-specific enrichment. AuditRepository and AuditLogEnricherService are scoped. The repository uses the public Prisma client; the enricher uses UserRepository to resolve names.

## HTTP endpoints

### School realm — base /api/v1/audit

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | / | audit.view | Paginated audit log for the host's resolved school only |

### Platform realm — base /api/v1/platform/audit

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | / | platform.audit.view | Paginated audit log across schools; optional schoolId filter |

Both permissions are ALL-scope STAFF-only and marked sensitive because before/after values can contain personal information. School API does not accept a schoolId filter; the school ID is taken from verified tenant host context.

Query filters: page, limit (max 100), userId, action, module, entity, entityId, startDate and endDate. Platform query also accepts schoolId. An action ending in a period is treated as a prefix (e.g. staff. matches all staff actions); otherwise it is exact.

## Audit write contract

Callers use AuditService.log with action, entity and optional user/school/actor/entity IDs, oldValue/newValue and metadata.

Automatic fields:
- module = first segment of action (e.g. student.created → student), unless explicit module supplied.
- requestId from RequestContext, also returned to the browser as x-request-id.
- actor membership, IP and user agent from RequestContext.
- impersonatedBy in metadata when a platform user is acting as a school user.
- PUBLIC school context is stored as null schoolId.
- user agent is truncated to 255 characters.

Actor rules:
- USER and SUPER_ADMIN inherit userId/membership from request context when not explicitly supplied.
- SYSTEM and other non-human actor types do not inherit the current request user.
- Background jobs should pass a stable SYSTEM_* userId and actorType SYSTEM.
- Explicit params override automatic values.

AuditService catches repository errors, writes a console error and reports identifiers-only context to Sentry with audit_failed tags. It never throws to the business caller. Failure reporter deliberately excludes old/new values, tokens and secrets.

## Read model and enrichment

AuditRepository reads the public AuditLog table and supports paginated filtering. School list forcibly merges schoolId into where clause; platform list may filter any school.

AuditLogEnricherService batches all user IDs for one page into a single UserRepository.findByIds call. It resolves system actor labels, human names and impersonator names. Missing/deleted user identities render Unknown rather than failing the page.

The response includes actor type/ID/name, impersonator name, action/module/entity/entity ID, before/after values, IP, request ID, metadata and createdAt.

## Persistence

Public model AuditLog stores:
- actor user/membership/name/type.
- school ID, action, entity, entity ID and module.
- request ID, IP address and user agent.
- JSON oldValue/newValue/metadata.
- createdAt.

Indexes: school+createdAt, entity+entityId, user+createdAt, module+action, requestId and actorMembershipId. The table intentionally has no tenant schema boundary; school filtering is mandatory for school reads.

The repository exposes create and paginate only. No update/delete API is mounted. No database immutability trigger or retention/archival policy was verified in this review.

## Tests and verification status

Test source inspected:
- apps/api/tests/audit/audit-failure.test.ts

It tests identifier-only Sentry failure context, AuditService swallowing/reporting repository errors, successful writes not reporting failures, AuthAuditService failure reporting and reporter failure safety. It does not test successful persistence fields, request-context enrichment, impersonation, school/platform filter isolation, date filters, pagination, redaction or database behavior.

Not executed in this review: tests, typecheck, build, migrations, Sentry integration, public DB queries or live HTTP requests.

## Open implementation and verification items

1. **Audit writes are not atomic with tenant business transactions.** AuditRepositoryImpl uses the public Prisma client, while business modules often call AuditService inside a tenant transaction. The audit write commits independently: a later tenant rollback can leave an audit event for an action that did not commit; conversely, swallowed audit failure can leave a committed business change without an audit row. See REM-077.
2. **endDate filtering excludes most of the requested day.** DTO parses a date string with Date.parse and the use case uses createdAt.lte = new Date(endDate). For YYYY-MM-DD this is midnight at the start of the day, so events later that day are omitted. Use an exclusive next-day bound or explicit end-of-day in the agreed timezone. See REM-078.
3. **Old/new values and metadata have no centralized secret/PII redaction.** AuditService persists arbitrary caller-supplied JSON. Review every caller for password hashes, OTPs, tokens, encrypted/full bank details, private student data and other sensitive fields; apply allowlist/redaction before persistence. See REM-079.
4. **No school/platform query isolation and request-context tests were found.** Add tests for schoolId forced from tenant host, platform cross-school filtering, impersonation attribution, SYSTEM actor non-inheritance, date boundaries and pagination. See REM-080.
5. **No retention/archival policy is documented.** Define retention by audit category and legal/compliance requirements, plus archival/deletion safeguards and storage monitoring.
6. **Run audit tests, typecheck/build and public DB migration checks** before production rollout.

## Source paths reviewed

- apps/api/src/modules/audit/routes/audit.routes.ts
- apps/api/src/modules/audit/routes/audit.platform.routes.ts
- apps/api/src/modules/audit/controllers/audit.controller.ts
- apps/api/src/modules/audit/dtos/audit.dto.ts
- apps/api/src/modules/audit/audit.permissions.ts
- apps/api/src/modules/audit/audit.container.ts
- apps/api/src/modules/audit/services/audit.service.ts
- apps/api/src/modules/audit/services/audit-failure-reporter.ts
- apps/api/src/modules/audit/services/audit-log-enricher.service.ts
- apps/api/src/modules/audit/repositories/audit.repository.impl.ts
- apps/api/src/modules/audit/usecases/list-audit-logs.usecases.ts
- apps/api/src/shared/context/request-context.ts
- apps/api/src/routes/index.ts
- apps/api/prisma/public.prisma
- apps/api/tests/audit/audit-failure.test.ts
