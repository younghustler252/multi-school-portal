import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Access, canGrantRole, Scope } from "../../src/foundation/access.service";
import { ListAssignableStaffRolesUseCase, ChangeStaffRolesUseCase } from "../../src/modules/staff/usecases/staff-portal.usecases";
import { SendInviteUseCase } from "../../src/modules/auth/usecases/send-invite.usecase";
import type { StaffRoleRow } from "../../src/modules/staff/services/staff-portal.service";
import type { StaffActor } from "../../src/modules/staff/domain/staff.types";

/*
| GET /staff/assignable-roles. The list must be exactly the set of roles the same person could really invite into / assign:
| the tests below build the list, then run the REAL SendInviteUseCase and ChangeStaffRolesUseCase against every role and
| require all three to agree, so the picker can never offer a role that the invite would refuse (or hide one it would accept).
*/

type Perms = Record<string, Scope>;
const perms = (m: Perms) => Object.entries(m).map(([key, scope]) => ({ key, scope }));
const role = (id: string, p: Perms, grantsAll = false, kind: StaffRoleRow["kind"] = "CUSTOM"): StaffRoleRow =>
    ({ id, name: id, description: `${id} role`, kind, grantsAll, permissions: perms(p) });

const ROLES: StaffRoleRow[] = [
    role("school_admin", {}, true, "SYSTEM_LOCKED"),
    role("teacher",      { "students.view": "OWN", "attendance.mark": "ASSIGNED" }),
    role("branch_reg",   { "students.view": "BRANCH" }),
    role("registrar",    { "students.view": "ALL" }),
    role("bursar",       { "fees.view": "ALL", "fees.collect": "ALL" }),
    role("no_access",    {}),
];

function actor(p: Perms, opts: { admin?: boolean } = {}): StaffActor {
    const admin = !!opts.admin;
    const access = new Access("school", "u1", "m1", "STAFF", "staff-1", new Set(admin ? ["school_admin"] : []), admin, new Map(Object.entries(p)), new Set(["b1"]));
    return { userId: "u1", membershipId: "m1", access, ip: "1.1.1.1", userAgent: null, isAdmin: access.hasRoleKey("school_admin") };
}

const SCHOOL_ADMIN   = actor({}, { admin: true });
const BRANCH_MANAGER = actor({ "staff.manage": "BRANCH", "users.invite": "ALL", "students.view": "BRANCH", "attendance.mark": "ASSIGNED" });
// The motivating case: can manage staff and invite, but holds nothing else and not roles.view
const BARE_MANAGER   = actor({ "staff.manage": "ALL", "users.invite": "ALL" });

const list = (a: StaffActor, roles = ROLES) =>
    new ListAssignableStaffRolesUseCase({ staffPortalService: { listStaffRoles: async () => roles } } as any).execute(a);
const ids = (rows: Array<{ id: string }>) => rows.map(r => r.id);

describe("assignable staff roles: who gets which roles", () => {
    it("a school admin may grant every role, including the grants-all one", async () => {
        assert.deepEqual(ids(await list(SCHOOL_ADMIN)), ROLES.map(r => r.id));
    });

    it("a branch manager gets only roles whose every permission they hold at that scope or wider", async () => {
        // teacher (OWN/ASSIGNED) and branch_reg (BRANCH) are covered; registrar needs ALL, bursar needs permissions they lack
        assert.deepEqual(ids(await list(BRANCH_MANAGER)), ["teacher", "branch_reg", "no_access"]);
    });

    it("someone with only staff.manage + users.invite gets only roles that need no permission at all", async () => {
        assert.deepEqual(ids(await list(BARE_MANAGER)), ["no_access"]);
    });

    it("the grants-all role is never offered to a non-admin, even one holding every key at ALL", async () => {
        const everything = actor({ "staff.manage": "ALL", "users.invite": "ALL", "students.view": "ALL", "attendance.mark": "ALL", "fees.view": "ALL", "fees.collect": "ALL" });
        const got = ids(await list(everything));
        assert.ok(!got.includes("school_admin"));
        assert.deepEqual(got, ["teacher", "branch_reg", "registrar", "bursar", "no_access"]);
    });

    it("returns an empty list, not an error, when nothing is grantable", async () => {
        assert.deepEqual(await list(BARE_MANAGER, [role("registrar", { "students.view": "ALL" })]), []);
    });

    it("keeps the repository order", async () => {
        const got = ids(await list(SCHOOL_ADMIN, [ROLES[3], ROLES[1], ROLES[0]]));
        assert.deepEqual(got, ["registrar", "teacher", "school_admin"]);
    });
});

