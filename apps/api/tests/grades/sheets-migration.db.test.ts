/*
| The mark-sheet migration on schools that ALREADY have grades: every earlier migration applied, old grades saved, then ONLY
| the new migration. Old grades become sheets and per-part scores; anything that cannot be converted exactly STOPS the
| migration with a clear message (nothing is guessed). Runs only when TEST_DATABASE_URL is set (database name has "test").
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { dbTestsEnabled, skipReason, testDatabaseUrl } from "../helpers/test-database";

const NEW = "20261104090000_grades_sheets";
type G = { id: string; cs: string; term?: string; ca: number | null; ex: number | null; pub: boolean };

describe("mark sheet migration on populated schools", { skip: dbTestsEnabled ? false : skipReason }, () => {
    const tag = randomBytes(3).toString("hex"); const schemas: string[] = [];
    let pool: Pool; let c: any;
    const dir = join(process.cwd(), "prisma", "tenant-migrations");
    const all = readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
    const sql = (m: string) => readFileSync(join(dir, m, "migration.sql"), "utf8");

    async function school(name: string, grades: G[], beforeMigrating?: () => Promise<void>) {
        const schema = `test_gsh_${name}_${tag}`; schemas.push(schema);
        await c.query(`CREATE SCHEMA "${schema}"`); await c.query(`SET search_path TO "${schema}"`);
        for (const m of all.filter(m => m < NEW)) await c.query(sql(m));
        await c.query("SET session_replication_role = replica");          // seeding only: skip unrelated foreign keys
        for (const cs of ["cs1", "cs2", "cs3"]) await c.query(`INSERT INTO "ClassSubject"(id,"classId","subjectId","staffId","termId","updatedAt") VALUES ($1,'c','subject-'||$1,'t','term1',now())`, [cs]);
        for (const t of ["term1", "term9"]) await c.query(`INSERT INTO "Term"(id,"sessionId",name,"startDate","endDate","updatedAt") VALUES ($1,'sess','first',now(),now(),now())`, [t]);
        for (const g of grades) await c.query(`INSERT INTO "Student"(id,"firstName","lastName","updatedAt") VALUES ($1,'N','T',now())`, ["stu-" + g.id]);
        for (const g of grades) await c.query(`INSERT INTO "Grade"(id,"studentId","termId","classSubjectId","caScore","examScore","isPublished","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,now())`, [g.id, "stu-" + g.id, g.term ?? "term1", g.cs, g.ca, g.ex, g.pub]);
        await c.query("SET session_replication_role = origin");
        if (beforeMigrating) await beforeMigrating();
        return { run: () => c.query(sql(NEW)) };
    }
    before(async () => { pool = new Pool({ connectionString: testDatabaseUrl, max: 1 }); c = await pool.connect(); });
    after(async () => { c.release(); const p = new Pool({ connectionString: testDatabaseUrl, max: 1 }); for (const s of schemas) await p.query(`DROP SCHEMA IF EXISTS "${s}" CASCADE`); await p.end(); await pool.end(); });

    it("a school with no grades: no sheets are made, and every future grade must belong to a sheet", async () => {
        const s = await school("none", []); await s.run();
        assert.equal((await c.query(`SELECT count(*)::int n FROM "ResultSheet"`)).rows[0].n, 0);
        assert.equal((await c.query(`SELECT is_nullable FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='Grade' AND column_name='sheetId'`)).rows[0].is_nullable, "NO");
    });

    it("existing grades become sheets and per-part scores: published only if EVERY grade was published, otherwise draft and hidden", async () => {
        const s = await school("ok", [
            { id: "g1", cs: "cs1", ca: 30, ex: 55, pub: true }, { id: "g2", cs: "cs1", ca: 20, ex: null, pub: true },
            { id: "g3", cs: "cs2", ca: 35, ex: 50, pub: true }, { id: "g4", cs: "cs2", ca: 10, ex: 20, pub: false },
        ]); await s.run();
        const sheets = (await c.query(`SELECT "classSubjectId" cs, status::text s, components FROM "ResultSheet" ORDER BY 1`)).rows;
        assert.deepEqual(sheets.map((x: any) => [x.cs, x.s]), [["cs1", "published"], ["cs2", "draft"]]);
        assert.deepEqual(sheets[0].components.map((p: any) => [p.position, p.name, p.kind, p.maxScore]), [[1, "CA", "ca", 40], [2, "Exam", "exam", 60]]);
        const vis = (await c.query(`SELECT id, "isPublished" p FROM "Grade" ORDER BY id`)).rows;
        assert.deepEqual(vis.map((x: any) => [x.id, x.p]), [["g1", true], ["g2", true], ["g3", false], ["g4", false]], "a draft sheet's grades are not visible");
        const scores = (await c.query(`SELECT "gradeId" g, position p, score FROM "GradeScore" ORDER BY 1, 2`)).rows;
        assert.deepEqual(scores.map((x: any) => [x.g, x.p, x.score]), [["g1", 1, 30], ["g1", 2, 55], ["g2", 1, 20], ["g3", 1, 35], ["g3", 2, 50], ["g4", 1, 10], ["g4", 2, 20]]);
        assert.equal((await c.query(`SELECT count(*)::int n FROM "Grade" WHERE "sheetId" IS NULL`)).rows[0].n, 0);
    });

    it("a score above the default scheme's maximum stops the migration, saying how many", async () => {
        const s = await school("big", [{ id: "g1", cs: "cs1", ca: 70, ex: 20, pub: false }]);
        await assert.rejects(() => s.run(), /1 existing grades have a score above the maximum.*CA 40, exam 60/);
    });
    it("a grade whose term is not its class subject's term stops the migration", async () => {
        const s = await school("term", [{ id: "g1", cs: "cs1", term: "term9", ca: 10, ex: 10, pub: false }]);
        await assert.rejects(() => s.run(), /different term than their class subject/);
    });
    it("a customised default scheme (not one CA part and one exam part) stops the migration while grades exist", async () => {
        const s = await school("scheme", [{ id: "g1", cs: "cs1", ca: 10, ex: 10, pub: false }], async () => {
            await c.query(`DELETE FROM "AssessmentComponent"`);
            const id = (await c.query(`SELECT id FROM "AssessmentScheme" WHERE level IS NULL`)).rows[0].id;
            for (const [i, n, m] of [[1, "CA1", 20], [2, "CA2", 20], [3, "Exam", 60]] as const) await c.query(`INSERT INTO "AssessmentComponent"(id,"schemeId",name,kind,"maxScore",position) VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5)`, [id, n, n === "Exam" ? "exam" : "ca", m, i]);
        });
        await assert.rejects(() => s.run(), /one CA score and one exam score, but the default assessment scheme has 3 parts/);
    });
});
