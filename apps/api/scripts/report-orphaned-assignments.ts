// scripts/report-orphaned-assignments.ts
//
// READ-ONLY. For every school: which class and subject assignments still point at staff who have been deactivated
// (a teacher who left), and so need a new teacher. Nothing is changed (each school is read in a READ ONLY transaction).
// Run it before the handover feature is switched on, so nobody is surprised by what is already there.
//
//   npm run report:orphaned-assignments [-- --json path/to/report.json]
//
// Outstanding = a class they lead; a subject assignment in the current or a future term whose mark sheet is NOT published
// or locked; a subject whose default teacher they are. Finished (published/locked) sheets are listed as "no action needed".
// Past terms are history: only counted, never listed.
import { writeFileSync } from "node:fs";
import { Pool } from "pg";
import { env } from "../src/config/env";
import { prisma } from "../src/infrastructure/database/prisma/prisma.client";
import { loadOutstandingHandover, type HandoverReport } from "../src/modules/classes/services/handover.read-model";

const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
const jsonAt = process.argv.indexOf("--json");
const JSON_PATH = jsonAt > -1 ? process.argv[jsonAt + 1] : null;

async function main() {
    console.log("Teacher handover: assignments that still point at deactivated staff (READ ONLY)");
    const schools = await prisma.school.findMany({ where: { schemaProvisionedAt: { not: null } }, select: { id: true, name: true, schemaName: true } });
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    const all: { school: string; report: HandoverReport }[] = [];
    let failed = 0;

    for (const school of schools) {
        if (!school.schemaName) continue;
        const client = await pool.connect();
        try {
            await client.query("BEGIN READ ONLY");
            await client.query(`SET LOCAL search_path TO ${quote(school.schemaName)}`);
            const report = await loadOutstandingHandover(client);
            await client.query("ROLLBACK");
            all.push({ school: school.name, report });
            const t = report.totals;
            console.log(`${t.teachersNeedingAttention ? "!" : " "} ${school.name}: ${t.teachersNeedingAttention} teacher(s) to hand over, ${t.classesLed} class(es) led, ${t.outstandingSubjects} subject assignment(s) outstanding, ${t.defaultsToUpdate} default(s) to update, ${t.completedSubjects} finished (no action)`);
            for (const x of report.teachers) {
                console.log(`     ${x.staff.name} (${x.staff.category}, left ${x.staff.exitDate ?? "date not recorded"}${x.staff.exitReason ? `: ${x.staff.exitReason}` : ""})`);
                for (const c of x.classesLed) console.log(`        leads ${c.className}`);
                for (const s of x.outstandingSubjects) console.log(`        teaches ${s.subjectName} in ${s.className} (${s.termName}${s.isCurrentTerm ? ", current" : ", upcoming"}; sheet: ${s.sheetStatus ?? "not started"})`);
                for (const s of x.completedSubjects) console.log(`        finished: ${s.subjectName} in ${s.className} (${s.termName}; sheet ${s.sheetStatus})`);
                for (const d of x.defaultsToUpdate) console.log(`        default teacher of ${d.subjectName}`);
                if (x.pastTermAssignments) console.log(`        (${x.pastTermAssignments} past-term assignment(s): history, untouched)`);
            }
        } catch (err) {
            failed++;
            await client.query("ROLLBACK").catch(() => undefined);
            console.error(` ${school.name} failed:`, (err as Error).message);
        } finally { client.release(); }
    }

    const sum = (f: (r: HandoverReport) => number) => all.reduce((n, x) => n + f(x.report), 0);
    console.log(`\n${all.filter(x => x.report.totals.teachersNeedingAttention).length} of ${schools.length} school(s) have a handover outstanding: ` +
        `${sum(r => r.totals.teachersNeedingAttention)} teacher(s), ${sum(r => r.totals.classesLed)} class(es) led, ${sum(r => r.totals.outstandingSubjects)} subject assignment(s), ${sum(r => r.totals.defaultsToUpdate)} default(s).` +
        (failed ? `\n${failed} school(s) could not be read.` : ""));
    if (JSON_PATH) { writeFileSync(JSON_PATH, JSON.stringify(all, null, 2)); console.log(`Wrote ${JSON_PATH}`); }
    await pool.end();
    await prisma.$disconnect();
    if (failed) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(1); });
