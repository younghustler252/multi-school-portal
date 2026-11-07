import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LoginUseCase } from "../../src/modules/auth/usecases/login.usecase";

/*
| Login on the PLATFORM host (no school in the request): what comes back depends on which schools the person can really
| enter. Schools come from membershipService.listEligibleSchools (tenant Membership verified there); these tests fake it.
*/
const S = (id: string, name = id) => ({ id, name, url: `https://${id}.example.test` });
const meta = { ip: "1.1.1.1", userAgent: "test" };
const dto = { email: "a@b.test", password: "pw" } as any;

function build(opts: { platformMember?: boolean; eligible?: ReturnType<typeof S>[]; lastSchoolId?: string | null; memberships?: Array<{ id: string; persona: string }> } = {}) {
    const audit: any[] = [], issued: any[] = [], lastLogin: any[] = [];
    const uc = new LoginUseCase({
        userRepository: {
            findByEmailWithPassword: async () => ({ id: "u1", email: "a@b.test", passwordHash: "h", isActive: true, isEmailVerified: true, lockedUntil: null, failedLoginCount: 0, mustChangePassword: false }),
            findLastSchoolId: async () => opts.lastSchoolId ?? null,
            updateLastLogin: async (...a: any[]) => { lastLogin.push(a); }, resetFailedLogin: async () => {},
            incrementFailedLogin: async () => 1, lockAccount: async () => {},
        },
        passwordService: { compare: async () => true, hash: async () => "h" },
        userMapper: { toResponse: (u: any) => ({ id: u.id }) },
        authSessionService: { issue: async (x: any) => { issued.push(x); return { accessToken: "a", refreshToken: "r" }; } },
        loginAttemptService: { assertNotBlocked: async () => {}, clear: async () => {}, recordFailure: async () => {} },
        membershipService: {
            getActivePlatformMember: async () => (opts.platformMember ? { id: "pm1" } : null),
            listEligibleSchools: async () => opts.eligible ?? [],
            listActive: async () => (opts.memberships ?? [{ id: "m1", persona: "STAFF" }]).map(m => ({ ...m, userId: "u1", personaEntityId: "e", status: "active" })),
        },
        authAuditService: { record: async (e: any) => { audit.push(e); } },
    } as any);
    return { uc, audit, issued, lastLogin };
}

describe("login on the platform host: which school(s) can this person enter?", () => {
    it("exactly one eligible school -> SCHOOL_REDIRECT, and NO session or token is created", async () => {
        const t = build({ eligible: [S("greenfield")] });
        const r: any = await t.uc.execute(dto, meta, null);
        assert.equal(r.status, "SCHOOL_REDIRECT");
        assert.deepEqual(r.school, S("greenfield"));
        assert.equal(r.tokens, undefined);
        assert.equal(t.issued.length, 0, "routing is not authentication");
        assert.equal(t.lastLogin.length, 0, "no school sign-in happened yet, so no last-school is recorded");
    });

    it("several eligible schools -> SCHOOL_SELECTION_REQUIRED with no suggestion when none was used before", async () => {
        const t = build({ eligible: [S("a"), S("b")] });
        const r: any = await t.uc.execute(dto, meta, null);
        assert.equal(r.status, "SCHOOL_SELECTION_REQUIRED");
        assert.deepEqual(r.schools.map((s: any) => s.id), ["a", "b"]);
        assert.equal(r.suggestedSchoolId, null);
        assert.equal(t.issued.length, 0);
    });

    it("the last-used school is suggested and listed first", async () => {
        const t = build({ eligible: [S("a"), S("b"), S("c")], lastSchoolId: "c" });
        const r: any = await t.uc.execute(dto, meta, null);
        assert.equal(r.suggestedSchoolId, "c");
        assert.deepEqual(r.schools.map((s: any) => s.id), ["c", "a", "b"]);
    });

    it("a last-used school the person can no longer enter is NOT suggested", async () => {
        const t = build({ eligible: [S("a"), S("b")], lastSchoolId: "gone" });
        const r: any = await t.uc.execute(dto, meta, null);
        assert.equal(r.suggestedSchoolId, null);
        assert.deepEqual(r.schools.map((s: any) => s.id), ["a", "b"]);
    });

    it("no eligible school -> the generic invalid-credentials answer, with the reason in the audit log only", async () => {
        const t = build({ eligible: [] });
        await assert.rejects(() => t.uc.execute(dto, meta, null), (e: any) => /invalid/i.test(e.message) && e.statusCode === 401);
        assert.equal(t.audit.at(-1).metadata.reason, "no_eligible_school");
        assert.equal(t.issued.length, 0);
    });

    it("an active platform membership keeps the platform session, whatever schools exist", async () => {
        const t = build({ platformMember: true, eligible: [S("a"), S("b")] });
        const r: any = await t.uc.execute(dto, meta, null);
        assert.equal(r.status, "AUTHENTICATED");
        assert.equal(r.session.kind, "platform");
        assert.equal(t.issued.length, 1);
    });
});

describe("login on a school's own host", () => {
    it("verifies the tenant membership, issues the session and remembers the school as last used", async () => {
        const t = build();
        const r: any = await t.uc.execute(dto, meta, "school-1");
        assert.equal(r.status, "AUTHENTICATED");
        assert.equal(r.session.kind, "school");
        assert.deepEqual(t.lastLogin[0].slice(2), ["school-1"]);
    });

    it("no active membership in this school -> denied (reason recorded), no token", async () => {
        const t = build({ memberships: [] });
        await assert.rejects(() => t.uc.execute(dto, meta, "school-1"), (e: any) => e.statusCode === 401);
        assert.equal(t.audit.at(-1).metadata.reason, "no_membership");
        assert.equal(t.issued.length, 0);
    });

    it("several personas in the school still ask which one", async () => {
        const t = build({ memberships: [{ id: "m1", persona: "STAFF" }, { id: "m2", persona: "GUARDIAN" }] });
        const r: any = await t.uc.execute(dto, meta, "school-1");
        assert.equal(r.status, "PERSONA_SELECTION_REQUIRED");
    });
});
