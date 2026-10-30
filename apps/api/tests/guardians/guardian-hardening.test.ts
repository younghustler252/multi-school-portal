import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isGuardianEmailConflict } from "../../src/modules/guardians/domain/guardian.policy";
import { linkData } from "../../src/modules/guardians/services/guardian-link.presenter";
import { UnlinkGuardianUseCase, UpdateGuardianLinkUseCase } from "../../src/modules/guardians/usecases/guardian-links.usecases";
import { UpdateGuardianUseCase } from "../../src/modules/guardians/usecases/update-guardian.usecase";
import { GuardianMapper } from "../../src/modules/guardians/mappers/guardian.mapper";

const GID = "22222222-2222-4222-8222-222222222222";
const SID = "11111111-1111-4111-8111-111111111111";
const actor = { userId: "u1" } as any;
const guardian = { id: GID, firstName: "Ada", lastName: "Obi" };
const student  = { id: SID, firstName: "Chike", lastName: "Obi", admissionNumber: "GFA/2026/001" };

describe("which database 'already exists' error is the email rule", () => {
    it("recognises the email index by name, by column and by message", () => {
        assert.equal(isGuardianEmailConflict({ code: "P2002", meta: { target: "Guardian_email_lower_key" } }), true);
        assert.equal(isGuardianEmailConflict({ code: "P2002", meta: { target: ["email"] } }), true);
        assert.equal(isGuardianEmailConflict({ code: "P2002", message: 'duplicate key value violates unique constraint "Guardian_email_lower_key"' }), true);
    });
    it("does not mistake the primary-guardian or already-linked rules, or other errors, for it", () => {
        assert.equal(isGuardianEmailConflict({ code: "P2002", meta: { target: "StudentGuardian_one_primary_per_student" } }), false);
        assert.equal(isGuardianEmailConflict({ code: "P2002", meta: { target: ["studentId", "guardianId"] } }), false);
        assert.equal(isGuardianEmailConflict({ code: "P2025" }), false);
        assert.equal(isGuardianEmailConflict(new Error("boom")), false);
        assert.equal(isGuardianEmailConflict(undefined), false);
    });
});

describe("link responses carry names", () => {
    it("linkData gives guardian and student objects plus relation and isPrimary", () => {
        assert.deepEqual(linkData(guardian, student, { relation: "mother", isPrimary: true }), {
            guardian: { id: GID, name: "Ada Obi" },
            student: { id: SID, name: "Chike Obi", admissionNumber: "GFA/2026/001" },
            relation: "mother", isPrimary: true,
        });
    });
    it("a student with no admission number yet shows null, not a made-up value", () => {
        assert.equal(linkData(guardian, { ...student, admissionNumber: null }, { relation: "mother", isPrimary: false }).student.admissionNumber, null);
    });

    const repos = (linked = true) => {
        const audits: any[] = []; const unlinked: any[] = [];
        const guardianRepository: any = {
            findById: async (id: string) => (id === GID ? guardian : null),
            isLinked: async () => linked,
            unlinkFromStudent: async (g: string, s: string) => { unlinked.push([g, s]); },
            findStudentLinksByGuardianId: async () => (linked ? [{ studentId: SID, relation: "mother", isPrimary: false }] : []),
        };
        const studentRepository: any = { findById: async (id: string) => (id === SID ? student : null) };
        const auditService: any = { log: async (p: any) => { audits.push(p); } };
        return { audits, unlinked, d: { guardianRepository, studentRepository, auditService } as any };
    };

    it("unlink returns both names and audits with names", async () => {
        const { d, audits, unlinked } = repos();
        const r = await new UnlinkGuardianUseCase(d).execute("sch", GID, SID, actor);
        assert.deepEqual(r, { guardian: { id: GID, name: "Ada Obi" }, student: { id: SID, name: "Chike Obi", admissionNumber: "GFA/2026/001" } });
        assert.deepEqual(unlinked, [[GID, SID]]);
        assert.equal(audits[0].oldValue.guardian, "Ada Obi"); assert.equal(audits[0].oldValue.student, "Chike Obi");
    });
    it("unlink of a link that does not exist is refused and changes nothing", async () => {
        const { d, unlinked } = repos(false);
        await assert.rejects(() => new UnlinkGuardianUseCase(d).execute("sch", GID, SID, actor), (e: any) => e.code === "GUARDIAN_NOT_LINKED");
        assert.equal(unlinked.length, 0);
    });
    it("update-link with nothing to change still answers with names", async () => {
        const { d, audits } = repos();
        const r = await new UpdateGuardianLinkUseCase(d).execute("sch", GID, SID, { relation: "mother" } as any, actor);
        assert.equal(r.guardian.name, "Ada Obi"); assert.equal(r.student.name, "Chike Obi");
        assert.equal(r.relation, "mother"); assert.equal(r.isPrimary, false); assert.equal(audits.length, 0);
    });
});

describe("changing an email the database refuses", () => {
    it("a race on the unique email rule is reported as GUARDIAN_EMAIL_TAKEN, other errors pass through", async () => {
        const mapper = new GuardianMapper();
        const row = { id: GID, userId: null, firstName: "Ada", lastName: "Obi", email: "mum@x.com", phone: null, occupation: null, address: null, isActive: true, createdAt: new Date(), updatedAt: new Date() };
        const make = (err: any) => new UpdateGuardianUseCase({
            guardianRepository: { findById: async () => mapper.toDomain(row), findByEmail: async () => null, update: async () => { throw err; } },
            guardianMapper: mapper, auditService: { log: async () => undefined },
        } as any);
        await assert.rejects(() => make({ code: "P2002", meta: { target: "Guardian_email_lower_key" } }).execute("sch", GID, { email: "new@x.com" } as any, actor), (e: any) => e.code === "GUARDIAN_EMAIL_TAKEN");
        await assert.rejects(() => make(new Error("db down")).execute("sch", GID, { email: "new@x.com" } as any, actor), /db down/);
    });
});

describe("one guardian per email is also a database rule", () => {
    const sql = readFileSync("prisma/tenant-migrations/20261027090000_guardian_email_unique/migration.sql", "utf8");
    it("the migration lower-cases emails, merges duplicates (links and payments), refuses two logins, then adds the index", () => {
        assert.match(sql, /lower\(btrim\("email"\)\)/);
        assert.match(sql, /UPDATE "StudentGuardian" SET "guardianId" = keep_id/);
        assert.match(sql, /UPDATE "Payment"\s+SET "guardianId" = keep_id/);
        assert.match(sql, /RAISE EXCEPTION/);
        assert.match(sql, /CREATE UNIQUE INDEX "Guardian_email_lower_key" ON "Guardian"\(lower\("email"\)\)/);
        assert.ok(sql.indexOf("DO $$") < sql.indexOf("CREATE UNIQUE INDEX"), "merge must come before the index");
    });
});
