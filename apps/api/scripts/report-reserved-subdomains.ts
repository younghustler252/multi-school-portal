// scripts/report-reserved-subdomains.ts
//
// READ-ONLY. Lists schools whose subdomain is reserved today (built-in list, ADMIN_SUBDOMAIN, RESERVED_SUBDOMAINS_EXTRA).
// New registrations are blocked already; this finds schools created before a label was reserved. It changes nothing:
// what to do about one (rename it, contact the school) is a decision for a person.
//
//   npm run report:reserved-subdomains
import { Pool } from "pg";
import { env } from "../src/config/env";
import { isReservedSubdomain } from "../src/shared/utils/subdomain";

async function main() {
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    try {
        const { rows } = await pool.query<{ id: string; name: string; subdomain: string; status: string }>(
            `SELECT id, name, subdomain, status FROM "School" ORDER BY "createdAt"`);
        const clashes = rows.filter((s) => isReservedSubdomain(s.subdomain));
        if (clashes.length === 0) { console.log(`✓ None of the ${rows.length} school(s) uses a reserved subdomain.`); return; }
        console.log(`⚠ ${clashes.length} school(s) use a reserved subdomain:`);
        for (const s of clashes) console.log(`  - ${s.subdomain}  (${s.name}, status ${s.status}, id ${s.id})`);
        process.exitCode = 1;
    } finally { await pool.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
