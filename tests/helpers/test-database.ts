/*
|--------------------------------------------------------------------------
| TEST DATABASE HELPER
| Builds a throwaway school (a fresh Postgres schema with every tenant table) inside the TEST database,
| exactly the way provisioning does it, and removes it afterwards.
|
|   let school: TestSchool;
|   before(async () => { school = await createTestSchool(); });
|   after(async ()  => { await school.drop(); });
|   it("...", () => school.run(async () => { ...code that calls getTenantClient()... }));
|
| Safety: it refuses to run unless TEST_DATABASE_URL is set AND the database name contains "test".
|--------------------------------------------------------------------------
*/
import { Pool }                  from "pg";
import { randomBytes, randomUUID } from "crypto";
import { readdirSync, readFileSync } from "fs";
import { join }                  from "path";

export const testDatabaseUrl = process.env.TEST_DATABASE_URL;
export const dbTestsEnabled  = Boolean(testDatabaseUrl);
export const skipReason      = "TEST_DATABASE_URL is not set. See docs/TESTING_GUIDE.md to run the database tests.";

// npm test is always run from the project root
const migrationsDir = join(process.cwd(), "prisma", "tenant-migrations");

function assertSafeDatabase(url: string): void {
    const databaseName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
    if (!/test/i.test(databaseName)) {
        throw new Error(
            `Refusing to run: the database name "${databaseName}" must contain the word "test". ` +
            `Tests create and delete schemas, so they only run against a database made for testing.`,
        );
    }
}

export interface TestSchool {
    schemaName: string;
    schoolId:   string;
    /** Runs fn as if it were a request for this school (what getTenantClient() needs). */
    run<T>(fn: () => Promise<T>): Promise<T>;
    /** Closes the app's database connections, then deletes the school's schema. Call once per test file. */
    drop(): Promise<void>;
}

export async function createTestSchool(): Promise<TestSchool> {
    if (!testDatabaseUrl) throw new Error(skipReason);
    assertSafeDatabase(testDatabaseUrl);

    const { TenantContext } = await import("../../src/infrastructure/database/prisma/tenant.context");

    const schemaName = `test_school_${randomBytes(5).toString("hex")}`;
    const schoolId   = randomUUID();

    const pool   = new Pool({ connectionString: testDatabaseUrl, max: 1 });
    const client = await pool.connect();

    try {
        await client.query(`CREATE SCHEMA "${schemaName}"`);
        await client.query(`SET search_path TO "${schemaName}"`);

        const migrations = readdirSync(migrationsDir, { withFileTypes: true })
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name)
            .sort();

        for (const migration of migrations) {
            await client.query(readFileSync(join(migrationsDir, migration, "migration.sql"), "utf8"));
        }
    } catch (err) {
        client.release();
        await pool.end();
        throw err;
    }
    client.release();
    await pool.end();

    return {
        schemaName,
        schoolId,
        run: (fn) => TenantContext.run({ tenantSchema: schemaName, schoolId }, fn),
        drop: async () => {
            const { disconnectPrisma } = await import("../../src/infrastructure/database/prisma/prisma.client");
            await disconnectPrisma();

            const cleaner = new Pool({ connectionString: testDatabaseUrl, max: 1 });
            try { await cleaner.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`); }
            finally { await cleaner.end(); }
        },
    };
}
