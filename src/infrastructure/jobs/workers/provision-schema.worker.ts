import { Worker, Job }            from "bullmq";
import { redisConnection }        from "../connection";
import { ProvisionSchemaJobData } from "../queues/provision-schema.queue";
import { prisma }                 from "../../database/prisma/prisma.client";
import { execSync }               from "child_process";
import { readFileSync }           from "fs";
import { join }                   from "path";

function getDefaultClasses(category?: string | null): Array<{name: string; level: string}> {
    if (category === "primary" || category === "primary_secondary") {
        return [
            { name: "KG 1",      level: "Kindergarten" },
            { name: "KG 2",      level: "Kindergarten" },
            { name: "Primary 1", level: "Primary"      },
            { name: "Primary 2", level: "Primary"      },
            { name: "Primary 3", level: "Primary"      },
            { name: "Primary 4", level: "Primary"      },
            { name: "Primary 5", level: "Primary"      },
            { name: "Primary 6", level: "Primary"      },
        ];
    }

    const secondary = [
        { name: "JSS 1", level: "Junior Secondary" },
        { name: "JSS 2", level: "Junior Secondary" },
        { name: "JSS 3", level: "Junior Secondary" },
        { name: "SS 1",  level: "Senior Secondary" },
        { name: "SS 2",  level: "Senior Secondary" },
        { name: "SS 3",  level: "Senior Secondary" },
    ];

    if (category === "primary_secondary") {
        // Already added primary above, just add secondary
        return secondary;
    }

    return secondary; // default to secondary
}

function getDefaultSubjects(category?: string | null): Array<{name: string; code: string}> {
    const coreSubjects = [
        { name: "Mathematics",        code: "MTH" },
        { name: "English Language",   code: "ENG" },
        { name: "Basic Science",      code: "BSC" },
        { name: "Social Studies",     code: "SST" },
        { name: "Civic Education",    code: "CIV" },
        { name: "Computer Science",   code: "CMP" },
        { name: "Physical Education", code: "PHE" },
        { name: "Fine Arts",          code: "ART" },
        { name: "Music",              code: "MUS" },
    ];

    const primaryOnly = [
        { name: "Quantitative Reasoning", code: "QNR" },
        { name: "Verbal Reasoning",       code: "VBR" },
        { name: "Phonics",                code: "PHN" },
        { name: "National Values",        code: "NVE" },
    ];

    const secondaryOnly = [
        { name: "Physics",          code: "PHY" },
        { name: "Chemistry",        code: "CHM" },
        { name: "Biology",          code: "BIO" },
        { name: "Economics",        code: "ECO" },
        { name: "Government",       code: "GOV" },
        { name: "Literature",       code: "LIT" },
        { name: "Geography",        code: "GEO" },
        { name: "Agricultural Sc.", code: "AGR" },
        { name: "Further Maths",    code: "FMT" },
        { name: "French",           code: "FRN" },
        { name: "Yoruba",           code: "YRB" },
        { name: "Igbo",             code: "IGB" },
        { name: "Hausa",            code: "HAU" },
    ];

    if (category === "primary") {
        return [...coreSubjects, ...primaryOnly];
    }

    if (category === "primary_secondary") {
        return [...coreSubjects, ...primaryOnly, ...secondaryOnly];
    }

    return [...coreSubjects, ...secondaryOnly];
}

