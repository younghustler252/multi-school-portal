// scripts/sync-school-roles.ts
// Usage: npm run sync:school-roles [-- --dry-run] [-- --prune]
import { env } from "../src/config/env";
import { Pool } from "pg";
import { prisma } from "../src/infrastructure/database/prisma/prisma.client";
import { loadTemplateViews, syncSchoolRoles } from "../src/foundation/sync-school-roles";

const DRY_RUN = process.argv.includes("--dry-run");
const PRUNE   = process.argv.includes("--prune");
const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;

async function main() {
    console.log(`School role sync${DRY_RUN ? " (DRY RUN: nothing is written)" : ""}${PRUNE ? " (prune on)" : ""}`);
    const templates = await loadTemplateViews(prisma);
    const schools = await prisma.school.findMany({
        where:  { schemaProvisionedAt: { not: null } },
        select: { name: true, schemaName: true },
    });

    const pool = new Pool({ connectionString: env.DATABASE_URL });
    let failed = 0;
    const customised: string[] = [];

    for (const school of schools) {
        if (!school.schemaName) continue;
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(`SET LOCAL search_path TO ${quote(school.schemaName)}`);
            const r = await syncSchoolRoles(client, templates, { prune: PRUNE, dryRun: DRY_RUN });
            await client.query(DRY_RUN ? "ROLLBACK" : "COMMIT");

            const changed = r.updated.length + r.versionOnly.length;
            console.log(`${changed ? "✅" : "⏭️ "} ${school.name}: ${r.updated.length} updated, ${r.versionOnly.length} version-only, ${r.unchanged} unchanged, ${r.skipped.length} skipped`);
            for (const u of r.updated) console.log(`     ${u.role}: +${u.added} ~${u.rescoped} -${u.removed}${u.grantsAll === null ? "" : ` grantsAll→${u.grantsAll}`}`);
            for (const s of r.skipped) if (s.reason === "customised") customised.push(`${school.name} / ${s.role}`);
            else if (s.reason !== "custom_role") console.log(`     skipped ${s.role} (${s.reason})`);
        } catch (err) {
            failed++;
            await client.query("ROLLBACK").catch(() => undefined);
            console.error(`❌ ${school.name} failed:`, (err as Error).message);
        } finally {
            client.release();
        }
    }

    if (customised.length) console.log(`\nCustomised roles left alone (add permissions by hand):\n - ${customised.join("\n - ")}`);
    await pool.end();
    process.exit(failed ? 1 : 0);
}

main();
