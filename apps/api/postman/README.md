# CORE API Postman verification suite

## Source and scope
This collection was assembled from the `refactor/modules` branch route registry:
- `apps/api/src/routes/index.ts`
- Module route files under `apps/api/src/modules/**/routes`
- `apps/api/src/app.ts` for health, webhook, and queue dashboard mounting.

API base path: `/api/v1`. The queue dashboard is mounted separately at `/admin/queues`.

## Import
1. Import `CORE.postman_collection.json` into Postman.
2. Import `CORE.local.postman_environment.json`.
3. Select **CORE API — Local Development**.
4. Start the API and its required PostgreSQL and Redis services.
5. Set `schoolSubdomain`, `email`, and `password` to test-account values.

## Host / tenant resolution
The tenant resolver determines school/platform context from the request hostname, not a custom tenant header. The local environment therefore uses:
- Public host: `http://localhost:5000`
- School host: `http://<schoolSubdomain>.localhost:5000`
- Platform host: `http://admin.localhost:5000`

If your local `BASE_DOMAIN` differs from `localhost`, adjust these URLs to match it. The API must receive the school hostname for school-tenant routes; sending every request to plain localhost will resolve the public/platform context instead.

## Authentication
The login endpoint is on the host being tested. A successful login returns tokens in its response and also sets auth cookies. Copy `tokens.accessToken` into the environment's `accessToken` and `tokens.refreshToken` into `refreshToken` if Postman does not retain the cookies automatically. The login response can also return persona or school selection instead of tokens; resolve that flow before protected requests.

Set Authorization as a bearer token automatically on requests marked as authenticated. Platform requests use the platform host and a platform session; school tokens cannot be used as platform sessions.

## Safety
Mutating requests (POST/PUT/PATCH/DELETE) are skipped by default. This prevents accidental creation, payment, promotion, payroll, refund, transfer, notification, or deletion operations while simply checking the route inventory.

To opt in:
1. Use a disposable local/test database, never production.
2. Review each request body and replace the default `{}` with the exact DTO payload.
3. Populate path variables with IDs created in your test tenant.
4. Set environment variable `runMutations` to `true`.
5. Run a small module/workflow folder at a time.

The Paystack webhook is excluded from this mutation skip only because it is a provider callback; do not send arbitrary webhook payloads to a live environment.

## What the generic assertions mean
Each request checks:
- The response is not a 404 (route not found).
- The server did not return an unhandled 5xx.
- JSON responses parse when the content type is JSON.

These are **route-reachability smoke checks**, not proof that every endpoint's business logic works. A 400 validation response, 401/403 auth response, 404 for a missing record from a registered parameterized route, or 409 business conflict may be expected depending on the test data. Build functional tests with valid DTO payloads and known records before treating a workflow as passed.

## Known setup dependencies
- PostgreSQL public and tenant schemas/migrations.
- Redis for queues, rate limits, and health checks.
- Storage provider configuration for file/avatar/photo uploads.
- Email/SMS provider configuration for OTPs and notifications.
- Paystack test credentials for online payment and settlement flows.
- School and platform hostnames matching `BASE_DOMAIN` and `ADMIN_SUBDOMAIN`.

## Source-review findings to verify before frontend integration
1. Student import DTO comments say the import use case is "not switched on yet", while import routes are registered. Verify the controller/use-case behaviour; do not assume CSV import is production-ready.
2. The health endpoint depends on both database and Redis and returns 503 if either check fails.
3. School and platform routing depends on hostname; environment URLs must preserve that distinction.
4. The Paystack webhook is registered before JSON parsing and uses `express.raw({ type: "application/json" })`; preserve the raw body when testing signature verification.
5. The report-card template-preview endpoint is a JSON iframe preview route; static template preview assets are separately mounted at `/api/v1/report-cards/template-previews`.

## Not yet verified
This is a source-derived collection. No live HTTP requests, Postman/Newman run, database migrations, or backend test suite execution has been performed in the GitHub connector environment. Functional assertions and valid request examples should be added module by module after inspecting each DTO and controller response.