export const provisionSchemaWorker = new Worker<ProvisionSchemaJobData>(
    "provision-schema",

    async (job: Job<ProvisionSchemaJobData>) => {
        const { schoolId, subdomain, schoolName } = job.data;
        const schemaName = `school_${subdomain}`;

        console.log(`🏗️  Provisioning schema: ${schemaName} for ${schoolName}`);

        // ── 1. Create schema ──────────────────────────────────────────────
        await prisma.$executeRawUnsafe(
            `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,
        );
        console.log(`✅ Schema created: ${schemaName}`);

        // ── 2. Apply baseline SQL to new schema ───────────────────────────
        const baselineSql = readFileSync(
            join(process.cwd(), "prisma/tenant/baseline.sql"),
            "utf8",
        );

        // Split by statement and execute each one
        const statements = baselineSql
            .split(";")
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            await prisma.$executeRawUnsafe(
                `SET search_path TO "${schemaName}"; ${statement}`,
            );
        }
        console.log(`✅ Tables created: ${schemaName}`);

        // ── 3. Seed default grading config ────────────────────────────────
        const gradingDefaults = [
            { minScore: 75, maxScore: 100, grade: "A1", remark: "Excellent"  },
            { minScore: 70, maxScore: 74,  grade: "B2", remark: "Very Good"  },
            { minScore: 65, maxScore: 69,  grade: "B3", remark: "Good"       },
            { minScore: 60, maxScore: 64,  grade: "C4", remark: "Credit"     },
            { minScore: 55, maxScore: 59,  grade: "C5", remark: "Credit"     },
            { minScore: 50, maxScore: 54,  grade: "C6", remark: "Credit"     },
            { minScore: 45, maxScore: 49,  grade: "D7", remark: "Pass"       },
            { minScore: 40, maxScore: 44,  grade: "E8", remark: "Pass"       },
            { minScore: 0,  maxScore: 39,  grade: "F9", remark: "Fail"       },
        ];

        for (const g of gradingDefaults) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO "${schemaName}"."GradingConfig"
                    (id, "minScore", "maxScore", grade, remark, "isDefault", "createdAt", "updatedAt")
                VALUES (
                    gen_random_uuid(),
                    ${g.minScore}, ${g.maxScore},
                    '${g.grade}', '${g.remark}',
                    true, now(), now()
                )
                ON CONFLICT DO NOTHING
            `);
        }
        console.log(`✅ Grading config seeded: ${schemaName}`);

        // ── 4. Seed default session + terms ───────────────────────────────
        const currentYear = new Date().getFullYear();
        const sessionName = `${currentYear}/${currentYear + 1}`;
        const sessionId   = require("crypto").randomUUID();

        await prisma.$executeRawUnsafe(`
            INSERT INTO "${schemaName}"."Session"
                (id, name, "startDate", "endDate", "isCurrent", "createdAt", "updatedAt")
            VALUES (
                '${sessionId}', '${sessionName}',
                '${currentYear}-09-01', '${currentYear + 1}-07-31',
                true, now(), now()
            )
        `);

        const terms = [
            { name: "first",  start: `${currentYear}-09-01`,     end: `${currentYear}-12-20`,     current: true  },
            { name: "second", start: `${currentYear + 1}-01-10`, end: `${currentYear + 1}-04-10`, current: false },
            { name: "third",  start: `${currentYear + 1}-04-28`, end: `${currentYear + 1}-07-31`, current: false },
        ];

        for (const term of terms) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO "${schemaName}"."Term"
                    (id, "sessionId", name, "startDate", "endDate", "isCurrent", "createdAt", "updatedAt")
                VALUES (
                    gen_random_uuid(), '${sessionId}', '${term.name}',
                    '${term.start}', '${term.end}',
                    ${term.current}, now(), now()
                )
            `);
        }
        console.log(`✅ Session + terms seeded: ${schemaName}`);

        // After seeding grading config and session/terms
        // ── Seed classes based on school category ─────────────────────────────

        // Get school category from public schema
        const school = await prisma.school.findUnique({
            where:  { id: schoolId },
            select: { schoolCategory: true },
        });

        const classesToCreate = getDefaultClasses(school?.schoolCategory);

        for (const cls of classesToCreate) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO "${schemaName}"."Class"
                    (id, name, level, "createdAt", "updatedAt")
                VALUES (
                    gen_random_uuid(),
                    '${cls.name}',
                    '${cls.level}',
                    now(), now()
                )
            `);
        }

        // ── Seed default subjects ──────────────────────────────────────────────
        const subjectsToCreate = getDefaultSubjects(school?.schoolCategory);

        for (const subject of subjectsToCreate) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO "${schemaName}"."Subject"
                    (id, name, code, "createdAt", "updatedAt")
                VALUES (
                    gen_random_uuid(),
                    '${subject.name}',
                    '${subject.code}',
                    now(), now()
                )
            `);
        }

        // ── 5. Update school schemaName ───────────────────────────────────
        await prisma.school.update({
            where: { id: schoolId },
            data:  { schemaName },
        });

        console.log(`🎉 Provisioning complete: ${schemaName}`);
        return { schemaName, status: "completed" };
    },

    { connection: redisConnection, concurrency: 2 },
);

provisionSchemaWorker.on("completed", (job) => {
    console.log(`✅ Provision job ${job.id} completed`);
});

provisionSchemaWorker.on("failed", (job, err) => {
    console.error(`❌ Provision job ${job?.id} failed:`, err.message);
});

provisionSchemaWorker.on("error", (err) => {
    console.error("❌ Worker error:", err.message);
});