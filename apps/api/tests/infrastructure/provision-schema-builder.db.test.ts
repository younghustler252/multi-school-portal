/*
| Tenant provisioning against a REAL PostgreSQL (runs only when TEST_DATABASE_URL is set; the database name must contain "test").
|
| The bug this guards: provisioning ran every tenant migration and the role seeding in ONE transaction. Migration
| 20261017060643_add_branch_management does ALTER TYPE "PermissionScope" ADD VALUE 'BRANCH', and PostgreSQL refuses to
| use a new enum value in the transaction that added it ("unsafe use of new value"), so seeding a BRANCH-scoped
| permission failed and the whole school rolled back.
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { dbTestsEnabled, skipReason, testDatabaseUrl } from "../helpers/test-database";
import {
    applyTenantMigrations, inTransaction, isTenantSeeded, listTenantMigrations, TRACKING_TABLE,
} from "../../src/infrastructure/jobs/workers/tenant-schema-builder";

const REAL_DIR = join(process.cwd(), "prisma", "tenant-migrations");
const BRANCH_MIGRATION = "20261017060643_add_branch_management";

describe("tenant schema builder (real PostgreSQL)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let pool: Pool;
    const schemas: string[] = [];
    const newSchema = () => { const s = `test_prov_${randomBytes(4).toString("hex")}`; schemas.push(s); return s; };
    const connect = async () => (await pool.connect()) as any;
    const scratch: string[] = [];

    before(() => { pool = new Pool({ connectionString: testDatabaseUrl, max: 8 }); });
    after(async () => {
        for (const s of schemas) await pool.query(`DROP SCHEMA IF EXISTS "${s}" CASCADE`);
        await pool.end();
        for (const d of scratch) rmSync(d, { recursive: true, force: true });
    });

    const insertBranchScopedPermission = async (c: any) => {
        await c.query(`INSERT INTO "SchoolRole" (id, name, kind, persona, "grantsAll", "isCustomized", "updatedAt")
                       VALUES ('r1', 'Test role', 'SYSTEM_EDITABLE'::"RoleKind", 'STAFF'::"Persona", false, false, now())`);
        await c.query(`INSERT INTO "SchoolRolePermission" ("roleId", "permissionKey", scope) VALUES ('r1', 'attendance.view', 'BRANCH'::"PermissionScope")`);
    };

    it("documents the PostgreSQL rule: migrations and seeding in ONE transaction fail on the BRANCH enum value", async () => {
        const schema = newSchema(); const c = await connect();
        try {
            await c.query("BEGIN");
            await c.query(`CREATE SCHEMA "${schema}"`); await c.query(`SET search_path TO "${schema}"`);
            for (const m of listTenantMigrations(REAL_DIR)) await c.query((await import("node:fs")).readFileSync(join(REAL_DIR, m, "migration.sql"), "utf8"));
            await assert.rejects(() => insertBranchScopedPermission(c), /unsafe use of new value/i);
            await c.query("ROLLBACK");
        } finally { await c.query("SET search_path TO public"); c.release(); }
    });

    it("builds a school so a BRANCH-scoped permission can be seeded right after (the fix)", async () => {
        const schema = newSchema(); const c = await connect();
        try {
            const out = await applyTenantMigrations(c, schema, REAL_DIR);
            assert.equal(out.kind, "built");
            assert.equal(out.applied.length, listTenantMigrations(REAL_DIR).length);

            await inTransaction(c, () => insertBranchScopedPermission(c));     // the seeding step, as its own transaction
            assert.equal((await c.query(`SELECT scope FROM "SchoolRolePermission"`)).rows[0].scope, "BRANCH");
            assert.equal(await isTenantSeeded(c), true);
        } finally { await c.query("SET search_path TO public"); c.release(); }
    });

    it("tracks every migration, and a second run applies nothing", async () => {
        const schema = newSchema(); const c = await connect();
        try {
            await applyTenantMigrations(c, schema, REAL_DIR);
            const tracked = (await c.query(`SELECT name FROM "${TRACKING_TABLE}" ORDER BY name`)).rows.map((r: any) => r.name);
            assert.deepEqual(tracked, listTenantMigrations(REAL_DIR));
            assert.ok(tracked.includes(BRANCH_MIGRATION));

            const again = await applyTenantMigrations(c, schema, REAL_DIR);
            assert.deepEqual(again, { kind: "built", applied: [], alreadyApplied: tracked.length });
        } finally { await c.query("SET search_path TO public"); c.release(); }
    });

    it("an interrupted run keeps its schema and the retry applies only what is missing", async () => {
        const schema = newSchema(); const c = await connect();
        // A copy of the real migrations plus a last one that fails halfway: it creates a table, then errors
        const dir = mkdtempSync(join(tmpdir(), "tenant-mig-")); scratch.push(dir);
        cpSync(REAL_DIR, dir, { recursive: true });
        mkdirSync(join(dir, "99999999000000_broken"));
        writeFileSync(join(dir, "99999999000000_broken", "migration.sql"), `CREATE TABLE "HalfDone" (id TEXT); SELECT 1/0;`);
        try {
            await assert.rejects(() => applyTenantMigrations(c, schema, dir), /division by zero/i);

            // The real migrations are committed and tracked; the broken one left nothing behind
            const tracked = (await c.query(`SELECT name FROM "${TRACKING_TABLE}"`)).rows.map((r: any) => r.name);
            assert.equal(tracked.length, listTenantMigrations(REAL_DIR).length);
            assert.ok(!tracked.includes("99999999000000_broken"));
            assert.equal((await c.query(`SELECT to_regclass('"HalfDone"') AS t`)).rows[0].t, null, "a failed migration is rolled back whole");
            assert.equal((await c.query(`SELECT count(*)::int n FROM information_schema.schemata WHERE schema_name = $1`, [schema])).rows[0].n, 1, "the schema is kept");

            // Fix the migration and retry: only it is applied
            writeFileSync(join(dir, "99999999000000_broken", "migration.sql"), `CREATE TABLE "HalfDone" (id TEXT);`);
            const retry = await applyTenantMigrations(c, schema, dir);
            assert.deepEqual(retry.applied, ["99999999000000_broken"]);
            assert.equal((await c.query(`SELECT count(*)::int n FROM "${TRACKING_TABLE}"`)).rows[0].n, listTenantMigrations(dir).length);
        } finally { await c.query("SET search_path TO public"); c.release(); }
    });

    it("a failed seeding step rolls back as a whole, leaving the school unseeded so the retry seeds it", async () => {
        const schema = newSchema(); const c = await connect();
        try {
            await applyTenantMigrations(c, schema, REAL_DIR);
            await assert.rejects(() => inTransaction(c, async () => {
                await insertBranchScopedPermission(c);
                throw new Error("seeding blew up");
            }), /seeding blew up/);
            assert.equal(await isTenantSeeded(c), false);

            await inTransaction(c, () => insertBranchScopedPermission(c));
            assert.equal(await isTenantSeeded(c), true);
        } finally { await c.query("SET search_path TO public"); c.release(); }
    });

    it("an empty schema left by an interrupted run is continued, not treated as an error", async () => {
        const schema = newSchema(); const c = await connect();
        try {
            await c.query(`CREATE SCHEMA "${schema}"`);
            const out = await applyTenantMigrations(c, schema, REAL_DIR);
            assert.equal(out.kind, "built");
            assert.equal(out.applied.length, listTenantMigrations(REAL_DIR).length);
        } finally { await c.query("SET search_path TO public"); c.release(); }
    });

    it("a school built before tracking existed is left alone (never replayed)", async () => {
        const schema = newSchema(); const c = await connect();
        try {
            await c.query(`CREATE SCHEMA "${schema}"`); await c.query(`CREATE TABLE "${schema}"."Student" (id TEXT)`);
            const out = await applyTenantMigrations(c, schema, REAL_DIR);
            assert.equal(out.kind, "untracked-legacy");
            assert.equal((await c.query(`SELECT to_regclass('"${schema}"."${TRACKING_TABLE}"') AS t`)).rows[0].t, null);
        } finally { await c.query("SET search_path TO public"); c.release(); }
    });

    it("two schools can be built at the same time", async () => {
        const [a, b] = [newSchema(), newSchema()]; const [ca, cb] = [await connect(), await connect()];
        try {
            await Promise.all([applyTenantMigrations(ca, a, REAL_DIR), applyTenantMigrations(cb, b, REAL_DIR)]);
            for (const s of [a, b]) assert.equal((await pool.query(`SELECT count(*)::int n FROM "${s}"."${TRACKING_TABLE}"`)).rows[0].n, listTenantMigrations(REAL_DIR).length);
        } finally { await ca.query("SET search_path TO public"); await cb.query("SET search_path TO public"); ca.release(); cb.release(); }
    });
});
