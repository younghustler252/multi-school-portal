# API Conventions

> **Source snapshot:** refactor/modules, reviewed 2026-11-06. This guide describes the actual Express API composition and shared conventions. It also identifies cross-cutting inconsistencies; it is not an OpenAPI replacement.

## API versioning and route ownership

All application routes are mounted under /api/v1. The route index composes module routers; each module owns its route/controller/DTO/use-case/repository behavior.

The public route index currently mounts:
- /auth, /users, /schools, /plans, /subscriptions, /audit.
- /staff, /roles, /permissions, /branches.
- /students, /guardians, /classes, /enrolments, /attendance, /grades, /sessions, /report-cards.
- /fees, /fees/invoices, /fees/adjustments (fee setup, reports, invoices and adjustments).
- /finance, /finance/settings, /finance/reconciliation, /finance/settlements.
- /expenses, /vendors, /budgets, /recurring-expenses.
- /payments, /payroll, /payroll/transfers, /my/payslips.
- /notifications, /school-settings, /message-templates, /automations.
- /platform/schools, /platform/plans, /platform/subscriptions, /platform/audit, /platform/settings, /platform/webhooks.
- /feedback.

Provider webhooks are mounted separately at /api/v1/webhooks before the global JSON parser. Queue administration is mounted at /admin/queues, outside the versioned API, and requires platform.queues.view.

## Actual application middleware order

Current app.ts order:

1. Helmet with cross-origin resource policy.
2. CORS allowlist (platform base domain and subdomains in production; all origins in development; requests without Origin pass).
3. Provider webhook router at /api/v1/webhooks, using its own raw-body parser and limiter.
4. Global rate limiter.
5. Public report-card template preview static files.
6. JSON and URL-encoded parsers (10 MB body limit), cookie parser.
7. Morgan request logging (disabled in test).
8. optionalAuthenticate.
9. resolveTenant.
10. validateTenantOwnership.
11. Health route.
12. Versioned API router.
13. Bull Board admin router.
14. 404 handler.
15. Global error handler.

The actual order is important: optional identity is attached before tenant resolution, then tenant ownership is checked globally. Protected routes subsequently use authenticate/requirePermission and AccessService.

**Missing middleware:** requestContext is implemented and its comments require it to be mounted first, but app.ts does not import or mount it. As a result, RequestContext has no store for normal HTTP requests; authenticate's RequestContext.setActor is a no-op. Request IDs, request IP/user-agent and automatic actor/impersonation enrichment are therefore absent from audit writes. See REM-112.

## Host-based tenant resolution

Tenant is derived from the request Host header, not a client-supplied schoolId:
- BASE_DOMAIN, www.BASE_DOMAIN and ADMIN_SUBDOMAIN.BASE_DOMAIN resolve to public/platform context.
- One label under BASE_DOMAIN resolves to that school's subdomain.
- Multi-label subdomains are rejected.
- Other hosts resolve only when they match a verified school customDomain.
- School must be active and schemaProvisionedAt must exist; otherwise 403 SCHOOL_INACTIVE or 503 SCHOOL_SETTING_UP.

TenantContext is AsyncLocalStorage-backed. resolveTenant enters the selected schema/school context before the route chain continues. A school access token must match the resolved host school. Platform tokens cannot act inside a school; use platform impersonation.

Development-only X-Tenant-Schema/X-School-Id headers are accepted only when the public School record proves the exact schema/school pair. They are ignored outside development.

Routes that upload files and cross an asynchronous middleware boundary may need reestablishTenantContext after multer; use the existing middleware pattern.

## Authentication and request identity

Access token sources:
1. Authorization: Bearer <access token> (mobile/API).
2. accessToken HTTP-only cookie (web).

Refresh token is an HTTP-only cookie. Cookie attributes: path=/, SameSite=Lax, Secure in production, optional COOKIE_DOMAIN; host-only by default.

optionalAuthenticate attaches valid identity without blocking public routes. Protected routes call authenticate. RBAC middleware loads Access itself when needed, so requirePermission/loadAccess order does not change authorization behavior.

Request identity:
- req.auth contains userId, schoolId, membershipId, mustChangePassword and impersonatedBy.
- req.access contains resolved realm, persona, permissions and scopes after AccessService loads it.
- req.schoolId/req.tenantSchema are set by tenant resolver for school hosts.
- req.access.scopeOf(permission) returns the permission's effective scope; do not check role names.

## Authorization, features and limits

Use requirePermission for RBAC keys, requireAnyPermission for alternatives and requirePersona for portal-persona restrictions. Permission checks are realm-aware and scope-aware.

Feature gates use requireFeature(featureKey) and EntitlementsService. A feature can be enabled by plan grant plus school override; a missing active feature denies. Feature definitions marked inactive are treated as not enforced by the current entitlement service.

Limits:
- requirePlanLimit supports student, staff and branch shortcut keys.
- assertWithinPlanLimit(schoolId, type, adding) is used in use cases and bulk operations.
- Module-specific limits (e.g. automation rules, finance transfers) should call EntitlementsService with the exact feature limit key.
- Do not trust frontend plan/feature flags; enforce in the API.

Other gates:
- requireGoodStanding blocks selected growth actions when a renewal invoice is overdue; it is not a global lockout.
- requireVerifiedSchool is used on actions that require platform verification.
- Neither middleware should be applied indiscriminately to read/critical access.

