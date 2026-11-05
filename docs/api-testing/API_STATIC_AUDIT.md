# CORE API — static route and testability audit

**Source branch:** `refactor/modules`  
**Test-suite branch:** `api-test-suite`  
**Scope:** Express route registry, mounted module route files, app middleware, selected auth/tenant middleware and representative DTO/controller files.

## Result

A Postman collection has been added with **440 unique method + route entries** in 16 module folders. The collection is a route-coverage scaffold with generic smoke assertions. It is not yet a full happy-path integration suite.

No HTTP request has been executed against the API in this review. The GitHub repository connector provides source access, not access to the user's local Node process, PostgreSQL tenant schemas or Redis instance. Therefore no endpoint is marked runtime-passed.

## Runtime prerequisites

- API running from `apps/api`.
- Public PostgreSQL database migrated and generated Prisma clients available.
- At least one provisioned school with tenant schema migrated.
- Redis available (the health endpoint checks Redis).
- A school user with the appropriate persona and permissions.
- A platform user for platform routes.
- Test-only records for IDs used by class, student, term, invoice, payment, payroll and finance workflows.
- Test Paystack/webhook configuration only if exercising provider callbacks.

## Postman files

- `CORE.postman_collection.json` — 440 route entries grouped by feature.
- `CORE.local.postman_environment.json` — local base URLs, auth token, tenant selector and safe path placeholders.
- `README.md` — import and execution instructions.

The collection attaches the development tenant headers to school-scoped requests. The tenant middleware accepts them only when `NODE_ENV=development` and validates the school ID against the public database. For deployed environments, tenant selection is host-based and those headers should not be used.

## What the generic request tests do

Each request currently checks:
- response is not HTTP 5xx;
- response time is below a 5-second baseline;
- JSON response bodies parse as JSON.

These assertions detect some crashes and malformed JSON, but they do **not** prove a request succeeded correctly. A 400, 401, 403, 404 or 409 can be legitimate when credentials, permissions, path IDs or DTO bodies are missing. In particular, mutation requests have no invented request bodies and are marked manual to avoid accidentally creating, issuing, publishing, transferring, approving, paying, reversing or deleting records.

## Source-level observations

### 1. Production CORS origin is hard-coded

`apps/api/src/app.ts` allows production origins matching `https://.*\\.yourapp\\.com$`. If the real CORE frontend domain is not a subdomain of `yourapp.com`, browser requests will fail CORS preflight/response checks. Before frontend deployment, replace this placeholder pattern with a validated environment-driven origin allowlist. Keep credentials handling intentional.

### 2. Public platform settings read requires a data-whitelist check

`GET /api/v1/platform/settings` is explicitly public in the route file. Its controller returns the settings use-case result without filtering it. This may be intentional for frontend bootstrapping, but the use case must return only public configuration (never secrets, provider keys, credentials or internal flags). Verify `GetPlatformSettingsUseCase` before exposing this endpoint to the browser.

### 3. Billing route mount comment disagrees with actual mount

The school billing route file describes itself as mounted at `/billing`, but `apps/api/src/routes/index.ts` mounts it at `/subscriptions`. The actual API paths are therefore `/api/v1/subscriptions...`. The collection follows the route registry. Update the stale comment/docs to prevent frontend integration using the wrong prefix.

### 4. Student import DTO contains a stale comment

The import DTO says the import use case is “not switched on yet”, but the current route registry mounts preview/import endpoints and the controller delegates to `PreviewStudentImportUseCase` and `ImportStudentsUseCase`. The implementation exists in the inspected controller; remove or correct the stale DTO comment after confirming the use cases are enabled and tested.

### 5. Health check depends on both PostgreSQL and Redis

`GET /api/v1/health` returns 200 only when both checks pass; otherwise it returns 503. A failing health request is not necessarily an Express route defect—it may indicate an unavailable dependency.

### 6. Webhook parsing is intentionally separate

The provider webhook entry is mounted before the global rate limiter and JSON parser, uses a dedicated limiter and preserves the raw JSON body for signature verification. Do not test it with a normal unsigned JSON request and interpret the expected signature rejection as a broken endpoint.

### 7. Tenant routing is host-driven

The resolver chooses public/platform context from the base/admin host and school context from a school subdomain or verified custom domain. Development override requires both `x-school-id` and `x-tenant-schema`, and validates the combination. A token for one school must not be used against another school's host.

## Next test phase — recommended order

1. Run API typecheck and existing test suite locally.
2. Start PostgreSQL, Redis and the API; verify `/api/v1/health`.
3. Test auth lifecycle and save access tokens automatically in Postman.
4. Run read-only requests using a school-admin token; then repeat key read endpoints with teacher, guardian and student personas to verify scope restrictions.
5. Execute controlled workflows against disposable test records: school setup → branch/class/subject → student → guardian link → enrolment → attendance → grade sheet → report card.
6. Test finance workflows separately: fee structure → invoice → payment → ledger/reporting; then expenses, payroll and reconciliation.
7. Test platform routes with a platform account only.
8. Add endpoint-specific response assertions and negative authorization/tenant-isolation tests. Only then call the API runtime-verified.

## Commands to run locally

From `apps/api`:

```bash
npm test
npm run typecheck
```

The package's `build` script has a `prebuild` hook that generates both Prisma clients before TypeScript compilation:

```bash
npm run build
```

Run these with the project's required environment configured. Do not point destructive API tests at production data.
