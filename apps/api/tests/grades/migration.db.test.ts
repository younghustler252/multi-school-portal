/*
| The grades setup migration on schools that ALREADY have a grading list: every earlier migration applied, an old list saved,
| then ONLY the new migration. A usable list is copied across; an unusable or empty one is replaced by the standard scale.
| Runs only when TEST_DATABASE_URL is set (database name must contain "test").
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { dbTestsEnabled, skipReason, testDatabaseUrl } from "../helpers/test-database";

const NEW = "20261103090000_grades_setup";
type Old = [number, number, string, string];

describe("grades setup migration on populated schools", { skip: dbTestsEnabled ? false : skipReason }, () => {
    const tag = randomBytes(3).toString("hex"); const schemas: string[] = [];
    let pool: Pool; let c: any;
    const dir = join(process.cwd(), "prisma", "tenant-migrations");
    const all = readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
    const sql = (m: string) => readFileSync(join(dir, m, "migration.sql"), "utf8");

    async function migrated(name: string, old: Old[]) {
        const schema = `test_gs_${name}_${tag}`; schemas.push(schema);
        await c.query(`CREATE SCHEMA "${schema}"`); await c.query(`SET search_path TO "${schema}"`);
        for (const m of all.filter(m => m < NEW)) await c.query(sql(m));
        for (const [min, max, g, r] of old) await c.query(`INSERT INTO "GradingConfig"(id,"minScore","maxScore",grade,remark,"updatedAt") VALUES (gen_random_uuid()::text,$1,$2,$3,$4,now())`, [min, max, g, r]);
        await c.query(sql(NEW));
        const bands = (await c.query(`SELECT grade, "minScore" m, "isPass" p FROM "GradingBand" ORDER BY "minScore" DESC`)).rows;
        const parts = (await c.query(`SELECT name, kind::text k, "maxScore" m FROM "AssessmentComponent" ORDER BY position`)).rows;
        return { bands, parts };
    }
    before(async () => { pool = new Pool({ connectionString: testDatabaseUrl, max: 1 }); c = await pool.connect(); });
    after(async () => { c.release(); const p = new Pool({ connectionString: testDatabaseUrl, max: 1 }); for (const s of schemas) await p.query(`DROP SCHEMA IF EXISTS "${s}" CASCADE`); await p.end(); await pool.end(); });

    it("a new school (empty old list) gets the standard A1 to F9 scale and CA 40 + Exam 60", async () => {
        const r = await migrated("new", []);
        assert.deepEqual(r.bands.map((b: any) => b.grade), ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"]);
        assert.deepEqual(r.parts, [{ name: "CA", k: "ca", m: 40 }, { name: "Exam", k: "exam", m: 60 }]);
    });
    it("a usable old list is copied across, with pass from 40 up", async () => {
        const r = await migrated("ok", [[80, 100, "A", "Distinction"], [60, 79, "B", "Good"], [40, 59, "C", "Pass"], [0, 39, "F", "Fail"]]);
        assert.deepEqual(r.bands.map((b: any) => [b.grade, b.m, b.p]), [["A", 80, true], ["B", 60, true], ["C", 40, true], ["F", 0, false]]);
    });
    it("an unusable old list (does not start at 0, or repeats a start) is replaced by the standard scale, never guessed", async () => {
        const noZero = await migrated("nozero", [[30, 100, "A", "Top"], [10, 29, "B", "Low"]]);
        assert.equal(noZero.bands.length, 9); assert.equal(noZero.bands[0].grade, "A1");
        const dup = await migrated("dup", [[0, 50, "F", "Fail"], [0, 9, "G", "Dup"], [50, 100, "P", "Pass"]]);
        assert.equal(dup.bands.length, 9);
    });
});
