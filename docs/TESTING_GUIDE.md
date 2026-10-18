# Testing guide

How to run the tests and how to write a new one. Plain words, no jargon.

Needs **Node 22 or newer** (check with `node -v`).

## 1. What `npm test` does

It runs every file in the `tests/` folder whose name ends in `.test.ts`. There are two kinds:

- **Normal tests.** They need nothing. They run anywhere, in about a second.
- **Database tests.** They need a special test database (section 2). If you have not set one up, they are **skipped** and `npm test` still passes. The skip message tells you why.

```
npm test
```

To run just one file:

```
npx tsx --import ./tests/setup/env.ts --test tests/infrastructure/tenant-transaction.test.ts
```

## 2. One-time setup for the database tests

The database tests create and delete schools. They must **never** run on your development database. So they use a separate database made only for testing.

1. Create an empty database whose name contains the word `test`.
   - With the project's docker-compose: `docker exec -it school_portal_db psql -U postgres -c "CREATE DATABASE schoolos_test;"`
   - Without docker: `createdb schoolos_test`
2. Create a file called `.env.test` in the project root (next to `package.json`) with one line:
   ```
   TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/schoolos_test
   ```
   (Use your own user, password and port. The values above match `docker-compose.yml`.)
3. Add `.env.test` to `.gitignore`.
4. Run `npm test`. The database tests now run.

You do **not** need to create any tables yourself. Each database test builds its own throwaway school with every tenant table, the same way provisioning does, and deletes it afterwards.

## 3. Safety rules (built in)

- The test setup (`tests/setup/env.ts`) replaces `DATABASE_URL` with `TEST_DATABASE_URL`. With no test database set, it points at an address that does not exist, so a test cannot reach your development data by accident.
- A database test refuses to start if the database name does not contain `test`.
- Paystack, Supabase, JWT and other keys are replaced by dummy values during tests. A test never uses a real key.

## 4. How to write a database test

Copy the pattern from `tests/infrastructure/tenant-transaction.test.ts`:

```ts
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { dbTestsEnabled, skipReason, createTestSchool, TestSchool } from "../helpers/test-database";

describe("my feature", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool;

    before(async () => { school = await createTestSchool(); });
    after(async ()  => { await school.drop(); });          // always do this, or the test run will hang

    it("does the thing", () => school.run(async () => {
        // inside here getTenantClient() points at the throwaway school
    }));
});
```

Tips:
- `school.run(fn)` is how you pretend to be a request for that school.
- Import the app code with `await import(...)` inside `before`, as the example does, so a skipped test costs nothing.
- Give every test its own data, or clean up in `beforeEach`. Tests in one file share one school.
- To check that something is refused, use `assert.rejects(...)`.

## 5. For the finance work

Each finance phase ends with acceptance tests (brief, section 16). Put them in `tests/finance/`, for example `tests/finance/posting-rules.test.ts`. The same pattern applies: one throwaway school per file, then check that every journal balances, closed periods refuse postings, and so on.

## 6. When something goes wrong

| What you see | What it means |
|---|---|
| Database tests show "SKIP" | `TEST_DATABASE_URL` is not set (section 2) |
| `Refusing to run: the database name ... must contain the word "test"` | Use a database whose name includes `test` |
| The run never finishes | A database test file forgot `await school.drop()` in `after` |
| Leftover schemas named `test_school_...` | A test run was stopped halfway. Drop and recreate the test database; nothing else lives there |
| `process.loadEnvFile is not a function` | Node is too old. Install Node 22 or newer |
