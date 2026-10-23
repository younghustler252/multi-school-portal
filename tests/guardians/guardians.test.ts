import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Access } from "../../src/foundation/access.service";
import { validatePermissionRegistry, PERMISSION_REGISTRY } from "../../src/foundation/permissions.registry";
import { normalizeEmail } from "../../src/modules/guardians/domain/guardian.policy";
import { CreateGuardianDto, UpdateGuardianDto, UpdateGuardianLinkDto, BulkInviteGuardiansDto, ListGuardiansQuery } from "../../src/modules/guardians/dtos/guardian.dto";
import { linkInTx, createOrReuseGuardianInTx } from "../../src/modules/guardians/services/guardian-linking";
import { UpdateGuardianUseCase } from "../../src/modules/guardians/usecases/update-guardian.usecase";
import { InviteGuardianUseCase, BulkInviteGuardiansUseCase, tryInvite } from "../../src/modules/guardians/usecases/guardian-invites.usecases";
import { GetMyChildrenUseCase } from "../../src/modules/guardians/usecases/guardian-queries.usecases";
import { GuardianMapper } from "../../src/modules/guardians/mappers/guardian.mapper";

const SID = "11111111-1111-4111-8111-111111111111";
const GID = "22222222-2222-4222-8222-222222222222";
const base = { firstName: "Ada", lastName: "Obi", email: "mum@x.com", studentId: SID, relation: "mother" };

describe("guardian permissions", () => {
    it("registry is valid; guardians.view and guardians.manage exist once, are sensitive and ALL-only", () => {
        assert.deepEqual(validatePermissionRegistry(), []);
        for (const key of ["guardians.view", "guardians.manage"]) {
            const p = PERMISSION_REGISTRY.filter(x => x.key === key);
            assert.equal(p.length, 1); assert.equal(p[0].isSensitive, true); assert.deepEqual([...p[0].scopes], ["ALL"]);
        }
    });
});

describe("guardian DTOs", () => {
    it("create trims and lower-cases the email, and rejects unknown fields, bad phones and bad relations", () => {
        assert.equal(CreateGuardianDto.parse({ ...base, email: "  Mum@X.com " }).email, "mum@x.com");
        assert.equal(CreateGuardianDto.safeParse({ ...base, password: "x" }).success, false);
        assert.equal(CreateGuardianDto.safeParse({ ...base, phone: "call me" }).success, false);
        assert.equal(CreateGuardianDto.safeParse({ ...base, relation: "cousin" }).success, false);
        assert.equal(CreateGuardianDto.safeParse({ ...base, studentId: "abc" }).success, false);
        const ok = CreateGuardianDto.parse({ ...base, phone: " ", occupation: "" });
        assert.equal(ok.phone, undefined); assert.equal(ok.isPrimary, false); assert.equal(ok.invite, false);
    });
    it("update needs one field and blank clears an optional field", () => {
        assert.equal(UpdateGuardianDto.safeParse({}).success, false);
        assert.equal((UpdateGuardianDto.parse({ phone: "" }) as any).phone, null);
        assert.equal(UpdateGuardianLinkDto.safeParse({}).success, false);
    });
    it("bulk invite is capped at 100, list has safe defaults", () => {
        assert.equal(BulkInviteGuardiansDto.safeParse({ guardianIds: Array(101).fill(SID) }).success, false);
        assert.deepEqual(ListGuardiansQuery.parse({}), { page: 1, limit: 20 });
        assert.equal(ListGuardiansQuery.safeParse({ limit: "100000" }).success, false);
    });
    it("normalizeEmail", () => assert.equal(normalizeEmail("  A@B.Com "), "a@b.com"));
});

// ── a tiny in-memory transaction ─────────────────────────────────────────────
function fakeTx(opts: { guardian?: any; link?: any } = {}) {
    const calls: string[] = [];
    const tx = {
        guardian: {
            findFirst: async (a: any) => { calls.push(`find:${a.where.email.equals}:${a.where.email.mode}`); return opts.guardian ?? null; },
            create: async (a: any) => { calls.push("create"); return { id: GID, ...a.data }; },
        },
        studentGuardian: {
            findUnique: async () => opts.link ?? null,
            updateMany: async (a: any) => { calls.push(`demote:${a.where.studentId}`); },
            create: async (a: any) => { calls.push(`link:${a.data.isPrimary}`); return a.data; },
        },
    };
    return { tx, calls };
}
const link = { studentId: SID, relation: "mother" as const, isPrimary: false };
const person = { firstName: "Ada", lastName: "Obi", email: "mum@x.com" };

