import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { levelOfClass, validateBands, gradeFor, validateComponents, isLevelKey } from "../../src/modules/grades/domain/grades.policy";
import { SaveScaleDto, SaveSchemeDto } from "../../src/modules/grades/dtos/grades-setup.dto";
import { validatePermissionRegistry, PERMISSION_REGISTRY } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";

const waec = [
    { minScore: 75, grade: "A1", remark: "Excellent", isPass: true }, { minScore: 70, grade: "B2", remark: "Very Good", isPass: true },
    { minScore: 65, grade: "B3", remark: "Good", isPass: true },      { minScore: 60, grade: "C4", remark: "Credit", isPass: true },
    { minScore: 55, grade: "C5", remark: "Credit", isPass: true },    { minScore: 50, grade: "C6", remark: "Credit", isPass: true },
    { minScore: 45, grade: "D7", remark: "Pass", isPass: true },      { minScore: 40, grade: "E8", remark: "Pass", isPass: true },
    { minScore: 0,  grade: "F9", remark: "Fail", isPass: false },
];

describe("which grading level a class is in", () => {
    it("recognises primary, JSS and SS names; anything else uses the default", () => {
        for (const v of ["Primary 3", "Nursery 2", "Basic 5", "KG1"]) assert.equal(levelOfClass(v), "primary", v);
        for (const v of ["JSS", "jss 2", "Junior Secondary"]) assert.equal(levelOfClass(v), "jss", v);
        for (const v of ["SSS", "SS 3", "Senior Secondary"]) assert.equal(levelOfClass(v), "ss", v);
        for (const v of [null, undefined, "", "  ", "Gold class"]) assert.equal(levelOfClass(v as any), null, String(v));
    });
    it("level keys: default, primary, jss, ss only", () => {
        assert.deepEqual(["default", "primary", "jss", "ss", "SS", "x"].map(isLevelKey), [true, true, true, true, false, false]);
    });
});

describe("grade for a total (no gaps between bands)", () => {
    it("74.5 is B2, not a 'fail' (the old inclusive min/max bands lost it)", () => {
        assert.equal(gradeFor(waec, 74.5)!.grade, "B2");
        assert.equal(gradeFor(waec, 74.99)!.grade, "B2");
    });
    it("edges: exactly on a start, the top, the bottom, and out of range", () => {
        assert.deepEqual([75, 100, 70, 40, 39.99, 0, 120, -1].map(t => gradeFor(waec, t)!.grade), ["A1", "A1", "B2", "E8", "F9", "F9", "A1", "F9"]);
    });
});

describe("a valid scale", () => {
    it("the standard scale is valid", () => assert.deepEqual(validateBands(waec), []));
    it("a short school scale is valid", () => assert.deepEqual(validateBands([{ minScore: 50, grade: "Pass", remark: "", isPass: true }, { minScore: 0, grade: "Fail", remark: "", isPass: false }]), []));
    it("says what is wrong, in plain words", () => {
        const t = (b: any[]) => validateBands(b).join(" | ");
        assert.match(t(waec.filter(b => b.minScore !== 0)), /must start at 0/);
        assert.match(t([...waec, { minScore: 70, grade: "X", remark: "", isPass: true }]), /Two bands start at 70/);
        assert.match(t([...waec, { minScore: 10, grade: "a1", remark: "", isPass: false }]), /used twice/);
        assert.match(t(waec.map(b => ({ ...b, isPass: false }))), /at least one band must be a pass/i);
        assert.match(t(waec.map(b => b.grade === "C5" ? { ...b, isPass: false } : b)), /fail but sits above a pass/);
        assert.match(t([{ minScore: 100, grade: "A", remark: "", isPass: true }, { minScore: 0, grade: "F", remark: "", isPass: false }]), /below 100/);
        assert.match(t([]), /between 1 and 15/);
    });
});

describe("a valid assessment scheme", () => {
    const c = (name: string, kind: "ca" | "exam", maxScore: number) => ({ name, kind, maxScore });
    it("parts must add up to 100", () => {
        assert.deepEqual(validateComponents([c("CA", "ca", 40), c("Exam", "exam", 60)]), []);
        assert.deepEqual(validateComponents([c("CA1", "ca", 10), c("CA2", "ca", 10), c("Assignment", "ca", 20), c("Exam", "exam", 60)]), []);
        assert.deepEqual(validateComponents([c("A", "ca", 33.33), c("B", "exam", 66.67)]), []);
        assert.match(validateComponents([c("CA", "ca", 40), c("Exam", "exam", 50)]).join(), /add up to 90, but must add up to 100/);
        assert.match(validateComponents([c("CA", "ca", 50), c("Exam", "exam", 60)]).join(), /add up to 110/);
    });
    it("names are unique, maximums are above 0, and there are at most 8 parts", () => {
        assert.match(validateComponents([c("CA", "ca", 40), c("ca", "exam", 60)]).join(), /used twice/);
        assert.match(validateComponents([c("CA", "ca", 0), c("Exam", "exam", 100)]).join(), /above 0/);
        assert.match(validateComponents(Array.from({ length: 9 }, (_, i) => c("P" + i, "ca", 100 / 9))).join(), /between 1 and 8/);
    });
});

describe("requests and permissions", () => {
    it("unknown fields and bad shapes are refused", () => {
        assert.equal(SaveScaleDto.safeParse({ bands: waec }).success, true);
        assert.equal(SaveScaleDto.safeParse({ bands: waec, level: "jss" }).success, false);
        assert.equal(SaveScaleDto.safeParse({ bands: [{ minScore: "70", grade: "A", remark: "", isPass: true }] }).success, false);
        assert.equal(SaveSchemeDto.safeParse({ components: [{ name: "CA", kind: "quiz", maxScore: 40 }] }).success, false);
        assert.equal(SaveSchemeDto.safeParse({ components: [{ name: "CA", kind: "ca", maxScore: 100 }] }).success, true);
    });
    it("grades.view and grades.config are registered; only the admin changes the setup", () => {
        assert.deepEqual(validatePermissionRegistry(PERMISSION_REGISTRY), []);
        assert.deepEqual(PERMISSION_REGISTRY.filter(p => p.module === "grades").map(p => p.key).sort(), ["grades.config", "grades.view"]);
        const has = (role: string, scope: string) => ROLE_TEMPLATES.find(t => t.key === role)!.permissions.some(p => p.key === "grades.view" && p.scope === scope);
        assert.deepEqual([has("principal", "ALL"), has("teacher", "ASSIGNED"), has("student", "OWN"), has("guardian", "OWN")], [true, true, true, true]);
        assert.equal(ROLE_TEMPLATES.some(t => t.key !== "school_admin" && t.permissions.some(p => p.key === "grades.config")), false);
    });
});
