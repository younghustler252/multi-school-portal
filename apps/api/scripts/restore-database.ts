// scripts/restore-database.ts
import { execSync } from "child_process";
import { env } from "../src/config/env";

const backupFile = process.argv[2];
if (!backupFile) {
    console.error("Usage: npm run db:restore -- <path-to-backup-file>");
    process.exit(1);
}

console.log(`⚠️  This will REPLACE the current database with: ${backupFile}`);
console.log(`⚠️  Target: ${env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@")}`); // mask password in log
console.log("Press Ctrl+C now to cancel, or wait 5 seconds to proceed...");

setTimeout(() => {
    execSync(`pg_restore --clean --if-exists -d "${env.DATABASE_URL}" "${backupFile}"`, { stdio: "inherit" });
    console.log("✅ Restore complete");
}, 5000);