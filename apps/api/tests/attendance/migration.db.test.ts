/*
| The attendance migration on a school that ALREADY has attendance: every earlier tenant migration applied, old rows saved,
| then ONLY the new migration. Old rows must keep everything they had; the new columns start empty (history is never invented).
| Runs only when TEST_DATABASE_URL is set (database name must contain "test").
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { dbTestsEnabled, skipReason, testDatabaseUrl } from "../helpers/test-database";

const NEW = "20261102090000_attendance_register";

describe("attendance migration on a populated school", { skip: dbTestsEnabled ? false : skipReason }, () => {
    const schema = `test_att_mig_${randomBytes(4).toString("hex")}`;
    let pool: Pool; let c: any;
    const dir = join(process.cwd(), "prisma", "tenant-migrations");
    const all = readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
    const sql = (m: string) => readFileSync(join(dir, m, "migration.sql"), "utf8");
    const one = async (q: string, p: unknown[] = []) => (await c.query(q, p)).rows[0];
    const created = new Date("2026-03-05T09:30:00Z");

    before(async () => {
        pool = new Pool({ connectionString: testDatabaseUrl, max: 1 }); c = await pool.connect();
        await c.query(`CREATE SCHEMA "${schema}"`); await c.query(`SET search_path TO "${schema}"`);
        for (const m of all.filter(m => m < NEW)) await c.query(sql(m));
        await c.query("SET session_replication_role = replica");     // seeding only: skip unrelated foreign keys
        await c.query(`INSERT INTO "Attendance"(id,"studentId","termId",date,status,note,"createdAt") VALUES
            ('a1','s1','t','2026-03-04 00:00:00','present',NULL,$1),
            ('a2','s2','t','2026-03-04 00:00:00','absent','sick',$1),
            ('a3','s1','t','2026-03-05 15:00:00','late',NULL,$1)`, [created]);     // a3: an old row saved with a clock time
        await c.query("SET session_replication_role = origin");
        await c.query(sql(NEW));
    });
    after(async () => { c.release(); await pool.end(); const p = new Pool({ connectionString: testDatabaseUrl, max: 1 }); await p.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await p.end(); });

    it("old rows keep everything they had; class and 'marked by' stay empty; updatedAt starts as createdAt", async () => {
        const rows = (await c.query(`SELECT * FROM "Attendance" ORDER BY id`)).rows;
        assert.equal(rows.length, 3);
        assert.deepEqual(rows.map((r: any) => [r.status, r.note]), [["present", null], ["absent", "sick"], ["late", null]]);
        assert.ok(rows.every((r: any) => r.classId === null && r.markedById === null));
        assert.ok(rows.every((r: any) => r.updatedAt.getTime() === created.getTime()));
        assert.equal(rows[2].date.toISOString(), "2026-03-05T15:00:00.000Z", "old dates are not rewritten");
    });
    it("one record per student per day still holds, and the new indexes and the class link exist", async () => {
        await assert.rejects(() => c.query(`INSERT INTO "Attendance"(id,"studentId","termId",date,status,"updatedAt") VALUES ('dup','s1','t','2026-03-04 00:00:00','absent',now())`), /unique|duplicate/i);
        for (const i of ["Attendance_classId_date_idx", "Attendance_termId_date_idx"])
            assert.equal((await one(`SELECT count(*)::int n FROM pg_indexes WHERE schemaname=$1 AND indexname=$2`, [schema, i])).n, 1, i);
        assert.equal((await one(`SELECT count(*)::int n FROM information_schema.table_constraints WHERE constraint_schema=$1 AND constraint_name='Attendance_classId_fkey'`, [schema])).n, 1);
    });
});
