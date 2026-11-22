# CORE API local test suite

**Target branch:** `api-test-suite-on-refactor-api` (based on `refactor/api`).
**API prefix:** `/api/v1`. **Default API port:** `5000`.

## Imported files

- `CORE.postman_collection.json` — full route inventory; mutating requests require reviewed DTO payloads and disposable data.
- `CORE.read-only-smoke.postman_collection.json` — GET-only smoke requests.
- `CORE.local.postman_environment.json` — local Postman environment.
- `API_STATIC_AUDIT.md` — static route inventory notes. It is not runtime test evidence.

## Local fixture accounts

The local-only seed creates or resets these Greenfield accounts:

| Account | Email |
|---|---|
| Platform admin | `platform.admin@example.test` |
| School admin (created by provisioning) | `admin@greenfield-academy.test` |
| Second school admin | `admin2@greenfield-academy.test` |
| Teacher | `teacher@greenfield-academy.test` |
| Bursar | `bursar@greenfield-academy.test` |
| Guardian | `guardian@greenfield-academy.test` |
| Student | `student@greenfield-academy.test` |
| Staff + guardian | `multi.persona@greenfield-academy.test` |
| Must change password | `password.change@greenfield-academy.test` |
| Suspended membership | `restricted@greenfield-academy.test` |
| Inactive account | `inactive@greenfield-academy.test` |
| Active membership in both schools | `multi.school@schoolos.test` |

School fixture passwords come from `TEST_FIXTURE_PASSWORD`; the platform admin password is independently controlled by `TEST_PLATFORM_ADMIN_PASSWORD`. Use disposable local-only passwords. The script never prints passwords. Keep both values in the uncommitted `.env.development` file; never commit that file or credentials.

The seed uses the supported platform school-creation/provisioning workflow. It does not set `schemaProvisionedAt` itself and does not delete records. It resets fixture account password hashes, verification/active flags, `mustChangePassword`, failed-login counters and lock state on each run. The password-change fixture is deliberately reseeded with `mustChangePassword=true`; the other fixture accounts are set to false. The restricted fixture has an active user but a suspended tenant membership.

## Environment

Example local-only values (replace the passwords and DB URL locally):

```dotenv
ALLOW_LOCAL_TEST_ADMIN_BOOTSTRAP=true
TEST_PLATFORM_ADMIN_EMAIL=platform.admin@example.test
TEST_PLATFORM_ADMIN_PASSWORD=replace-with-a-local-secret
TEST_FIXTURE_PASSWORD=replace-with-another-local-secret
PLATFORM_BASE_URL=http://admin.localhost:5000
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/school_portal
```

For a Docker-network database, explicitly allow only its exact hostname:

```dotenv
TEST_DATABASE_HOST_ALLOWLIST=172.18.0.2
```

The seed refuses production mode, non-local API hosts, and database hosts outside loopback or the explicit host allowlist. Do not point it at a shared or production database.

## Run order

1. Apply public migrations and generate both Prisma clients using the repository's current Prisma commands.
2. Start PostgreSQL and Redis.
3. Start the API on port 5000 and the API worker.
4. Configure the local environment variables above.
5. From `apps/api`, run `npm run test:local`. This runs the deterministic seed and then the GET-only Newman smoke suite. It does not reset the database.
6. Import the full Postman collection/environment and authenticate platform and school accounts separately before running mutating workflows.

The local API must resolve `admin.localhost` and `greenfield-academy.localhost` to the local API process. On a school host, use the actual school hostname; do not assume the platform host token is a school session.

## Authentication contract to verify

The current login use case explicitly treats platform-host school routing as unauthenticated:

- One eligible school returns `SCHOOL_REDIRECT`.
- Multiple eligible schools return `SCHOOL_SELECTION_REQUIRED`; the last-used eligible school may be suggested.
- These selection responses do not issue access/refresh tokens. The user must authenticate again on the selected school host.
- On a school host, multiple active memberships/personas return `PERSONA_SELECTION_REQUIRED`; submit the selected persona to complete login.
- `UserSchool` is a discovery index only. Actual eligibility is checked against active tenant `Membership` records in each provisioned school schema.

## Dedicated database reset (destructive)

Only use this for a disposable database literally named `school_portal`. The reset script drops and recreates that entire database, including every tenant schema and record. It refuses production mode, other database names, non-allowlisted hosts, or missing explicit confirmation.

Set these values in `.env.development` only when you intentionally want to reset:

```dotenv
ALLOW_TEST_DATABASE_RESET=true
TEST_DATABASE_RESET_CONFIRM=school_portal
TEST_DATABASE_HOST_ALLOWLIST=172.18.0.2
```

Then, from `apps/api`, run:

```bash
npm run db:reset:test
```

Back up anything needed first. After reset, apply the public migrations, start API + worker, and run the seed so the worker provisions the tenant schema. The normal `test:local` command never invokes reset.

## Current implementation limits / verification status

This branch provisions Greenfield Academy and Riverside Academy through the platform provisioning workflow. The `multi.school@schoolos.test` user has an active STAFF membership in both tenant schemas. It also provisions the deterministic Greenfield persona fixtures and imports the refreshed Postman inventories. The seed requires the named role templates to exist in the provisioned tenant schema; it fails loudly rather than creating substitute roles. Dedicated automated assertions for redirect, school selection, persona selection, inactive-account rejection and cross-school authorization still need to be added; the seeded accounts and tenant memberships are test data, not proof those flows pass.

No Prisma generation, migration, API/worker startup, database seed, idempotency run, Newman execution or runtime auth/tenant-isolation test has been performed by the GitHub connector. Run those locally and report the actual output; static file commits are not evidence of runtime success.
