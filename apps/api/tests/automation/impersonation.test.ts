import { test } from "node:test";
import assert from "node:assert/strict";
import { ImpersonateSchoolUseCase, ImpersonateSchoolDto } from "../../src/modules/school/usecases/platform/impersonate-school.usecase";

const school = { id: "s1", name: "Alpha", subdomain: "alpha", customDomain: null, customDomainVerifiedAt: null, status: "active", schemaName: "school_alpha", schemaProvisionedAt: new Date() };

function build(over: { school?: any; platformIds?: string[]; adminIds?: string[]; members?: Record<string, any> } = {}) {
    const tickets: any[] = []; const audits: any[] = [];
    const sc = over.school === undefined ? school : over.school;
    const platform = new Set(over.platformIds ?? ["staff1"]);
    const members = over.members ?? { u1: { id: "m1", userId: "u1", persona: "STAFF", personaEntityId: "e", status: "active" } };
    const uc = new ImpersonateSchoolUseCase({
        prismaClient: { school: { findFirst: async () => sc } } as any,
        membershipService: {
            getActivePlatformMember: async (id: string) => platform.has(id) ? { id } : null,
            listActiveUserIdsByRoleKey: async () => over.adminIds ?? ["u1"],
            findByUserPersona: async (uid: string) => members[uid] ?? null,
            findById: async (id: string) => Object.values(members).find((m: any) => m.id === id) ?? null,
        } as any,
        authAuditService: { record: async (e: any) => { audits.push(e); } } as any,
        urlService: { schoolUrl: (s: any, p: string) => `https://${s.subdomain}.example.test${p}` } as any,
        ticketStore: { put: async (t, p, ttl) => { tickets.push({ t, p, ttl }); } },
    });
    return { uc, tickets, audits };
}
const dto = { reason: "Investigating the fee report complaint" };

test("issues a one-use 60s ticket for the school admin and audits reason and target", async () => {
    const { uc, tickets, audits } = build();
    const r = await uc.execute("staff1", "s1", dto);
    assert.equal(tickets.length, 1);
    assert.equal(tickets[0].ttl, 60);
    assert.deepEqual(tickets[0].p, { userId: "u1", schoolId: "s1", impersonatorId: "staff1", membershipId: "m1" });
    assert.ok(r.redirectUrl.startsWith("https://alpha.example.test/impersonate-entry?ticket="));
    assert.equal(audits[0].action, "platform.impersonation_issued");
    assert.equal(audits[0].metadata.reason, dto.reason);
    assert.equal(audits[0].userId, "staff1");
});

test("non platform users are refused before anything is created", async () => {
    const { uc, tickets } = build({ platformIds: [] });
    await assert.rejects(uc.execute("someone", "s1", dto), (e: any) => e.code === "IMPERSONATION_ACTOR_INVALID");
    assert.equal(tickets.length, 0);
});

test("schools that are not active or not provisioned cannot be entered", async () => {
    for (const sc of [{ ...school, status: "suspended" }, { ...school, schemaProvisionedAt: null }, null]) {
        const { uc, tickets } = build({ school: sc });
        await assert.rejects(uc.execute("staff1", "s1", dto));
        assert.equal(tickets.length, 0);
    }
});

test("no active admin means no ticket", async () => {
    const { uc } = build({ adminIds: [] });
    await assert.rejects(uc.execute("staff1", "s1", dto), (e: any) => e.code === "IMPERSONATION_NO_TARGET");
});

test("target must be an active staff member and never platform staff", async () => {
    const guardian = { id: "m2", userId: "u2", persona: "GUARDIAN", personaEntityId: "g", status: "active" };
    const suspended = { id: "m3", userId: "u3", persona: "STAFF", personaEntityId: "t", status: "suspended" };
    const platformPerson = { id: "m4", userId: "staff2", persona: "STAFF", personaEntityId: "t2", status: "active" };
    const members = { u2: guardian, u3: suspended, staff2: platformPerson };
    for (const id of ["m2", "m3", "m4", "nope"]) {
        const { uc, tickets } = build({ members, platformIds: ["staff1", "staff2"] });
        await assert.rejects(uc.execute("staff1", "s1", { ...dto, membershipId: id }), (e: any) => e.code === "IMPERSONATION_TARGET_INVALID");
        assert.equal(tickets.length, 0);
    }
});

test("a reason is mandatory and meaningful", () => {
    assert.equal(ImpersonateSchoolDto.safeParse({}).success, false);
    assert.equal(ImpersonateSchoolDto.safeParse({ reason: "short" }).success, false);
    assert.equal(ImpersonateSchoolDto.safeParse({ reason: "Looking into a billing complaint", extra: 1 }).success, false);
    assert.equal(ImpersonateSchoolDto.safeParse({ reason: "Looking into a billing complaint" }).success, true);
});
