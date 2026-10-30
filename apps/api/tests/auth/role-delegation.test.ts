import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SendInviteUseCase } from "../../src/modules/auth/usecases/send-invite.usecase";
import { canDelegateRole, scopeCovers, Scope } from "../../src/foundation/access.service";

const holds = (m: Record<string, Scope>) => (k: string): Scope | null => m[k] ?? null;
const grant = (...p: [string, Scope][]) => p.map(([key, scope]) => ({ key, scope }));

describe("scope-safe delegation (AUTH-01)", () => {
    it("scopeCovers: wider or equal covers; narrower and missing do not", () => {
        assert.equal(scopeCovers("ALL", "OWN"), true);
        assert.equal(scopeCovers("BRANCH", "BRANCH"), true);
        assert.equal(scopeCovers("ASSIGNED", "BRANCH"), false);
        assert.equal(scopeCovers("OWN", "ALL"), false);
        assert.equal(scopeCovers(null, "OWN"), false);
    });
    it("OWN -> ALL and BRANCH -> ALL are refused; equal and narrower are allowed", () => {
        assert.equal(canDelegateRole(grant(["students.view", "ALL"]), holds({ "students.view": "OWN" })), false);
        assert.equal(canDelegateRole(grant(["students.view", "ALL"]), holds({ "students.view": "BRANCH" })), false);
        assert.equal(canDelegateRole(grant(["students.view", "BRANCH"]), holds({ "students.view": "BRANCH" })), true);
        assert.equal(canDelegateRole(grant(["students.view", "OWN"]), holds({ "students.view": "ALL" })), true);
    });
    it("one permission too wide, or not held at all, refuses the whole role; an empty role is allowed", () => {
        const mine = holds({ a: "ALL", b: "OWN" });
        assert.equal(canDelegateRole(grant(["a", "ALL"], ["b", "ALL"]), mine), false);
        assert.equal(canDelegateRole(grant(["a", "ALL"], ["c", "OWN"]), mine), false);
        assert.equal(canDelegateRole(grant(["a", "OWN"], ["b", "OWN"]), mine), true);
        assert.equal(canDelegateRole([], mine), true);
    });
});

function invite(role: any, actor: any) {
    let created = 0;
    const uc = new SendInviteUseCase({
        membershipService: { getRole: async () => role, getStaffContact: async () => null },
        userRepository: { findByEmail: async () => null },
        inviteRepository: { revokePendingForEmail: async () => {}, create: async () => { created++; return { id: "i1" }; } },
        tokenService: { generateInviteToken: () => "t" }, inviteService: { expiresAt: () => new Date(), hash: (t: string) => t, getSchool: async () => ({}), deliver: async () => {} },
        authAuditService: { record: async () => {} },
    } as any);
    return { run: () => uc.execute({ persona: "STAFF", roleId: "r1", email: "a@b.ng", firstName: "A" } as any, "s1", actor, { ip: "1", userAgent: null } as any), created: () => created };
}
const role = (perms: [string, Scope][], grantsAll = false) => ({ id: "r1", name: "R", grantsAll, persona: "STAFF", sourceTemplateKey: null, permissionKeys: perms.map(p => p[0]), permissions: grant(...perms) });
const actorOf = (m: Record<string, Scope>, isAdmin = false) => ({ userId: "u", membershipId: "m", isAdmin, can: (k: string) => k in m, scopeOf: holds(m) });

describe("send invite uses it", () => {
    it("an inviter holding students.view at OWN cannot invite into a role granting it at ALL", async () => {
        const t = invite(role([["students.view", "ALL"]]), actorOf({ "students.view": "OWN" }));
        await assert.rejects(t.run, (e: any) => e.code === "ROLE_NOT_ALLOWED" || e.statusCode === 403);
        assert.equal(t.created(), 0);
    });
    it("equal scope works; a grants-all role still needs a school admin", async () => {
        const ok = invite(role([["students.view", "OWN"]]), actorOf({ "students.view": "OWN" }));
        await ok.run(); assert.equal(ok.created(), 1);
        await assert.rejects(invite(role([], true), actorOf({}, false)).run, (e: any) => e.statusCode === 403);
        const admin = invite(role([], true), actorOf({}, true));
        await admin.run(); assert.equal(admin.created(), 1);
    });
});
