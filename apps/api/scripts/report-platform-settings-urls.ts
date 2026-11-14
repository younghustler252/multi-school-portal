// scripts/report-platform-settings-urls.ts
//
// READ-ONLY. Checks the platform logo and the terms / privacy links that are stored today against the current rules:
//   - logo: must be a file we uploaded (our public bucket, platform/logos). An older typed-in link is listed so it can be
//     re-uploaded (Super Admin -> Settings -> upload logo); until then the API shows no logo for it if it is not http(s).
//   - terms / privacy links: must be https, with no login inside, and not too long.
// It changes nothing: what to do about a value (fix it, re-upload, clear it) is a decision for a person.
//
//   npm run report:platform-settings-urls
import { Pool } from "pg";
import { env } from "../src/config/env";
import { platformLogoPathOf } from "../src/modules/platform-settings/usecases/platform-logo.usecases";
import { isHttpsUrl } from "../src/shared/utils/safe-url";

async function main() {
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    try {
        const { rows } = await pool.query<{ id: string; logoUrl: string | null; termsUrl: string | null; privacyPolicyUrl: string | null }>(
            `SELECT id, "logoUrl", "termsUrl", "privacyPolicyUrl" FROM "PlatformSettings"`);
        if (rows.length === 0) { console.log(" No platform settings row yet: nothing to check."); return; }

        const problems: string[] = [];
        for (const r of rows) {
            if (r.logoUrl && !platformLogoPathOf(r.logoUrl)) problems.push(`logo is not one of our uploads (re-upload it): ${r.logoUrl.slice(0, 120)}`);
            if (r.termsUrl && !isHttpsUrl(r.termsUrl)) problems.push(`terms link is not a valid https link: ${r.termsUrl.slice(0, 120)}`);
            if (r.privacyPolicyUrl && !isHttpsUrl(r.privacyPolicyUrl)) problems.push(`privacy link is not a valid https link: ${r.privacyPolicyUrl.slice(0, 120)}`);
        }
        if (problems.length === 0) { console.log(" The stored logo and legal links already follow the rules."); return; }
        console.log(` ${problems.length} stored value(s) need attention:`);
        for (const p of problems) console.log(`  - ${p}`);
        process.exitCode = 1;
    } finally { await pool.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
