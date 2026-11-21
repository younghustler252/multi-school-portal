import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gradesViewWhere, sheetsViewWhere, mayViewSheet } from "../../src/modules/grades/services/grades-scope";
import { GRADES_PERMISSIONS } from "../../src/modules/grades/grades.permissions";

const acc = (scope: string, o: { persona?: string; me?: string | null; branches?: string[] } = {}) => ({
    persona: o.persona ?? "STAFF", personaEntityId: o.me === undefined ? "t1" : o.me,
    scopeOf: (k: string) => k === "grades.view" ? scope : null,
    branchScope: (k: string) => k !== "grades.view" ? null : scope === "ALL" ? "ALL" : (o.branches ?? []),
    canActInBranch: (k: string, b: string) => k === "grades.view" && (scope === "ALL" || (o.branches ?? []).includes(b)),
}) as any;

test("BRANCH grades visibility follows the class's branch on results, sheet lists and a single sheet", () => {
    const a = acc("BRANCH", { branches: ["b1"] });
    assert.deepEqual(gradesViewWhere(a), { classSubject: { class: { branchId: { in: ["b1"] } } } });
    assert.deepEqual(sheetsViewWhere(a), { class: { branchId: { in: ["b1"] } } });
    assert.equal(mayViewSheet(a, { staffId: "x", classTeacherId: "y", branchId: "b1" }), true);
    assert.equal(mayViewSheet(a, { staffId: "x", classTeacherId: "y", branchId: "b2" }), false);
    assert.equal(mayViewSheet(a, { staffId: "x", classTeacherId: "y" }), false);               // unknown branch: refused
    const none = acc("BRANCH", { branches: [] });
    assert.deepEqual(gradesViewWhere(none), { classSubject: { class: { branchId: { in: [] } } } });
    assert.equal(mayViewSheet(none, { staffId: "x", classTeacherId: "y", branchId: "b1" }), false);
});

test("a branch person never gets to change sheets (enter/submit never offer BRANCH)", () => {
    for (const k of ["grades.enter", "grades.submit", "grades.approve", "grades.publish", "grades.reopen", "grades.config"]) {
        const p = GRADES_PERMISSIONS.find(x => x.key === k)!;
        assert.ok(!(p.scopes as readonly string[]).includes("BRANCH"), k);
    }
});

test("families read the grading scales and only their own published grades; they hold no write or setup permission", () => {
    const own = acc("OWN", { persona: "STUDENT", me: "s1" });
    assert.deepEqual(gradesViewWhere(own), { studentId: "s1", sheet: { status: { in: ["published", "locked"] } } });
    assert.deepEqual(sheetsViewWhere(own), { id: { in: [] } });      // no sheet lists (drafts) for families
    const base = JSON.parse(readFileSync(join(__dirname, "../events/role-templates.baseline.json"), "utf8")).templates as Record<string, string[]>;
    for (const role of ["student", "guardian"]) {
        const g = base[role].filter(x => x.startsWith("grades."));
        assert.deepEqual(g, ["grades.view:OWN"], role);
    }
    const view = GRADES_PERMISSIONS.find(x => x.key === "grades.view")!;
    assert.ok((view.personas as readonly string[]).includes("STUDENT") && (view.personas as readonly string[]).includes("GUARDIAN"));
});
