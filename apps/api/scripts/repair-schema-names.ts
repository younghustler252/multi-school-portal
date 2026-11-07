// scripts/repair-schema-names.ts
//
// Finds schools whose stored schema name is not a valid name (for example "school_core-test-ab12") and fixes them:
//   - not built yet  -> the name is rewritten (the provisioning job also does this by itself)
//   - already built  -> the PostgreSQL schema is renamed (ALTER SCHEMA ... RENAME) and the school record updated, in ONE transaction
// It never drops anything and never touches a school whose target name is already taken by a different school/schema.
//
//   npm run repair:schema-names:dry-run     shows what would change
//   npm run repair:schema-names             does it (then restart the API so cached connections drop the old name)
import { Pool } from "pg";
import { env } from "../src/config/env";
import { isValidSchemaName, schemaNameFor } from "../src/shared/utils/schema-name";

const DRY_RUN = process.argv.includes("--dry-run");
const q = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

async function main() {
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    const client = await pool.connect();
    let fixed = 0, skipped = 0;
    try {
        const { rows } = await client.query<{ id: string; subdomain: string; schemaName: string | null; schemaProvisionedAt: Date | null }>(
            `SELECT id, subdomain, "schemaName", "schemaProvisionedAt" FROM "School" ORDER BY "createdAt"`);
        for (const s of rows) {
            if (isValidSchemaName(s.schemaName)) continue;
            const target = schemaNameFor(s.subdomain);
            const label = `${s.subdomain}: "${s.schemaName ?? "(none)"}" -> ${target}`;

            const taken = await client.query(`SELECT 1 FROM "School" WHERE "schemaName" = $1 AND id <> $2`, [target, s.id]);
            if (taken.rowCount) { console.log(`⚠️  skipped (name used by another school) ${label}`); skipped++; continue; }

            const oldExists = s.schemaName
                ? (await client.query(`SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`, [s.schemaName])).rowCount! > 0 : false;
            const targetExists = (await client.query(`SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`, [target])).rowCount! > 0;
            if (oldExists && targetExists) { console.log(`⚠️  skipped (both schemas exist, resolve by hand) ${label}`); skipped++; continue; }

            console.log(`${DRY_RUN ? "• would fix" : "• fixing"} ${label}${oldExists ? " (renames the schema)" : ""}`);
            if (DRY_RUN) { fixed++; continue; }
            try {
                await client.query("BEGIN");
                if (oldExists) await client.query(`ALTER SCHEMA ${q(s.schemaName!)} RENAME TO ${q(target)}`);
                await client.query(`UPDATE "School" SET "schemaName" = $1 WHERE id = $2`, [target, s.id]);
                await client.query("COMMIT");
                fixed++;
            } catch (err) {
                await client.query("ROLLBACK");
                console.error(`❌ ${label}:`, err instanceof Error ? err.message : err);
                skipped++;
            }
        }
        console.log(`\n${DRY_RUN ? "Would fix" : "Fixed"} ${fixed}, skipped ${skipped}.${!DRY_RUN && fixed ? " Restart the API." : ""}`);
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(err => { console.error(err); process.exit(1); });