describe("linking a guardian (one transaction)", () => {
    it("creates a new guardian and links, searching the email without caring about capitals", async () => {
        const { tx, calls } = fakeTx();
        const r = await createOrReuseGuardianInTx(tx, person, link);
        assert.equal(r.outcome, "created");
        assert.deepEqual(calls, ["find:mum@x.com:insensitive", "create", "link:false"]);
    });
    it("reuses an existing guardian and never overwrites their details", async () => {
        const existing = { id: GID, firstName: "Old", lastName: "Name", email: "Mum@X.com", phone: "0801" };
        const { tx, calls } = fakeTx({ guardian: existing });
        const r = await createOrReuseGuardianInTx(tx, { ...person, firstName: "NEW", phone: "9999" }, link);
        assert.equal(r.outcome, "reused"); assert.equal(r.guardian.firstName, "Old"); assert.equal(r.guardian.phone, "0801");
        assert.ok(!calls.includes("create"));
    });
    it("already linked: changes nothing, even when primary was asked for", async () => {
        const { tx, calls } = fakeTx({ guardian: { id: GID, ...person }, link: { id: "l1" } });
        const r = await createOrReuseGuardianInTx(tx, person, { ...link, isPrimary: true });
        assert.equal(r.outcome, "already_linked");
        assert.deepEqual(calls.filter(c => c.startsWith("demote") || c.startsWith("link")), []);
    });
    it("a new primary first clears the old primary, then links", async () => {
        const { tx, calls } = fakeTx();
        assert.equal(await linkInTx(tx, { guardianId: GID, ...link, isPrimary: true }), "linked");
        assert.deepEqual(calls, [`demote:${SID}`, "link:true"]);
    });
    it("a non-primary link does not touch the current primary", async () => {
        const { tx, calls } = fakeTx();
        await linkInTx(tx, { guardianId: GID, ...link });
        assert.deepEqual(calls, ["link:false"]);
    });
});

describe("one primary guardian per student is also a database rule", () => {
    it("the migration adds a partial unique index and tidies old duplicates first", () => {
        const sql = readFileSync("prisma/tenant-migrations/20261023150000_guardian_primary_unique/migration.sql", "utf8");
        assert.match(sql, /CREATE UNIQUE INDEX "StudentGuardian_one_primary_per_student" ON "StudentGuardian"\("studentId"\) WHERE "isPrimary" = true/);
        assert.match(sql, /UPDATE "StudentGuardian"/);
    });
});

// ── fakes for the use cases ──────────────────────────────────────────────────
const mapper = new GuardianMapper();
const row = { id: GID, userId: null, firstName: "Ada", lastName: "Obi", email: "mum@x.com", phone: "0801", occupation: null, address: null, isActive: true, createdAt: new Date(), updatedAt: new Date() };
function guardianFakes(initial: any = row, other: any = null) {
    const state = { g: { ...initial }, updates: [] as any[], audits: [] as any[] };
    const guardianRepository: any = {
        findById: async (id: string) => (id === state.g.id ? mapper.toDomain(state.g) : null),
        findByEmail: async () => (other ? mapper.toDomain(other) : null),
        update: async (_i: string, data: any) => { state.updates.push(data); state.g = { ...state.g, ...data }; return mapper.toDomain(state.g); },
    };
    const auditService: any = { log: async (p: any) => { state.audits.push(p); } };
    return { state, guardianRepository, d: { guardianRepository, guardianMapper: mapper, auditService } };
}
const actor: any = { userId: "u1", membershipId: "m1", ip: "1.1.1.1", userAgent: null, isAdmin: true, access: { can: () => true } };

describe("update guardian", () => {
    it("writes and audits only what changed", async () => {
        const { state, d } = guardianFakes();
        await new UpdateGuardianUseCase(d).execute("sch", GID, { firstName: "Ada", phone: "0802" }, actor);
        assert.deepEqual(state.updates, [{ phone: "0802" }]);
        assert.deepEqual(state.audits[0].oldValue, { phone: "0801" }); assert.deepEqual(state.audits[0].newValue, { phone: "0802" });
    });
    it("does nothing when nothing changed", async () => {
        const { state, d } = guardianFakes();
        await new UpdateGuardianUseCase(d).execute("sch", GID, { email: "MUM@x.com" }, actor);   // same email, different capitals
        assert.equal(state.updates.length, 0); assert.equal(state.audits.length, 0);
    });
    it("refuses an email change when the guardian already has a login", async () => {
        const { d, state } = guardianFakes({ ...row, userId: "user-1" });
        await assert.rejects(new UpdateGuardianUseCase(d).execute("sch", GID, { email: "new@x.com" }, actor), { code: "GUARDIAN_HAS_LOGIN" });
        assert.equal(state.updates.length, 0);
    });
    it("allows an email change without a login, and refuses one another guardian already has", async () => {
        const a = guardianFakes();
        await new UpdateGuardianUseCase(a.d).execute("sch", GID, { email: "New@x.com" }, actor);
        assert.deepEqual(a.state.updates, [{ email: "new@x.com" }]);
        const b = guardianFakes(row, { ...row, id: "other" });
        await assert.rejects(new UpdateGuardianUseCase(b.d).execute("sch", GID, { email: "taken@x.com" }, actor), { code: "GUARDIAN_EMAIL_TAKEN" });
    });
    it("reports a missing guardian", async () => {
        const { d } = guardianFakes();
        await assert.rejects(new UpdateGuardianUseCase(d).execute("sch", "nope", { phone: "0803" }, actor), { code: "NOT_FOUND" });
    });
});

