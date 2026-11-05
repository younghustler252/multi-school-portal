# Testing Guide

> Checked against `refactor/modules` on 2026-11-05. Commands assume the repository root unless stated otherwise. The API test script runs with `apps/api` as its working directory.

## Requirements and commands

Use Node.js 22 or newer.

```bash
npm test
npm run build:api
npm run build:web
npm run typecheck:all
npm run check
```

The root `npm test` delegates to `npm run test -w apps/api`. The API workspace script loads `tests/setup/env.ts` and runs `tests/**/*.test.ts` through `tsx` and Node's test runner.

There is no root `npm run build` script. `npm run check` runs the API typecheck and API tests; it does not build the web application.

Run one API test file:

```bash
npm exec --workspace=apps/api -- tsx --import ./tests/setup/env.ts --test tests/auth/role-delegation.test.ts
```

Use a test path relative to `apps/api`.

## Test result interpretation

The suite includes unit/logic tests, architecture checks and database-backed tests. Tests using `apps/api/tests/helpers/test-database.ts` are skipped when `TEST_DATABASE_URL` is absent.

Report these separately:
- **Passed:** executed and passed.
- **Failed:** executed and failed.
- **Skipped:** did not execute, for example because no test database was configured.
- **Not run:** no command was executed.

A passing `npm test` may include skipped database tests. Read the output. A passing typecheck/build does not establish that migrations, API behavior, tenant isolation or live provider integrations work.

## Dedicated test database

Database tests create and drop temporary tenant schemas. Never point them at development or production data.

1. Create a separate disposable PostgreSQL database with `test` in its name, e.g. `core_test`.
2. Create `apps/api/.env.test`:

   ```dotenv
   TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/core_test
   ```

3. Keep the file untracked and run `npm test` from the repository root.
4. Confirm DB-backed tests execute rather than skip.

The file belongs in `apps/api` because npm executes the workspace script with that directory as its working directory; `tests/setup/env.ts` checks for `.env.test` relative to the current working directory.

The helper requires `TEST_DATABASE_URL` and refuses to run unless the database name contains `test` (case-insensitive). It creates a random `test_school_...` schema, applies sorted migrations from `apps/api/prisma/tenant-migrations/`, runs the test inside that tenant context, and drops the schema afterward.

The helper does not create an isolated public-schema database for every test. Inspect the setup of tests that touch public/platform persistence.

## Built-in safeguards

`apps/api/tests/setup/env.ts`:
- Loads `apps/api/.env.test` when present.
- Forces `NODE_ENV=test`.
- Replaces Paystack, Supabase, Termii and other external credentials with dummy values.
- Sets `DATABASE_URL` to `TEST_DATABASE_URL`, or to a deliberately unreachable local address if no test URL is set.

`apps/api/tests/helpers/test-database.ts` enforces the database-name check. `apps/api/tests/setup/safety.test.ts` checks the environment, database target and dummy payment key. These safeguards are not permission to use a shared or production database for tests.

## Database-backed test pattern

```ts
import { describe, it, before, after } from "node:test";
import {
    dbTestsEnabled, skipReason, createTestSchool, type TestSchool,
} from "../helpers/test-database";

describe("feature behavior", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool;
    before(async () => { school = await createTestSchool(); });
    after(async () => { await school.drop(); });

    it("runs in tenant context", async () => {
        await school.run(async () => {
            // Exercise code that relies on getTenantClient().
        });
    });
});
```

Adjust the relative import for the test file. Always clean up in `after`, use `school.run()` for tenant-context work, isolate records, and assert failure/authorization paths. Do not use live provider credentials.

## Schema and migration changes

1. Edit `apps/api/prisma/public.prisma`, `apps/api/prisma/tenant.prisma`, or both.
2. Generate clients: `npm run prisma:generate -w apps/api`.
3. Add/review the migration in `apps/api/prisma/migrations/` (public) or `apps/api/prisma/tenant-migrations/` (tenant).
4. Run relevant tests against the disposable test database.
5. Consider both new-school provisioning and existing-school migration application.

A migration file in Git does not prove it has been applied to every existing school.

## Registry and permission changes

Backend sync commands belong to the API workspace:

```bash
npm run sync:registries -w apps/api
npm run sync:school-roles -w apps/api
npm run sync:school-roles:dry-run -w apps/api
```

Review the command and target environment before running any sync.

## Reporting verification

For each implementation pass, report exact commands, pass/fail/skip counts, whether DB tests ran, whether migrations were applied and where, and what was not checked. Never claim full verification from file existence, typecheck success or unit tests alone.
