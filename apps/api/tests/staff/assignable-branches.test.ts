import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Access, Scope } from "../../src/foundation/access.service";
import { ListAssignableBranchesUseCase, SetStaffBranchesUseCase } from "../../src/modules/staff/usecases/staff-branches.usecase";
import type { ActiveBranchRow } from "../../src/modules/staff/repositories/staff.repository";
import type { StaffActor } from "../../src/modules/staff/domain/staff.types";

/*
| GET /staff/assignable-branches. The list must be exactly the set of branches the same person could really place a
| staff member in: the tests below build the list, then run the REAL SetStaffBranchesUseCase for every branch in the school
| and require the two to agree, so the picker can never offer a branch that the assignment would refuse (or hide one it would accept).
| The repository is an in-memory fake that follows the real query's rule (active and not deleted; main first, then by name);
| the real query is covered on a database in staff-branches.db.test.ts.
*/

interface BranchSeed extends ActiveBranchRow { isActive: boolean; deleted: boolean }
const BRANCHES: BranchSeed[] = [
    { id: "b3", name: "Zion Campus", code: "ZN", isMain: false, isActive: true,  deleted: false },
    { id: "b1", name: "Main Campus", code: "MN", isMain: true,  isActive: true,  deleted: false },
    { id: "b2", name: "Annex",       code: "AN", isMain: false, isActive: true,  deleted: false },
    { id: "b4", name: "Closed",      code: "CL", isMain: false, isActive: false, deleted: false },
    { id: "b5", name: "Removed",     code: "RM", isMain: false, isActive: true,  deleted: true  },
];

const live = (b: BranchSeed) => b.isActive && !b.deleted;
function fakeRepo(target: { id: string; branches: string[] } = { id: "staff-2", branches: ["b1"] }) {
    return {
        listActiveBranches: async (ids?: string[]): Promise<ActiveBranchRow[]> =>
            BRANCHES.filter(b => live(b) && (!ids || ids.includes(b.id)))
                .sort((x, y) => Number(y.isMain) - Number(x.isMain) || x.name.localeCompare(y.name))
                .map(({ id, name, code, isMain }) => ({ id, name, code, isMain })),
        countActiveBranches: async (ids: string[]) => BRANCHES.filter(b => live(b) && ids.includes(b.id)).length,
        findWithBranches: async () => ({ id: target.id, branches: target.branches.map(id => ({ id })) }),
        replaceBranches: async () => {},
    };
}

function actor(manage: Scope | null, branchIds: string[], opts: { admin?: boolean } = {}): StaffActor {
    const perms = new Map<string, Scope>(manage ? [["staff.manage", manage]] : []);
    const access = new Access("school", "u1", "m1", "STAFF", "staff-1", new Set(opts.admin ? ["school_admin"] : []), !!opts.admin, perms, new Set(branchIds));
    return { userId: "u1", membershipId: "m1", access, ip: "1.1.1.1", userAgent: null, isAdmin: !!opts.admin };
}

const SCHOOL_ADMIN      = actor("ALL", [], { admin: true });
const ALL_MANAGER       = actor("ALL", ["b1"]);
const ONE_BRANCH        = actor("BRANCH", ["b2"]);
const SEVERAL_BRANCHES  = actor("BRANCH", ["b2", "b3", "b4", "b5"]);   // b4 inactive, b5 deleted
const NO_BRANCH         = actor("BRANCH", []);
const STALE_BRANCH      = actor("BRANCH", ["b2", "gone"]);              // an id that no longer exists
const NOT_A_MANAGER     = actor(null, ["b1"]);

const list = (a: StaffActor) => new ListAssignableBranchesUseCase({ staffRepository: fakeRepo() as any }).execute(a);
const ids = (rows: Array<{ id: string }>) => rows.map(r => r.id);

describe("assignable branches: who gets which branches", () => {
    it("a school admin and an ALL-scope manager get every active branch, main first then by name", async () => {
        assert.deepEqual(ids(await list(SCHOOL_ADMIN)), ["b1", "b2", "b3"]);
        assert.deepEqual(ids(await list(ALL_MANAGER)),  ["b1", "b2", "b3"]);
    });

    it("never lists an inactive or a deleted branch, even to an ALL-scope manager", async () => {
        const got = ids(await list(ALL_MANAGER));
        assert.ok(!got.includes("b4") && !got.includes("b5"));
    });

    it("a branch-limited manager gets only their own branches", async () => {
        assert.deepEqual(ids(await list(ONE_BRANCH)), ["b2"]);
    });

    it("their own branches that are inactive or deleted are left out; the others stay", async () => {
        assert.deepEqual(ids(await list(SEVERAL_BRANCHES)), ["b2", "b3"]);
    });

    it("a branch the manager is not in is never listed, including the main branch", async () => {
        const got = ids(await list(ONE_BRANCH));
        assert.ok(!got.includes("b1") && !got.includes("b3"));
    });

    it("a manager with no branches gets an empty list, not an error", async () => {
        assert.deepEqual(await list(NO_BRANCH), []);
    });

    it("a stale branch id in the manager's assignments is ignored", async () => {
        assert.deepEqual(ids(await list(STALE_BRANCH)), ["b2"]);
    });

    it("fails closed (empty) for someone who does not hold staff.manage at ALL or BRANCH", async () => {
        assert.deepEqual(await list(NOT_A_MANAGER), []);
        assert.deepEqual(await list(actor("OWN", ["b1"])), []);
    });

    it("an empty branch scope does not turn into 'no filter'", async () => {
        const seen: Array<string[] | undefined> = [];
        const repo = { ...fakeRepo(), listActiveBranches: async (x?: string[]) => { seen.push(x); return []; } };
        await new ListAssignableBranchesUseCase({ staffRepository: repo as any }).execute(NO_BRANCH);
        assert.deepEqual(seen, [], "the repository must not be asked at all (an undefined filter would mean every branch)");
    });
});

