import { readdirSync, readFileSync } from "fs";
import { join } from "path";

/*
|--------------------------------------------------------------------------
| TENANT SCHEMA BUILDER (used by the provision-schema worker)
|
| Builds a school's own PostgreSQL schema in STEPS THAT COMMIT ONE BY ONE:
|
|   1. create the schema and its migration-tracking table        (one transaction)
|   2. each tenant migration, together with its tracking row     (one transaction EACH)
|   3. the starting data (roles, chart of accounts, ...)         (one transaction, done by the worker, AFTER this)
|
| Why not one big transaction: PostgreSQL refuses to USE an enum value in the transaction that added it
| ("unsafe use of new value"). A migration that does ALTER TYPE ... ADD VALUE 'BRANCH' has to be committed
| before the role seeding inserts a permission with scope BRANCH.
|
| Atomic where it matters: a migration and its tracking row commit together or not at all, so the tracking table
| is always true. Safe to retry: an interrupted run leaves a schema that is kept (never dropped), and the next run
| applies only the migrations that are not tracked yet.
|--------------------------------------------------------------------------
*/

// The pg client (or a test double) satisfies this
export interface SqlRunner {
    query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}

export type BuildOutcome =
    | { kind: "built";            applied: string[]; alreadyApplied: number }
    | { kind: "untracked-legacy"; applied: [];       alreadyApplied: 0 };      // tables exist, no tracking table: left alone

export const TRACKING_TABLE = "_tenant_migrations_applied";

const quoteIdent = (name: string): string => `"${name.replace(/"/g, '""')}"`;

export function listTenantMigrations(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
}

/** BEGIN, run fn, COMMIT; ROLLBACK (and rethrow) when fn throws. */
export async function inTransaction<T>(client: SqlRunner, fn: () => Promise<T>): Promise<T> {
    await client.query("BEGIN");
    try {
        const result = await fn();
        await client.query("COMMIT");
        return result;
    } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
    }
}

/**
 * Create the schema if needed and apply every tenant migration that is not tracked yet.
 * Leaves the connection's search_path pointing at the school's schema.
 */
export async function applyTenantMigrations(
    client: SqlRunner, schemaName: string, migrationsDir: string, log: (message: string) => void = () => undefined,
): Promise<BuildOutcome> {
    const schema = quoteIdent(schemaName);

    const exists = ((await client.query("SELECT 1 FROM information_schema.schemata WHERE schema_name = $1", [schemaName])).rowCount ?? 0) > 0;
    if (!exists) {
        await inTransaction(client, async () => {
            await client.query(`CREATE SCHEMA ${schema}`);
            await client.query(`CREATE TABLE ${schema}.${quoteIdent(TRACKING_TABLE)} (name TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT now())`);
        });
    } else {
        const tables = (await client.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = $1", [schemaName],
        )).rows.map((r: any) => String(r.table_name));
        if (!tables.includes(TRACKING_TABLE)) {
            if (tables.length > 0) {
                // A school built before migrations were tracked. Replaying the baseline would fail; do not guess what it has.
                log(`⚠️  ${schemaName} has tables but no ${TRACKING_TABLE}; leaving its structure alone (run backfill-migration-tracking)`);
                await client.query(`SET search_path TO ${schema}`);
                return { kind: "untracked-legacy", applied: [], alreadyApplied: 0 };
            }
            // An empty schema left by an interrupted run
            await client.query(`CREATE TABLE ${schema}.${quoteIdent(TRACKING_TABLE)} (name TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT now())`);
        }
    }

    await client.query(`SET search_path TO ${schema}`);
    const done = new Set((await client.query(`SELECT name FROM ${quoteIdent(TRACKING_TABLE)}`)).rows.map((r: any) => String(r.name)));

    const applied: string[] = [];
    for (const migration of listTenantMigrations(migrationsDir)) {
        if (done.has(migration)) continue;
        const sql = readFileSync(join(migrationsDir, migration, "migration.sql"), "utf8");
        await inTransaction(client, async () => {
            await client.query(sql);
            await client.query(`INSERT INTO ${quoteIdent(TRACKING_TABLE)} (name) VALUES ($1)`, [migration]);
        });
        applied.push(migration);
    }
    log(`✅ Tables ready: ${schemaName} (${applied.length} migration(s) applied, ${done.size} already there)`);
    return { kind: "built", applied, alreadyApplied: done.size };
}

/**
 * True once the starting data has been written. The starting data goes in as ONE transaction and the school roles are
 * its last step, so "has roles" means "all of it is there".
 */
export async function isTenantSeeded(client: SqlRunner): Promise<boolean> {
    return (((await client.query(`SELECT 1 FROM "SchoolRole" LIMIT 1`)).rowCount) ?? 0) > 0;
}
