# CORE API test suite — refreshed

**Branch:** `api-test-suite-refresh`, created from the latest `refactor/modules`.

## Import
- `CORE.postman_collection.json` — 473 requests across 16 folders.
- `CORE.read-only-smoke.postman_collection.json` — 189 GET-only requests.
- `CORE.local.postman_environment.json` — local environment.

## Environment
The environment defaults `baseUrl` and `platformBaseUrl` to `http://localhost:4000`, matching the local port used in the previous test session. The API server defaults to 5000 when `PORT` is unset; update both variables if needed.

Set `accessToken`, `platformAccessToken`, `tenantSchoolId` and `tenantSchema` using a provisioned test school and test accounts. School requests use the school token; platform routes use the separate platform token. Development tenant headers are `x-school-id` and `x-tenant-schema`; the API validates the school ID. On a school subdomain, use the actual host instead of development overrides.

## Run order
1. Call `GET /api/v1/health` first. It checks PostgreSQL and Redis.
2. Run the GET-only smoke collection.
3. Authenticate school and platform test users separately.
4. Use a disposable test school/database and execute one write workflow at a time.
5. Seed prerequisite records and use current DTO payloads from module source.

## Safety
Do not run the full collection unattended or against production. State-changing requests can create, publish, issue, approve, transfer, pay, reverse or delete records. Newly added write entries are route templates with empty JSON bodies, not ready-made happy-path fixtures. Replace bodies with valid DTOs before execution. Uploads need multipart form-data; provider webhooks need raw JSON and a valid signature.

## Runtime status
Static route refresh only. No requests have been run against the local API, PostgreSQL or Redis. Route coverage does not prove business correctness. Successful workflows require valid auth, tenant context, permissions, plan entitlements, IDs and business prerequisites.

## Architecture notes
- API prefix: `/api/v1`.
- Health checks PostgreSQL and Redis.
- Webhook entry `POST /api/v1/webhooks/:provider` is mounted before JSON parsing and requires raw-body signature verification.
- School routes require tenant context; platform routes require platform permissions.
- Upload fields include `avatar`, `logo`, `document`, `photo`, `file`, `stamp` and `signature`.
- Queue dashboard is mounted at `/admin/queues` behind `platform.queues.view`.

## Remaining validation
Current route files were reviewed, but not every historical DTO example was regenerated. Verify all mutating payloads against current DTO schemas before running. Payment gateways, signed webhooks, uploads, asynchronous PDF jobs and financial workflows need dedicated fixtures.


## Local test-data bootstrap

A local-only helper is available at `apps/api/scripts/seed-test-data.ts`. From `apps/api`, run it with:

```bash
ALLOW_LOCAL_TEST_ADMIN_BOOTSTRAP=true \\
TEST_PLATFORM_ADMIN_EMAIL=platform.admin@example.test \\
TEST_PLATFORM_ADMIN_PASSWORD='ChangeThis!234' \\
PLATFORM_BASE_URL=http://admin.localhost:4000 \\
npx tsx scripts/seed-test-data.ts
```

The script refuses `NODE_ENV=production`, requires a loopback PostgreSQL host, and accepts only a loopback or `.localhost` API hostname. It creates/updates a local platform user, gives that user a local-only platform role with all platform permissions, logs in through the API, and creates one platform-managed test school through `POST /api/v1/platform/schools`. It never truncates or deletes data. Keep the API worker running so the school provisioning job can create its tenant schema and first admin membership.

To also exercise self-registration, set `REGISTER_TEST_PASSWORD` in the environment. The script then calls `POST /api/v1/auth/register`; that flow leaves the school pending and requires email OTP verification. Use your development mail transport to retrieve the OTP.

Use only a disposable local database. The platform admin bootstrap uses Prisma directly because the application intentionally has no public endpoint for granting a user platform-wide administrative authority. The script's role is local-only and must not be reused in production.