describe("assignable branches: what is returned", () => {
    it("only id, name, code and isMain; nothing else about the branch", async () => {
        const rows = await list(ALL_MANAGER);
        for (const r of rows) assert.deepEqual(Object.keys(r).sort(), ["code", "id", "isMain", "name"]);
        assert.deepEqual(rows[0], { id: "b1", name: "Main Campus", code: "MN", isMain: true });
    });

    it("drops any extra column a repository might return", async () => {
        const repo = { ...fakeRepo(), listActiveBranches: async () => [{ id: "b1", name: "Main", code: "MN", isMain: true, address: "1 Road", phone: "080", principalStaffId: "p1" }] };
        const rows = await new ListAssignableBranchesUseCase({ staffRepository: repo as any }).execute(ALL_MANAGER);
        assert.deepEqual(Object.keys(rows[0]).sort(), ["code", "id", "isMain", "name"]);
    });
});

describe("assignable branches: agrees with PUT /staff/:id/branches", () => {
    /** Would the real SetStaffBranchesUseCase accept this branch for a staff member the actor is allowed to act on? */
    async function assignmentAccepts(a: StaffActor, branchId: string, targetBranches: string[]): Promise<boolean> {
        const uc = new SetStaffBranchesUseCase({
            staffRepository: fakeRepo({ id: "staff-2", branches: targetBranches }) as any,
            membershipService: { findByEntity: async () => null },
            accessService: { invalidate: () => {} },
            auditService: { log: async () => {} },
        } as any);
        try { await uc.execute("s1", "staff-2", { branchIds: [branchId] }, a); } catch (e: any) {
            // only the two "this branch is not assignable" answers count as a refusal; anything else is a real failure
            if (e.code === "BRANCH_FORBIDDEN" || e.code === "INVALID_BRANCHES") return false;
            throw e;
        }
        return true;
    }

    const cases: Array<[string, StaffActor, string[]]> = [
        ["school admin",                   SCHOOL_ADMIN,     ["b1"]],
        ["ALL-scope manager",              ALL_MANAGER,      ["b1"]],
        ["manager of one branch",          ONE_BRANCH,       ["b2"]],
        ["manager of several branches",    SEVERAL_BRANCHES, ["b3"]],
        ["manager with a stale branch id", STALE_BRANCH,     ["b2"]],
    ];
    for (const [label, who, targetBranches] of cases) {
        it(`${label}: the list equals the branches the assignment accepts`, async () => {
            const offered = new Set(ids(await list(who)));
            for (const b of BRANCHES) {
                assert.equal(await assignmentAccepts(who, b.id, targetBranches), offered.has(b.id), `assignment vs list for ${b.id} (${b.name})`);
            }
        });
    }

    it("a branch-limited manager cannot assign a branch outside their own, and the picker never offers one", async () => {
        const offered = ids(await list(ONE_BRANCH));
        assert.ok(!offered.includes("b3"));
        assert.equal(await assignmentAccepts(ONE_BRANCH, "b3", ["b2"]), false);
    });
});

describe("assignable branches: the route", () => {
    const src = readFileSync("src/modules/staff/routes/staff.routes.ts", "utf8");
    const lines = src.split("\n").filter(l => !l.trim().startsWith("|") && !l.trim().startsWith("//"));
    const at = (re: RegExp) => lines.findIndex(l => re.test(l));

    it("is GET /assignable-branches, guarded by staff.manage (the `manage` guard), not branches.view", () => {
        const i = at(/router\.get\("\/assignable-branches"/);
        assert.ok(i >= 0, "route exists");
        assert.match(lines[i], /\.\.\.manage\b/);
        assert.doesNotMatch(lines[i], /\.\.\.view\b|\.\.\.self\b/);
        assert.match(src, /const manage = \[authenticate, requireTenant, requirePermission\("staff\.manage"\)\]/);
        assert.doesNotMatch(lines.join("\n"), /branches\.view/);
    });

    it("is declared before GET /:id so it is not read as a staff id", () => {
        assert.ok(at(/router\.get\("\/assignable-branches"/) < at(/router\.get\("\/:id"/));
    });
});