describe("invitations go through Auth", () => {
    function inviteFakes(g: any = row, membership: any = null, fail?: any) {
        const sent: any[] = [];
        const d: any = {
            guardianRepository: { findById: async (id: string) => (id === GID ? mapper.toDomain(g) : null) },
            membershipService: { findByEntity: async () => membership },
            sendInviteUseCase: { execute: async (...a: any[]) => { if (fail) throw fail; sent.push(a); return { message: "ok" }; } },
        };
        return { d, sent };
    }
    it("sends a GUARDIAN invite for this guardian record, to the guardian's own email", async () => {
        const { d, sent } = inviteFakes();
        await new InviteGuardianUseCase(d).execute("sch", GID, actor);
        assert.equal(sent.length, 1);
        assert.deepEqual(sent[0][0], { email: "mum@x.com", persona: "GUARDIAN", personaEntityId: GID, firstName: "Ada" });
        assert.equal(sent[0][1], "sch");
    });
    it("refuses a guardian who already has access (login or membership) and a missing guardian", async () => {
        await assert.rejects(new InviteGuardianUseCase(inviteFakes({ ...row, userId: "u9" }).d).execute("sch", GID, actor), { code: "GUARDIAN_ALREADY_HAS_ACCESS" });
        await assert.rejects(new InviteGuardianUseCase(inviteFakes(row, { id: "m" }).d).execute("sch", GID, actor), { code: "GUARDIAN_ALREADY_HAS_ACCESS" });
        await assert.rejects(new InviteGuardianUseCase(inviteFakes().d).execute("sch", "nope", actor), { code: "NOT_FOUND" });
    });
    it("bulk reports sent, skipped and failed one by one, and handles repeats once", async () => {
        const ids = [GID, "33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"];
        const outcomes: Record<string, any> = { [ids[0]]: null, [ids[1]]: { code: "GUARDIAN_ALREADY_HAS_ACCESS" }, [ids[2]]: { code: "INVITE_RATE_LIMITED" } };
        const invite: any = { execute: async (_s: string, id: string) => { if (outcomes[id]) throw outcomes[id]; } };
        const r = await new BulkInviteGuardiansUseCase({ inviteGuardianUseCase: invite }).execute("sch", { guardianIds: [...ids, ids[0]] }, actor);
        assert.deepEqual([r.sent, r.skipped, r.failed], [1, 1, 1]);
        assert.equal(r.results.length, 3);
        assert.equal(r.results[2].code, "INVITE_RATE_LIMITED");
    });
    it("a failed invite is reported as failed, never as sent", async () => {
        assert.deepEqual(await tryInvite(async () => { throw { code: "EMAIL_FAILED" }; }), { status: "failed", code: "EMAIL_FAILED" });
        assert.deepEqual(await tryInvite(async () => undefined), { status: "sent" });
        assert.equal((await tryInvite(async () => { throw { code: "GUARDIAN_ALREADY_HAS_ACCESS" }; })).status, "not_needed");
    });
});

describe("my children", () => {
    const acc = (persona: "STAFF" | "STUDENT" | "GUARDIAN", entityId: string | null) =>
        new Access("school", "u1", "m1", persona, entityId, new Set(), false, new Map([["students.view", "OWN" as any]]));
    function childFakes() {
        const seen: any = {};
        const d: any = {
            guardianRepository: {
                findById: async (id: string) => { seen.guardianId = id; return mapper.toDomain({ ...row, id }); },
                findStudentLinksByGuardianId: async () => [{ studentId: "s1", relation: "mother", isPrimary: true }, { studentId: "s2", relation: "mother", isPrimary: false }],
            },
            guardianMapper: mapper,
            studentRepository: { findMany: async (where: any) => { seen.where = where; return [{ id: "s1" }, { id: "s2" }]; } },
            studentPhotoService: { toResponses: async (list: any[]) => list.map(s => ({ id: s.id, firstName: "Kid" + s.id, lastName: "Obi", photoUrl: "https://signed.test/" + s.id, isActive: true })) },
        };
        return { d, seen };
    }
    it("only the GUARDIAN persona may use it", async () => {
        const { d } = childFakes();
        for (const a of [acc("STAFF", "x"), acc("STUDENT", "x"), acc("GUARDIAN", null)])
            await assert.rejects(new GetMyChildrenUseCase(d).execute(a), { code: "NOT_FOUND" });
    });
    it("uses the guardian from the session, limits the students to the viewer's scope, and returns signed photo links", async () => {
        const { d, seen } = childFakes();
        const r = await new GetMyChildrenUseCase(d).execute(acc("GUARDIAN", "g-session"));
        assert.equal(seen.guardianId, "g-session");
        assert.deepEqual(seen.where.AND[1], { guardianLinks: { some: { guardianId: "g-session" } } });
        assert.deepEqual(r.map(c => [c.studentId, c.isPrimary, c.photoUrl]), [["s1", true, "https://signed.test/s1"], ["s2", false, "https://signed.test/s2"]]);
    });
});
