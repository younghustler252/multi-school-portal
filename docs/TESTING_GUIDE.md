# Testing Guide

This guide describes the test commands and safeguards present in the current repository. The source of truth for test setup is `package.json`, `tests/setup/env.ts`, `tests/setup/safety.test.ts`, and `tests/helpers/test-database.ts`.

## 1. Requirements and commands

Use Node.js 22 or newer. The test setup calls `process.loadEnvFile()`, which requires a compatible Node version.

Run the full test suite:

```bash
npm test
```

Run the TypeScript build check:

```bash
npm run build
```

Run one test file:

```bash
npx tsx --import ./tests/setup/env.ts --test tests/infrastructure/tenant-transaction.test.ts
```

The `npm test` script uses `tsx`, loads `tests/setup/env.ts`, and runs test files matching `tests/**/*.test.ts` with Node's test runner and the spec reporter.

## 2. Test categories and interpreting results

Tests include unit/logic tests and database-backed tests. Database-backed tests that use `tests/helpers/test-database.ts` are skipped when `TEST_DATABASE_URL` is not set. A successful `npm test` command may therefore mean some database tests were skipped; read the output and report skips explicitly.

Before reporting a test result, distinguish:
- **Passed:** the test actually executed and passed.
- **Failed:** the test executed and failed.
- **Skipped:** it did not execute, for example because the test database was not configured.
- **Not run:** no command was executed to check it.

A build passing does not establish that API routes, database migrations, tenant isolation, or real provider integrations work.

## 3. Configure a dedicated test database

Database tests create and drop tenant schemas. They must never use a development or production database.

1. Create a separate empty PostgreSQL database whose name contains `test`. With the repository's Docker Compose service, for example:

   ```bash
   docker exec -it school_portal_db psql -U postgres -c "CREATE DATABASE schoolos_test;"
   ```

   Or use a local PostgreSQL installation:

   ```bash
   createdb schoolos_test
   ```

2. Create `.env.test` in the repository root, next to `package.json`:

   ```dotenv
   TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/schoolos_test
   ```

   Replace the username, password, host, and port with your local test database credentials.

3. Ensure `.env.test` remains untracked. It is listed in `.gitignore`.

4. Run `npm test` and confirm the database-backed tests execute rather than skip.

The test helper requires both a configured `TEST_DATABASE_URL` and a database name containing `test`. It creates a throwaway schema named `test_school_...`, applies every migration directory found under `prisma/tenant-migrations/` in sorted order, runs the test inside that tenant context, and drops the schema afterward.

The test helper does **not** build a separate public-schema database for every test. If a test touches public/platform persistence, inspect its setup and isolation strategy rather than assuming the tenant-schema helper covers it.

## 4. Built-in safety protections

The setup in `tests/setup/env.ts`:

- Loads `.env.test` when it exists.
- Forces `NODE_ENV=test`.
- Replaces external-service credentials with dummy values for tests.
- Sets `DATABASE_URL` to `TEST_DATABASE_URL`, or to a deliberately unreachable local address when no test database is configured.

The test helper refuses to create tenant schemas unless the database name contains `test`. `tests/setup/safety.test.ts` checks that the test environment and dummy payment key are active.

These safeguards reduce accidental access to development data; they are not a reason to point test configuration at any database other than a dedicated disposable test database.

## 5. Writing database-backed tests

Use the established helper pattern from `tests/infrastructure/tenant-transaction.test.ts` and other tests that call `createTestSchool()`:

```ts
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
    dbTestsEnabled,
    skipReason,
    createTestSchool,
    type TestSchool,
} from "../helpers/test-database";

describe("feature behavior", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool;

    before(async () => {
        school = await createTestSchool();
    });

    after(async () => {
        await school.drop();
    });

    it("runs inside the school's tenant context", async () => {
        await school.run(async () => {
            // Exercise the feature that uses getTenantClient().
        });
    });
});
```

Important details:

- Put the correct relative import path to `tests/helpers/test-database.ts` for the test file's location.
- Always clean up the created school in an `after` hook.
- Use `school.run(async () => ...)` for code that relies on `getTenantClient()`.
- Use isolated records per test or clean them up in setup.
- Use assertions against observable behavior, including failure paths and authorization boundaries.
- Do not make tests depend on live Paystack, Supabase, email, SMS, or other external credentials.

## 6. Schema and migration changes

For a schema change, check all relevant parts:

1. Update the correct Prisma schema (public, tenant, or both).
2. Generate the relevant Prisma client(s) using `npm run prisma:generate` or the scoped generation script.
3. Create and review the correct migration(s); public and tenant migrations use separate directories.
4. Run tests that exercise the changed schema.
5. Consider both newly provisioned schools and existing school schemas. The presence of a migration file does not prove it has been applied to every existing tenant.
6. Do not run destructive migration or test commands against production data.

## 7. Registry and permission tests

If a change adds or modifies permissions, role templates, or entitlements, inspect the relevant Foundation registry and its tests. Run:

```bash
npm run sync:registries
npm test
```

Only run the registry sync against the intended environment. Confirm its behavior before executing it; do not assume every sync operation is safe to run against production.

## 8. Common outcomes

| Output / symptom | Meaning / next step |
|---|---|
| Database tests say `TEST_DATABASE_URL is not set` | They were skipped. Configure the dedicated test database and rerun. |
| Database name must contain `test` | Use a dedicated test database whose name includes `test`. |
| Test process hangs after a DB test | Check that the created school is dropped and database clients/pools are closed. |
| Leftover `test_school_...` schema | A test may have been interrupted. Inspect the dedicated test database and clean up only the disposable test schema. |
| `process.loadEnvFile is not a function` | Use Node.js 22 or newer. |
| Build succeeds but tests fail | Treat build and test results separately; investigate the failing behavior. |
| Tests pass but database tests were skipped | Report the skipped coverage; do not claim database behavior was verified. |

## 9. Reporting verification accurately

For every implementation pass, report:

- The exact commands executed.
- Passed, failed, and skipped test counts when available.
- Whether the database-backed tests ran.
- Whether schema migrations were applied and against which environment.
- Any tests or integration checks that were not run.

Never describe a module as fully verified based only on file existence, a successful TypeScript build, or unit tests that do not exercise its database/API paths.
