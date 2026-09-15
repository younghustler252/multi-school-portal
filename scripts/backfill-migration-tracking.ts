// scripts/backfill-migration-tracking.ts
import { Pool } from "pg";
import { readdirSync } from "fs";
import { join } from "path";
import { prisma } from "../src/infrastructure/database/prisma/prisma.client";

const TENANT_MIGRATIONS_DIR = join(process.cwd(), "prisma", "tenant-migrations");

const BACKFILL_UP_TO = "20260805000000_add_class_teacher"; // ⚠️ adjust to your real cutoff

async function main() {
    const allFolders = readdirSync(TENANT_MIGRATIONS_DIR, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort();

    const cutoffIndex = allFolders.indexOf(BACKFILL_UP_TO);
    if (cutoffIndex === -1) {
        console.error(`❌ "${BACKFILL_UP_TO}" not found in tenant-migrations/`);
        process.exit(1);
    }

    const toBackfill = allFolders.slice(0, cutoffIndex + 1);
    console.log(`Backfilling as "already applied": ${toBackfill.join(", ")}`);

    const schools = await prisma.school.findMany({
        where:  { schemaProvisionedAt: { not: null } },
        select: { id: true, name: true, schemaName: true },
    });

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    for (const school of schools) {
        if (!school.schemaName) continue;
        const client = await pool.connect();

        try {
            await client.query(`SET search_path TO "${school.schemaName}"`);
            await client.query(`
                CREATE TABLE IF NOT EXISTS "_tenant_migrations_applied" (
                    name       TEXT PRIMARY KEY,
                    applied_at TIMESTAMP NOT NULL DEFAULT now()
                )
            `);

            for (const folder of toBackfill) {
                await client.query(
                    `INSERT INTO "_tenant_migrations_applied" (name) VALUES ($1) ON CONFLICT DO NOTHING`,
                    [folder],
                );
            }

            console.log(`✅ ${school.name} — backfilled`);
        } catch (err) {
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