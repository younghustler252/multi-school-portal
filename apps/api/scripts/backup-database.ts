// scripts/backup-database.ts
import { env } from "../src/config/env"
import { execSync } from "child_process";
import { join } from "path";

function backup(label: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = join(process.cwd(), "backups", `${label}-${timestamp}.sql`);

    execSync(`pg_dump "${env.DATABASE_URL}" -F c -f "${filename}"`, { stdio: "inherit" });
    console.log(`✅ Backup saved: ${filename}`);
}

backup(process.argv[2] ?? "manual");