// scripts/apply-migration-to-existing-schools.ts

import "dotenv/config"; import * as dotenv from "dotenv"; dotenv.config({ path: `.env.${process.env.NODE_ENV || "development"}`, override: true, });
import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/infrastructure/database/prisma/prisma.client";

const MIGRATION_FOLDER = "20260825170812_add_class_teacher";

async function main() {
    const schools = await prisma.school.findMany({
        where:  { schemaProvisionedAt: { not: null } },
        select: { id: true, name: true, schemaName: true },
    });

    const sql = readFileSync(
        join(process.cwd(), "prisma", "tenant-migrations", MIGRATION_FOLDER, "migration.sql"),
        "utf8",
    );

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    for (const school of schools) {
        if (!school.schemaName) continue;

        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(`SET search_path TO "${school.schemaName}"`);
            await client.query(sql);
            await client.query("COMMIT");
            console.log(`✅ ${school.name} (${school.schemaName})`);
        } catch (err) {
            await client.query("ROLLBACK");
            console.error(`❌ ${school.name} (${school.schemaName}):`, (err as Error).message);
        } finally {
            await client.query("SET search_path TO public");
            client.release();
        }
    }

    await pool.end();
    process.exit(0);
}

main();