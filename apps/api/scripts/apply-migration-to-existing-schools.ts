// scripts/apply-migration-to-existing-schools.ts
import { env } from "../src/config/env"
import { Pool } from "pg";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/infrastructure/database/prisma/prisma.client";

const DRY_RUN = process.argv.includes("--dry-run");
const TENANT_MIGRATIONS_DIR = join(__dirname, "..", "prisma", "tenant-migrations");

async function getAppliedMigrations(client: any): Promise<Set<string>> {
    try {
        const result = await client.query(
            `SELECT name FROM "_tenant_migrations_applied"`,
        );
        return new Set(result.rows.map((r: any) => r.name));
    } catch {
        // Table doesn't exist yet on this schema — first run
        if (DRY_RUN) return new Set();   // a dry run writes nothing, not even this table
        await client.query(`
            CREATE TABLE "_tenant_migrations_applied" (
                name       TEXT PRIMARY KEY,
                applied_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `);
        return new Set();
    }
}

async function main() {
    if (DRY_RUN) console.log("DRY RUN: nothing will be changed");
    const migrationFolders = readdirSync(TENANT_MIGRATIONS_DIR, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort();

    const schools = await prisma.school.findMany({
        where:  { schemaProvisionedAt: { not: null } },
        select: { id: true, name: true, schemaName: true },
    });

    const pool = new Pool({ connectionString: env.DATABASE_URL });

    for (const school of schools) {
        if (!school.schemaName) continue;

        const client = await pool.connect();
        try {
            await client.query(`SET search_path TO "${school.schemaName}"`);
            const applied = await getAppliedMigrations(client);

            const pending = migrationFolders.filter(f => !applied.has(f));

            if (pending.length === 0) {
                console.log(`⏭️  ${school.name} — already up to date`);
                continue;
            }

            if (DRY_RUN) {
                console.log(`🔎 ${school.name} — would apply: ${pending.join(", ")}`);
                continue;
            }

            for (const folder of pending) {
                const sql = readFileSync(
                    join(TENANT_MIGRATIONS_DIR, folder, "migration.sql"),
                    "utf8",
                );

                await client.query("BEGIN");
                await client.query(`SET search_path TO "${school.schemaName}"`);
                await client.query(sql);
                await client.query(
                    `INSERT INTO "_tenant_migrations_applied" (name) VALUES ($1)`,
                    [folder],
                );
                await client.query("COMMIT");
                console.log(`✅ ${school.name} — applied ${folder}`);
            }
        } catch (err) {
            await client.query("ROLLBACK");
            console.error(`❌ ${school.name} — failed:`, (err as Error).message);
        } finally {
            await client.query("SET search_path TO public");
            client.release();
        }
    }

    await pool.end();
    process.exit(0);
}

main();