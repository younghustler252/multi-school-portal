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

A local-only helper is available at `apps/api/scripts/seed-test-data.ts`. It creates or updates the platform test admin and submits one deterministic platform-managed school:

- School: **Greenfield Academy**
- Subdomain: `greenfield-academy`
- Tenant schema expected from the schema-name helper: `school_greenfield_academy`
- School admin email: `admin@greenfield-academy.test`

The script never deletes database records. It uses the API to create the school so the normal provisioning workflow and worker remain responsible for tenant schema creation and the first tenant membership. Keep the API and worker running. A successful school-create response is not proof that provisioning has finished; verify `schemaProvisionedAt`, the tenant schema, and active tenant membership before testing school login.

The script refuses `NODE_ENV=production`, requires `ALLOW_LOCAL_TEST_ADMIN_BOOTSTRAP=true`, and accepts only loopback database hosts by default. For an intentional Docker-network test database, explicitly allow its exact hostname in the uncommitted `.env.development` file:

```dotenv
TEST_DATABASE_HOST_ALLOWLIST=172.18.0.2
```

This is an exact-host allowlist, not a blanket private-network exception. The API target must still be loopback or a `.localhost` hostname.

## One-command local run

From `apps/api`, with the API server and worker already running, configure these variables in `.env.development` (do not commit secrets):

```dotenv
DATABASE_URL=postgresql://...@172.18.0.2:5432/school_portal
TEST_DATABASE_HOST_ALLOWLIST=172.18.0.2
ALLOW_LOCAL_TEST_ADMIN_BOOTSTRAP=true
TEST_PLATFORM_ADMIN_EMAIL=platform.admin@example.test
TEST_PLATFORM_ADMIN_PASSWORD=use-a-disposable-local-password
PLATFORM_BASE_URL=http://admin.localhost:4000
```

Then run:

```bash
npm run test:local
```

This bootstraps the platform test admin, initializes platform settings, submits Greenfield Academy through `POST /api/v1/platform/schools`, and then runs the GET-only Newman smoke collection. It does not reset or truncate the database. Re-running against a database that already contains the deterministic school will encounter the unique school identity; use a clean disposable test database for a fresh run.

The initial automated pass does not create the full academic fixture (sessions, terms, classes, subjects, staff, students, guardians, enrolments or calendar events). The smoke suite is read-only and does not verify those write workflows. Do not run the full collection unattended: its write requests can create, publish, approve, transfer, pay, reverse or delete records.


From `apps/api`, after starting the API server and its background worker, configure these variables in your local `.env` (do not commit secrets):

```dotenv
DATABASE_URL=postgresql://...@localhost:5432/...
ALLOW_LOCAL_TEST_ADMIN_BOOTSTRAP=true
TEST_PLATFORM_ADMIN_EMAIL=platform.admin@example.test
TEST_PLATFORM_ADMIN_PASSWORD=use-a-disposable-local-password
PLATFORM_BASE_URL=http://admin.localhost:4000
```

Then run:

```bash
npm run test:local
```

This command bootstraps the local platform admin, initializes platform settings (including the required `platformName` interpolation value), creates one uniquely named platform-managed test school through the API, and then runs the GET-only Newman smoke collection. It does not require Postman Desktop. `npx` may download Newman the first time.

**Current scope limitation:** this first automated pass does not yet create the school-admin login, academic session/terms, classes, subjects, staff, students, guardians, enrolments or calendar events. Those write fixtures must be added only after their current DTOs, tenant-provisioning readiness and school-admin authentication flow have been verified. The smoke suite is read-only and does not verify the new school's write workflows.

The previous failed school-create attempt may have persisted a school or queued provisioning before its response failed. Inspect the platform school/provisioning list before rerunning, and use a disposable local database. The script generates a fresh subdomain for each run and never deletes existing data.