describe("assignable staff roles: what is returned", () => {
    it("only id, name, description, kind and grantsAll; no permission details", async () => {
        const [first] = await list(SCHOOL_ADMIN);
        assert.deepEqual(Object.keys(first).sort(), ["description", "grantsAll", "id", "kind", "name"]);
        const row = (await list(SCHOOL_ADMIN)).find(r => r.id === "bursar")!;
        assert.deepEqual(row, { id: "bursar", name: "bursar", description: "bursar role", kind: "CUSTOM", grantsAll: false });
    });
});

describe("assignable staff roles: agrees with invite and change-roles", () => {
    const toRecord = (r: StaffRoleRow) => ({ id: r.id, name: r.name, grantsAll: r.grantsAll, persona: "STAFF", sourceTemplateKey: r.id === "school_admin" ? "school_admin" : null, permissionKeys: r.permissions.map(p => p.key), permissions: r.permissions });

    async function inviteAccepts(a: StaffActor, r: StaffRoleRow): Promise<boolean> {
        let created = 0;
        const uc = new SendInviteUseCase({
            membershipService: { getRole: async () => toRecord(r), getStaffContact: async () => null },
            userRepository: { findByEmail: async () => null },
            inviteRepository: { revokePendingForEmail: async () => {}, create: async () => { created++; return { id: "i1" }; } },
            tokenService: { generateInviteToken: () => "t" },
            inviteService: { expiresAt: () => new Date(), hash: (t: string) => t, getSchool: async () => ({}), deliver: async () => {} },
            authAuditService: { record: async () => {} },
        } as any);
        const who = { userId: a.userId, membershipId: a.membershipId, isAdmin: a.isAdmin, can: (k: string) => a.access.can(k), scopeOf: (k: string) => a.access.scopeOf(k) };
        try { await uc.execute({ persona: "STAFF", roleId: r.id, email: "a@b.ng", firstName: "A" } as any, "s1", who, { ip: "1", userAgent: null } as any); } catch (e: any) {
            if (e.code === "ROLE_NOT_ALLOWED" || e.statusCode === 403) return false;
            throw e;
        }
        return created === 1;
    }

    async function changeRolesAccepts(a: StaffActor, r: StaffRoleRow): Promise<boolean> {
        const uc = new ChangeStaffRolesUseCase({
            staffRepository: { findWithBranches: async () => ({ id: "staff-2", branches: [{ id: "b1" }] }) },
            membershipService: {
                findByEntity: async () => ({ id: "m2", userId: "someone-else" }),
                getRole: async () => toRecord(r),
                listActiveUserIdsByRoleKey: async () => [],
                replaceRoles: async () => [],
            },
            accessService: { invalidate: () => {} },
            auditService: { log: async () => {} },
        } as any);
        try { await uc.execute("s1", "staff-2", { roleIds: [r.id] }, a); } catch (e: any) {
            if (e.code === "ROLE_NOT_ALLOWED") return false;
            throw e;
        }
        return true;
    }

    for (const [label, who] of [["school admin", SCHOOL_ADMIN], ["branch manager", BRANCH_MANAGER], ["bare manager", BARE_MANAGER]] as const) {
        it(`${label}: the list equals what invite accepts and what change-roles accepts`, async () => {
            const offered = new Set(ids(await list(who)));
            for (const r of ROLES) {
                const inList = offered.has(r.id);
                assert.equal(await inviteAccepts(who, r),      inList, `invite vs list for ${r.id}`);
                assert.equal(await changeRolesAccepts(who, r), inList, `change-roles vs list for ${r.id}`);
                assert.equal(canGrantRole(r, { isAdmin: who.isAdmin, scopeOf: k => who.access.scopeOf(k) }), inList, `canGrantRole for ${r.id}`);
            }
        });
    }
});

describe("assignable staff roles: the route", () => {
    const src = readFileSync("src/modules/staff/routes/staff.routes.ts", "utf8");
    const lines = src.split("\n").filter(l => !l.trim().startsWith("|") && !l.trim().startsWith("//"));
    const at = (re: RegExp) => lines.findIndex(l => re.test(l));

    it("is GET /assignable-roles, guarded by staff.manage (the `manage` guard), not roles.view", () => {
        const i = at(/router\.get\("\/assignable-roles"/);
        assert.ok(i >= 0, "route exists");
        assert.match(lines[i], /\.\.\.manage\b/);
        assert.doesNotMatch(lines[i], /\.\.\.view\b|\.\.\.self\b/);
        assert.match(src, /const manage = \[authenticate, requireTenant, requirePermission\("staff\.manage"\)\]/);
        assert.doesNotMatch(lines.join("\n"), /roles\.view/);
    });

    it("is declared before GET /:id so it is not read as a staff id", () => {
        assert.ok(at(/router\.get\("\/assignable-roles"/) < at(/router\.get\("\/:id"/));
    });
});
