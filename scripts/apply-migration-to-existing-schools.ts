// scripts/apply-migration-to-existing-schools.ts
import { env } from "../src/config/env"
import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/infrastructure/database/prisma/prisma.client";

const MIGRATION_FOLDER = "20260908063238_consolidated_invoices"; // ⚠️ your actual folder name

// 👇 Add this near the top
const isDryRun = process.argv.includes("--dry-run");

async function main() {
    const schools = await prisma.school.findMany({
        where: { schemaProvisionedAt: { not: null } },
        select: { id: true, name: true, schemaName: true },
    });

    const sql = readFileSync(
        join(
            process.cwd(),
            "prisma",
            "tenant-migrations",
            MIGRATION_FOLDER,
            "migration.sql",
        ),
        "utf8",
    );

    const pool = new Pool({
        connectionString: env.DATABASE_URL,
    });

    for (const school of schools) {
        if (!school.schemaName) continue;

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            await client.query(`SET search_path TO "${school.schemaName}"`);

            // Check whether this migration has already been applied
            const migrationResult = await client.query(
                `
                SELECT migration_name
                FROM "_prisma_migrations"
                WHERE migration_name = $1
                LIMIT 1
                `,
                [MIGRATION_FOLDER],
            );

            const pending =
                migrationResult.rows.length === 0
                    ? [MIGRATION_FOLDER]
                    : [];

            // Already applied
            if (pending.length === 0) {
                console.log(`⏭️  ${school.name} — already up to date`);
                await client.query("ROLLBACK");
                continue;
            }

            // Dry run — don't actually apply anything
            if (isDryRun) {
                console.log(
                    `🔍 ${school.name} — would apply: ${pending.join(", ")}`,
                );
                await client.query("ROLLBACK");
                continue;
            }

            // Apply migration
            await client.query(sql);

            // Record migration in Prisma's migration table
            await client.query(
                `
                INSERT INTO "_prisma_migrations" (
                    id,
                    checksum,
                    finished_at,
                    migration_name,
                    logs,
                    rolled_back_at,
                    started_at,
                    applied_steps_count
                )
                VALUES (
                    gen_random_uuid(),
                    $1,
                    NOW(),
                    $2,
                    NULL,
                    NULL,
                    NOW(),
                    1
                )
                `,
                [
                    // Prisma expects the checksum of migration.sql here.
                    // See note below if your existing setup already records it.
                    "",
                    MIGRATION_FOLDER,
                ],
            );

            await client.query("COMMIT");

            console.log(`✅ ${school.name} (${school.schemaName})`);
        } catch (err) {
            await client.query("ROLLBACK");

            console.error(
                `❌ ${school.name} (${school.schemaName}):`,
                (err as Error).message,
            );
        } finally {
            try {
                await client.query("SET search_path TO public");
            } catch {
                // Ignore cleanup errors
            }

            client.release();
        }
    }

    await pool.end();
    process.exit(0);
}

main();
