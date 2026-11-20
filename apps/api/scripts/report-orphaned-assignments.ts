// scripts/report-orphaned-assignments.ts
//
// READ-ONLY. For every school: which class and subject assignments still point at staff who have been deactivated
// (a teacher who left), and so need a new teacher. Nothing is changed (each school is read in a READ ONLY transaction).
// Run it before the handover feature is switched on, so nobody is surprised by what is already there.
//
//   npm run report:orphaned-assignments [-- --json path/to/report.json]
//
// Outstanding = a class they lead; a subject assignment in the current or an upcoming term whose mark sheet is NOT
// published or locked; a subject whose default teacher they are. Finished (published/locked) sheets are listed as
// "no action needed". Past terms are history: only counted, never listed.
// A school that cannot be read is reported and skipped; the others continue. Exit code 1 if any school failed.
import { writeFileSync } from "node:fs";
import { Pool } from "pg";
import { env } from "../src/config/env";
import { prisma } from "../src/infrastructure/database/prisma/prisma.client";
import { reportAcrossSchools, formatSchoolResult, parseReportArgs } from "../src/modules/classes/services/handover-report.runner";

async function main() {
    const { jsonPath } = parseReportArgs(process.argv.slice(2));
    console.log("Teacher handover: assignments that still point at deactivated staff (READ ONLY)");

    const schools = await prisma.school.findMany({ where: { schemaProvisionedAt: { not: null } }, select: { id: true, name: true, schemaName: true, timezone: true } });
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    try {
        const r = await reportAcrossSchools({ schools, pool });
        for (const x of r.results) for (const line of formatSchoolResult(x)) console.log(line);
        for (const x of r.skipped) console.log(`  ${x.school}: skipped (${x.reason})`);
        for (const x of r.failures) console.error(` ${x.school} could not be read: ${x.error}`);

        const s = r.summary;
        console.log(`\n${s.schoolsWithHandover} of ${s.schoolsRead} school(s) read have a handover outstanding: ${s.teachers} teacher(s), ${s.classesLed} class(es) led, ${s.outstandingSubjects} subject assignment(s), ${s.defaultsToUpdate} default(s).`);
        if (s.schoolsFailed || s.schoolsSkipped) console.log(`${s.schoolsFailed} school(s) could not be read; ${s.schoolsSkipped} skipped.`);
        if (jsonPath) { writeFileSync(jsonPath, JSON.stringify(r, null, 2)); console.log(`Wrote ${jsonPath}`); }
        if (s.schoolsFailed) process.exitCode = 1;
    } finally {
        await pool.end();
        await prisma.$disconnect();
    }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
