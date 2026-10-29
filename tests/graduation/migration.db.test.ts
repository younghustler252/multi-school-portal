/*
| The graduation migration on a school that ALREADY has data: every earlier tenant migration applied, students in
| several states, then ONLY the new migration. Nothing may change except the two new empty columns.
| (The existing-school runner was also run for real against populated schools: see docs/GRADUATION_NOTES.md.)
| Runs only when TEST_DATABASE_URL is set (database name must contain "test").
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { dbTestsEnabled, skipReason, testDatabaseUrl } from "../helpers/test-database";

const NEW = "20261031090000_student_graduation";

describe("graduation migration on a populated school", { skip: dbTestsEnabled ? false : skipReason }, () => {
    const schema = `test_grad_mig_${randomBytes(4).toString("hex")}`;
    let pool: Pool; let c: any;
    const dir = join(process.cwd(), "prisma", "tenant-migrations");
    const all = readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
    const sql = (m: string) => readFileSync(join(dir, m, "migration.sql"), "utf8");
    const one = async (q: string, p: unknown[] = []) => (await c.query(q, p)).rows[0];

    before(async () => {
        pool = new Pool({ connectionString: testDatabaseUrl, max: 1 }); c = await pool.connect();
        await c.query(`CREATE SCHEMA "${schema}"`); await c.query(`SET search_path TO "${schema}"`);
        for (const m of all.filter(m => m < NEW)) await c.query(sql(m));
        await c.query("SET session_replication_role = replica");     // seeding only: skip unrelated foreign keys
        const now = new Date();
        for (const [id, active] of [["s1", true], ["s2", true], ["s3", false], ["s4", true]] as const)
            await c.query(`INSERT INTO "Student"(id,"firstName","lastName","isActive","updatedAt") VALUES ($1,'N','T',$2,$3)`, [id, active, now]);
        // s4 looks like a past graduate (completed enrolment in a final class). It must NOT be inferred.
        await c.query(`INSERT INTO "Enrolment"(id,"studentId","classId","termId",status,"updatedAt") VALUES ('e1','s4','c','t','completed',$1),('e2','s1','c','t','active',$1)`, [now]);
        await c.query("SET session_replication_role = origin");
        await c.query(sql(NEW));
    });
    after(async () => { c.release(); await pool.end(); const p = new Pool({ connectionString: testDatabaseUrl, max: 1 }); await p.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await p.end(); });

    it("existing rows are untouched and nobody is marked graduated", async () => {
        assert.equal((await one(`SELECT count(*)::int n FROM "Student"`)).n, 4);
        assert.equal((await one(`SELECT count(*)::int n FROM "Enrolment"`)).n, 2);
        assert.equal((await one(`SELECT count(*)::int n FROM "Student" WHERE "graduatedAt" IS NOT NULL OR "graduatedTermId" IS NOT NULL`)).n, 0);
        assert.equal((await one(`SELECT count(*)::int n FROM "Student" WHERE "isActive"`)).n, 3, "isActive is unchanged");
    });
    it("the plan count is exactly what it was before (active and not graduated)", async () => {
        assert.equal((await one(`SELECT count(*)::int n FROM "Student" WHERE "isActive" AND "graduatedAt" IS NULL`)).n, 3);
    });
    it("the columns, the pairing rule and the index exist", async () => {
        assert.equal((await one(`SELECT count(*)::int n FROM information_schema.columns WHERE table_schema=$1 AND table_name='Student' AND column_name IN ('graduatedAt','graduatedTermId')`, [schema])).n, 2);
        await assert.rejects(() => c.query(`UPDATE "Student" SET "graduatedAt" = now() WHERE id = 's1'`), /Student_graduation_pair_check/);
        await c.query(`UPDATE "Student" SET "graduatedAt" = now(), "graduatedTermId" = 't' WHERE id = 's4'`);   // marking by hand is possible, with both
        assert.equal((await one(`SELECT count(*)::int n FROM pg_indexes WHERE schemaname=$1 AND indexname='Student_graduatedAt_idx'`, [schema])).n, 1);
    });
});
