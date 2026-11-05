import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Access } from "../../src/foundation/access.service";
import { MyPermissionsUseCase } from "../../src/modules/user/usecases/my-permissions.usecase";
import { PERMISSION_REGISTRY } from "../../src/foundation/permissions.registry";

const MAIN = { id: "b-main", name: "Main", isMain: true }, NORTH = { id: "b-north", name: "North", isMain: false };
const staff = (perms: Array<[string, any]>, opts: { all?: boolean; branches?: string[]; persona?: any } = {}) =>
    new Access("school", "u1", "m1", opts.persona ?? "STAFF", "s1", new Set(["role_x"]), !!opts.all, new Map(perms), new Set(opts.branches ?? []));
const run = (a: Access, branches = [MAIN, NORTH]) => new MyPermissionsUseCase({}, async () => branches).execute(a);

describe("GET /users/me/permissions: what this session may do", () => {
    it("a role that holds everything is expanded to every school permission at ALL scope (and no platform ones)", async () => {
        const out = await run(staff([], { all: true }));
        const schoolKeys = PERMISSION_REGISTRY.filter(p => !p.key.startsWith("platform.")).map(p => p.key).sort();
        assert.deepEqual(out.permissions.map(p => p.key), schoolKeys);
        assert.ok(out.permissions.every(p => p.scope === "ALL"));
        assert.equal(out.holdsEverything, true);
    });
    it("a branch principal gets exactly their permissions with their scopes, sorted, and the branches they work in", async () => {
        const out = await run(staff([["students.view", "BRANCH"], ["classes.view", "BRANCH"], ["sessions.view", "ALL"]], { branches: ["b-north"] }));
        assert.deepEqual(out.permissions, [{ key: "classes.view", scope: "BRANCH" }, { key: "sessions.view", scope: "ALL" }, { key: "students.view", scope: "BRANCH" }]);
        assert.deepEqual(out.branches.assigned, [NORTH]);
        assert.deepEqual(out.branches.all, [MAIN, NORTH]);
        assert.equal(out.branches.schoolHasSeveral, true);
        assert.equal(out.holdsEverything, false);
    });
    it("a school with one branch tells the screen to hide every branch picker", async () => {
        assert.equal((await run(staff([["classes.view", "ALL"]]), [MAIN])).branches.schoolHasSeveral, false);
    });
    it("a student or guardian never gets the branch list, and platform permissions never appear in a school session", async () => {
        for (const persona of ["STUDENT", "GUARDIAN"]) {
            const out = await run(staff([["grades.view", "OWN"], ["platform.settings.manage", "ALL"]], { persona }));
            assert.deepEqual(out.branches.all, []); assert.deepEqual(out.branches.assigned, []);
            assert.deepEqual(out.permissions, [{ key: "grades.view", scope: "OWN" }]);
        }
    });
    it("a platform session reads no school branches and shows only platform permissions", async () => {
        const a = new Access("platform", "u9", "pm1", null, null, new Set(["super_admin"]), false, new Map([["platform.settings.manage", "ALL"], ["students.view", "ALL"]] as any));
        let asked = false;
        const out = await new MyPermissionsUseCase({}, async () => { asked = true; return [MAIN]; }).execute(a);
        assert.equal(asked, false);
        assert.deepEqual(out.permissions.map(p => p.key), ["platform.settings.manage"]);
        assert.equal(out.branches.schoolHasSeveral, false);
    });
});

import { accessOf, type MyPermissions } from "../../../../packages/contracts/src/me-permissions";
describe("the web helper built on the response", () => {
    const base: MyPermissions = {
        realm: "school", persona: "STAFF", roles: ["branch_principal"], holdsEverything: false,
        permissions: [{ key: "students.view", scope: "BRANCH" }, { key: "sessions.view", scope: "ALL" }, { key: "grades.view", scope: "OWN" }],
        branches: { all: [MAIN, NORTH], assigned: [NORTH], schoolHasSeveral: true },
    };
    it("can / canAtLeast / scopeOf / canAny", () => {
        const me = accessOf(base);
        assert.equal(me.can("students.view"), true); assert.equal(me.can("students.transfer"), false);
        assert.equal(me.canAtLeast("students.view", "BRANCH"), true); assert.equal(me.canAtLeast("students.view", "ALL"), false);
        assert.equal(me.canAtLeast("grades.view", "ASSIGNED"), false);
        assert.equal(me.scopeOf("sessions.view"), "ALL"); assert.equal(me.scopeOf("nope"), null);
        assert.equal(me.canAny("students.transfer", "sessions.view"), true); assert.equal(me.canAny("a", "b"), false);
    });
    it("branch pickers: ALL sees every branch, BRANCH only theirs, and none at all when the school has one branch", () => {
        const me = accessOf(base);
        assert.deepEqual(me.branchChoices("sessions.view"), [MAIN, NORTH]);
        assert.deepEqual(me.branchChoices("students.view"), [NORTH]);
        assert.deepEqual(me.branchChoices("grades.view"), []);
        assert.deepEqual(accessOf({ ...base, branches: { ...base.branches, schoolHasSeveral: false } }).branchChoices("sessions.view"), []);
    });
});