The feature/limit middleware writes warn-mode decisions to res.locals.entitlementWarnings, but the current response helpers do not serialize those warnings. See REM-116.

## Request validation

Zod DTOs are the request contract. Route middleware uses validate(schema, part):
- body: safeParse result replaces req.body.
- query/params: safeParse is performed, but the parsed result is not written back to req.query/req.params. The controller therefore receives raw Express values; Zod defaults/coercions/transforms/stripping do not flow to the use case. See REM-113.

Controllers commonly cast req.query to any. For query schemas, either pass parsed data through a typed request-local field (e.g. res.locals.validatedQuery) or parse again in the controller and use that parsed result. Do not assume the current query middleware applies transformations.

Strict DTOs should reject unknown keys for mutation bodies. Query schemas should explicitly decide whether unknown filters are stripped or rejected. Parse boolean query values from literal "true"/"false"; never use Boolean("false").

## Success responses

Shared helpers in shared/utils/api-response.ts:

- sendSuccess: HTTP 200, { success:true, message, data }.
- sendCreated: HTTP 201 with the same success envelope.
- sendPaginated: HTTP 200, { success:true, message, data, meta }.
- sendNoContent: HTTP 204 with an empty body.
- sendError: direct error envelope, but most errors should be thrown and handled centrally.

Pagination metadata:
- total, page, limit, totalPages, hasNext, hasPrev.
- parsePagination clamps page to at least 1 and limit to 1..maxLimit (default 100, default limit 20).
- Use stable ordering with a unique tie-breaker for cursor/offset queries.
- Avoid unbounded list endpoints; enforce DTO max limits.

## Errors and status codes

See [Error Handling](error-handling.md) for the complete mapping. Stable codes include TOKEN_MISSING, TOKEN_EXPIRED, TOKEN_INVALID, SESSION_INVALID, TENANT_MISMATCH, PERMISSION_DENIED, FEATURE_NOT_AVAILABLE, PLAN_LIMIT_REACHED, SCHOOL_SETTING_UP and PAYMENT_OVERDUE.

Expected statuses:
- 400 validation/bad request.
- 401 missing/invalid/expired authentication.
- 403 permission, feature, plan, school status or verification restrictions.
- 404 missing resource/route.
- 409 conflict/unique violation.
- 422 unprocessable domain state.
- 429 rate limit.
- 500 unexpected server failure.

Validation middleware currently returns a different error envelope from the global handler, and the 404 handler omits a stable code. See REM-114.

## Rate limits and proxy deployment

Current in-process rate limiters:
- Global: 100 requests / 15 minutes.
- Auth: 10 / 15 minutes, skip successful requests.
- OTP: 5 / 15 minutes.
- Webhook: 1,000 / minute.
- Upload: 20 / hour.

Global limiter is mounted after webhook route, so webhooks use their own limiter. Global limiter also covers health and static preview requests.

The limiters use the default express-rate-limit memory store; no shared Redis store is configured. app.ts/server.ts do not configure Express trust proxy. In a reverse-proxy deployment, req.ip may resolve to the proxy address for all users, causing a shared global bucket, while per-instance memory stores do not coordinate across replicas. Configure a narrowly trusted proxy chain and a shared rate-limit store before horizontal scaling. See REM-115.

## File uploads and raw webhooks

- JSON/urlencoded body limit is 10 MB.
- Module upload routes use Multer limits and should check file signatures with shared file-sniff helpers, not trust filename/MIME.
- School stamp/signature accepts PNG/JPEG/WebP up to 2 MB and uploads through Storage.
- Student photos are private/signed URLs; public branding/report-card images are separate.
- Provider webhook route must remain before express.json and receive exact raw bytes for signature verification.
- Reestablish tenant context after Multer or any middleware that can break AsyncLocalStorage continuity.

## Money, dates and serialization

- Finance calculations use integer kobo; avoid floating-point naira arithmetic.
- BigInt must not be returned directly in JSON. Use the shared kobo serialization helper or decimal strings; values outside Number.MAX_SAFE_INTEGER must remain strings.
- Subscription plan/invoice fields currently use Prisma Int; see REM-065 for its narrower range.
- Date-only API fields use YYYY-MM-DD where documented. Validate real calendar dates and compare in the owning domain's timezone.
- Several finance/automation modules currently hard-code Africa/Lagos; do not infer every school uses that timezone. See REM-030 and REM-089.

## Idempotency conventions

Use the idempotency boundary owned by the relevant module:
- Ledger PostingService: sourceType + sourceId + purpose.
- Subscription invoice creation: stable idempotency key for subscription/period.
- Webhook event: provider + eventKey.
- School notification recipient: deterministic idempotencyKey per occurrence/recipient/channel.
- Salary transfer: unique provider reference and attempt per payslip.
- Gateway settlement: provider/reference plus unique payment item links.

A unique key is not enough if a network call can succeed before its result is persisted; model UNKNOWN/lease/reconciliation for external side effects.

## API contract and documentation policy

Source code, DTOs and tests are authoritative. The current docs/swagger.yaml is an obsolete starter spec and must not be used as a current contract. Do not claim complete OpenAPI coverage or Zod-generated schema support without verifying the configured generator/plugin.

When adding or changing a route:
1. Add/modify DTO and route-level validation.
2. Enforce auth, tenant, persona, permission, feature and limit in the API.
3. Return the shared response shape and stable error code.
4. Add route/use-case/repository tests at the appropriate layer.
5. Update the module guide and eventually the canonical OpenAPI document.
