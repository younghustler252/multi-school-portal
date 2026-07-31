import { Worker, Job } from "bullmq";
import { Pool } from "pg";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { redisConnection } from "../connection";
import { ProvisionSchemaJobData } from "../queues/provision-schema.queue";
import { prisma } from "../../database/prisma/prisma.client";

function getDefaultClasses(category?: string | null): Array<{ name: string; level: string }> {
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

    return secondary;
}

function getDefaultSubjects(category?: string | null): Array<{ name: string; code: string }> {
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

const SCHEMA_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

async function applyTenantMigrations(pool: Pool, schemaName: string): Promise<void> {
    const client = await pool.connect();

    try {
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
        await client.query(`SET search_path TO "${schemaName}"`);

        const tenantMigrationsDir = join(process.cwd(), "prisma", "tenant-migrations");
        const migrations = readdirSync(tenantMigrationsDir, { withFileTypes: true })
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name)
            .sort();

        for (const migration of migrations) {
            const sqlPath = join(tenantMigrationsDir, migration, "migration.sql");
            const sql = readFileSync(sqlPath, "utf8");

            await client.query("BEGIN");
            await client.query(`SET search_path TO "${schemaName}"`);
            await client.query(sql);
            await client.query("COMMIT");
        }
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        await client.query("SET search_path TO public");
        client.release();
    }
}

export const provisionSchemaWorker = new Worker<ProvisionSchemaJobData>(
    "provision-schema",

    async (job: Job<ProvisionSchemaJobData>) => {
        const { schoolId, subdomain, schoolName } = job.data;
        const schemaName = `school_${subdomain}`;

        if (!SCHEMA_NAME_PATTERN.test(schemaName)) {
            throw new Error(`Invalid schema name: ${schemaName}`);
        }

        console.log(`🏗️  Provisioning schema: ${schemaName} for ${schoolName}`);

        const pool = new Pool({ connectionString: process.env.TENANT_DATABASE_URL ?? process.env.DATABASE_URL });

        try {
            await applyTenantMigrations(pool, schemaName);
            console.log(`✅ Tables created: ${schemaName}`);

            const client = await pool.connect();
            try {
                await client.query(`SET search_path TO "${schemaName}"`);

                const gradingDefaults = [
                    { minScore: 75, maxScore: 100, grade: "A1", remark: "Excellent" },
                    { minScore: 70, maxScore: 74,  grade: "B2", remark: "Very Good" },
                    { minScore: 65, maxScore: 69,  grade: "B3", remark: "Good"      },
                    { minScore: 60, maxScore: 64,  grade: "C4", remark: "Credit"    },
                    { minScore: 55, maxScore: 59,  grade: "C5", remark: "Credit"    },
                    { minScore: 50, maxScore: 54,  grade: "C6", remark: "Credit"    },
                    { minScore: 45, maxScore: 49,  grade: "D7", remark: "Pass"      },
                    { minScore: 40, maxScore: 44,  grade: "E8", remark: "Pass"      },
                    { minScore: 0,  maxScore: 39,  grade: "F9", remark: "Fail"      },
                ];

                for (const g of gradingDefaults) {
                    await client.query(
                        `INSERT INTO "GradingConfig" (id, "minScore", "maxScore", grade, remark, "isDefault", "createdAt", "updatedAt")
                         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, now(), now())
                         ON CONFLICT DO NOTHING`,
                        [g.minScore, g.maxScore, g.grade, g.remark],
                    );
                }
                console.log(`✅ Grading config seeded: ${schemaName}`);

                const currentYear = new Date().getFullYear();
                const sessionName = `${currentYear}/${currentYear + 1}`;

                const sessionResult = await client.query(
                    `INSERT INTO "Session" (id, name, "startDate", "endDate", "isCurrent", "createdAt", "updatedAt")
                     VALUES (gen_random_uuid(), $1, $2, $3, true, now(), now())
                     RETURNING id`,
                    [sessionName, `${currentYear}-09-01`, `${currentYear + 1}-07-31`],
                );
                const sessionId = sessionResult.rows[0].id;

                const terms = [
                    { name: "first",  start: `${currentYear}-09-01`,     end: `${currentYear}-12-20`,     current: true  },
                    { name: "second", start: `${currentYear + 1}-01-10`, end: `${currentYear + 1}-04-10`, current: false },
                    { name: "third",  start: `${currentYear + 1}-04-28`, end: `${currentYear + 1}-07-31`, current: false },
                ];

                for (const term of terms) {
                    await client.query(
                        `INSERT INTO "Term" (id, "sessionId", name, "startDate", "endDate", "isCurrent", "createdAt", "updatedAt")
                         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now(), now())`,
                        [sessionId, term.name, term.start, term.end, term.current],
                    );
                }
                console.log(`✅ Session + terms seeded: ${schemaName}`);

                const school = await prisma.school.findUnique({
                    where:  { id: schoolId },
                    select: { schoolCategory: true },
                });

                for (const cls of getDefaultClasses(school?.schoolCategory)) {
                    await client.query(
                        `INSERT INTO "Class" (id, name, level, "createdAt", "updatedAt")
                         VALUES (gen_random_uuid(), $1, $2, now(), now())`,
                        [cls.name, cls.level],
                    );
                }

                for (const subject of getDefaultSubjects(school?.schoolCategory)) {
                    await client.query(
                        `INSERT INTO "Subject" (id, name, code, "createdAt", "updatedAt")
                         VALUES (gen_random_uuid(), $1, $2, now(), now())`,
                        [subject.name, subject.code],
                    );
                }
                console.log(`✅ Classes + subjects seeded: ${schemaName}`);
            } finally {
                await client.query("SET search_path TO public");
                client.release();
            }
        } finally {
            await pool.end();
        }

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