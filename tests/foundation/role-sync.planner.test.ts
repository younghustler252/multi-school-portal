import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planTemplateGrants, planSchoolRole, type SchoolRoleView, type TemplateView } from "../../src/foundation/role-grants.planner";

const g = (key: string, scope = "ALL") => ({ key, scope });

describe("planTemplateGrants", () => {
    it("exact: adds missing, fixes scope, removes extras", () => {
        const p = planTemplateGrants([g("a"), g("b", "OWN"), g("x")], [g("a"), g("b", "ALL"), g("c")], true);
        assert.deepEqual(p.add, [g("c")]);
        assert.deepEqual(p.rescope, [g("b", "ALL")]);
        assert.deepEqual(p.remove, ["x"]);
    });
    it("additive: only adds, never changes or removes", () => {
        const p = planTemplateGrants([g("a", "OWN"), g("x")], [g("a", "ALL"), g("c")], false);
        assert.deepEqual(p.add, [g("c")]);
        assert.deepEqual(p.rescope, []);
        assert.deepEqual(p.remove, []);
    });
    it("same grants give an empty plan", () => {
        const p = planTemplateGrants([g("a")], [g("a")], true);
        assert.equal(p.add.length + p.rescope.length + p.remove.length, 0);
    });
});

const tpl = (over: Partial<TemplateView> = {}): TemplateView => ({ key: "teacher", version: 3, isActive: true, grantsAll: false, grants: [g("classes.view", "ASSIGNED"), g("sessions.view")], ...over });
const role = (over: Partial<SchoolRoleView> = {}): SchoolRoleView => ({
    id: "r1", name: "Teacher", kind: "SYSTEM_EDITABLE", grantsAll: false, isCustomized: false,
    sourceTemplateKey: "teacher", sourceTemplateVersion: 2, grants: [g("classes.view", "ASSIGNED")], ...over,
});

describe("planSchoolRole", () => {
    it("editable role gains the missing permission and moves to the new version", () => {
        const a = planSchoolRole(role(), tpl(), false);
        assert.equal(a.type, "update");
        if (a.type === "update") { assert.deepEqual(a.plan.add, [g("sessions.view")]); assert.equal(a.version, 3); assert.equal(a.versionOnly, false); }
    });
    it("editable role keeps its own extras and own scopes (no prune)", () => {
        const a = planSchoolRole(role({ grants: [g("classes.view", "ALL"), g("custom.thing")] }), tpl(), false);
        assert.equal(a.type, "update");
        if (a.type === "update") { assert.deepEqual(a.plan.remove, []); assert.deepEqual(a.plan.rescope, []); }
    });
    it("editable role with prune is made exact", () => {
        const a = planSchoolRole(role({ grants: [g("classes.view", "ALL"), g("custom.thing")] }), tpl(), true);
        if (a.type !== "update") assert.fail();
        else { assert.deepEqual(a.plan.remove, ["custom.thing"]); assert.deepEqual(a.plan.rescope, [g("classes.view", "ASSIGNED")]); }
    });
    it("locked role is always made exact, including grantsAll", () => {
        const a = planSchoolRole(role({ kind: "SYSTEM_LOCKED", grantsAll: true, grants: [g("old")] }), tpl(), false);
        if (a.type !== "update") assert.fail();
        else { assert.deepEqual(a.plan.remove, ["old"]); assert.equal(a.grantsAll, false); }
    });
    it("editable role gains grantsAll but never loses it", () => {
        const gain = planSchoolRole(role({ grants: tpl().grants }), tpl({ grantsAll: true }), false);
        if (gain.type !== "update") assert.fail(); else assert.equal(gain.grantsAll, true);
        const keep = planSchoolRole(role({ grantsAll: true, grants: tpl().grants, sourceTemplateVersion: 3 }), tpl({ grantsAll: false }), false);
        assert.equal(keep.type, "none");
    });
    it("nothing to change and same version -> none; only the version behind -> version-only update", () => {
        assert.equal(planSchoolRole(role({ grants: tpl().grants, sourceTemplateVersion: 3 }), tpl(), false).type, "none");
        const v = planSchoolRole(role({ grants: tpl().grants, sourceTemplateVersion: 1 }), tpl(), false);
        if (v.type !== "update") assert.fail(); else assert.equal(v.versionOnly, true);
    });
    it("skips customised, custom, missing-template and inactive-template roles", () => {
        assert.deepEqual(planSchoolRole(role({ isCustomized: true }), tpl(), false), { type: "skip", reason: "customised" });
        assert.deepEqual(planSchoolRole(role({ kind: "CUSTOM", sourceTemplateKey: null }), tpl(), false), { type: "skip", reason: "custom_role" });
        assert.deepEqual(planSchoolRole(role(), undefined, false), { type: "skip", reason: "no_template" });
        assert.deepEqual(planSchoolRole(role(), tpl({ isActive: false }), false), { type: "skip", reason: "template_inactive" });
    });
});
