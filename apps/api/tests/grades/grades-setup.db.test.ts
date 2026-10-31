/*
| GRADES SETUP against a real database (a throwaway school with every tenant migration applied).
| Runs only when TEST_DATABASE_URL is set (the database name must contain "test"). Tests share one school and run in order.
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";
import { GradesSetupRepository } from "../../src/modules/grades/repositories/grades-setup.repository";
import * as U from "../../src/modules/grades/usecases/grades-setup.usecases";
import { gradeFor } from "../../src/modules/grades/domain/grades.policy";

describe("grades setup (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool; const audits: any[] = [];
    const actor = { userId: "user-admin" };
    const deps = () => ({ gradesSetupRepository: new GradesSetupRepository(), auditService: { log: async (p: any) => { audits.push(p); } } } as any);
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    const jss = [
        { minScore: 70, grade: "A", remark: "Distinction", isPass: true }, { minScore: 50, grade: "B", remark: "Credit", isPass: true },
        { minScore: 40, grade: "C", remark: "Pass", isPass: true },        { minScore: 0, grade: "F", remark: "Fail", isPass: false },
    ];
    const level = (r: any, l: string) => r.levels.find((x: any) => x.level === l);

    before(async () => { school = await createTestSchool(); });
    after(async () => { await school.drop(); });

    it("a new school already has the standard scale and the CA 40 + Exam 60 scheme, and every level uses them", () => school.run(async () => {
        const scales = await new U.ListScalesUseCase(deps()).execute();
        assert.deepEqual(scales.levels.map((l: any) => [l.level, l.usesDefault]), [["default", false], ["primary", true], ["jss", true], ["ss", true]]);
        const bands = level(scales, "default").scale.bands;
        assert.deepEqual(bands.map((b: any) => b.grade), ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"]);
        assert.deepEqual([bands[0].upTo, bands[1].upTo, bands[8].minScore, bands[8].isPass], [null, 75, 0, false]);
        const schemes = await new U.ListSchemesUseCase(deps()).execute();
        assert.deepEqual(level(schemes, "default").scheme.components.map((c: any) => [c.name, c.kind, c.maxScore]), [["CA", "ca", 40], ["Exam", "exam", 60]]);
        assert.equal(level(schemes, "ss").scheme.total, 100);
    }));

    it("74.5 gets a real grade from the stored scale (the old bands made it F9)", () => school.run(async () => {
        const bands = (await new GradesSetupRepository().scales()).find((s: any) => s.level === null)!.bands;
        assert.equal(gradeFor(bands, 74.5)!.grade, "B2");
    }));

    it("saves a JSS scale; other levels still use the default; the change is audited old to new", () => school.run(async () => {
        const r = await new U.SaveScaleUseCase(deps()).execute(school.schoolId, "jss", { bands: jss } as any, actor);
        assert.equal(level(r, "jss").usesDefault, false);
        assert.deepEqual(level(r, "jss").scale.bands.map((b: any) => b.grade), ["A", "B", "C", "F"]);
        assert.equal(level(r, "ss").usesDefault, true);
        const a = audits.find(x => x.action === "grades.scale_updated");
        assert.equal(a.oldValue.bands, null); assert.deepEqual(a.newValue.bands, ["A from 70", "B from 50", "C from 40", "F from 0 (fail)"]);
    }));

    it("an invalid scale is refused with the reasons, and nothing changes", () => school.run(async () => {
        const bad = jss.filter(b => b.minScore !== 0);
        await assert.rejects(() => new U.SaveScaleUseCase(deps()).execute(school.schoolId, "jss", { bands: bad } as any, actor), (e: any) => e.code === "GRADES_SCALE_INVALID" && /start at 0/.test(JSON.stringify(e.details)));
        assert.equal((await new GradesSetupRepository().scales()).find((s: any) => s.level === "jss")!.bands.length, 4);
        await assert.rejects(() => new U.SaveScaleUseCase(deps()).execute(school.schoolId, "primary-x", { bands: jss } as any, actor), (e: any) => e.code === "GRADES_LEVEL_INVALID");
    }));

    it("replacing a scale is all-or-nothing: if saving fails part-way the old scale is still there", () => school.run(async () => {
        const repo = new GradesSetupRepository();
        const broken = [{ minScore: 0, grade: "X", remark: "", isPass: false }, { minScore: 0, grade: "Y", remark: "", isPass: true }];   // skips validation on purpose: same start twice
        await assert.rejects(() => repo.saveScale("jss", broken as any));
        assert.deepEqual((await repo.scales()).find(s => s.level === "jss")!.bands.map(b => b.grade).sort(), ["A", "B", "C", "F"]);
    }));

    it("removing a level's scale falls back to the default; the default cannot be removed", () => school.run(async () => {
        const r = await new U.DeleteScaleUseCase(deps()).execute(school.schoolId, "jss", actor);
        assert.equal(level(r, "jss").usesDefault, true);
        await assert.rejects(() => new U.DeleteScaleUseCase(deps()).execute(school.schoolId, "default", actor), (e: any) => e.code === "GRADES_DEFAULT_REQUIRED");
        await assert.rejects(() => new U.DeleteScaleUseCase(deps()).execute(school.schoolId, "jss", actor), (e: any) => e.statusCode === 404);
    }));

    it("schemes: CA1 10 + CA2 10 + Assignment 20 + Exam 60 for primary; parts must add up to 100", () => school.run(async () => {
        const four = [{ name: "CA1", kind: "ca", maxScore: 10 }, { name: "CA2", kind: "ca", maxScore: 10 }, { name: "Assignment", kind: "ca", maxScore: 20 }, { name: "Exam", kind: "exam", maxScore: 60 }];
        const r = await new U.SaveSchemeUseCase(deps()).execute(school.schoolId, "primary", { components: four } as any, actor);
        assert.deepEqual(level(r, "primary").scheme.components.map((c: any) => c.name), ["CA1", "CA2", "Assignment", "Exam"]);
        assert.equal(level(r, "primary").scheme.total, 100); assert.equal(level(r, "jss").usesDefault, true);
        await assert.rejects(() => new U.SaveSchemeUseCase(deps()).execute(school.schoolId, "primary", { components: four.slice(0, 3) } as any, actor), (e: any) => e.code === "GRADES_SCHEME_INVALID");
        assert.equal(level(await new U.ListSchemesUseCase(deps()).execute(), "primary").scheme.components.length, 4, "unchanged");
        assert.deepEqual(audits.filter(x => x.action === "grades.scheme_updated").pop().newValue.parts, ["CA1 10 (ca)", "CA2 10 (ca)", "Assignment 20 (ca)", "Exam 60 (exam)"]);
        const gone = await new U.DeleteSchemeUseCase(deps()).execute(school.schoolId, "primary", actor);
        assert.equal(level(gone, "primary").usesDefault, true);
        await assert.rejects(() => new U.DeleteSchemeUseCase(deps()).execute(school.schoolId, "default", actor), (e: any) => e.code === "GRADES_DEFAULT_REQUIRED");
    }));

    it("the database itself refuses a second default, a band at 100 or more, and a part with no size", () => school.run(async () => {
        await assert.rejects(() => db().gradingScale.create({ data: { name: "Second default", level: null } }), /unique|Unique/);
        const scale = await db().gradingScale.create({ data: { name: "T", level: "ss" } });
        await assert.rejects(() => db().gradingBand.create({ data: { scaleId: scale.id, minScore: 100, grade: "A", remark: "" } }), /check|constraint/i);
        const scheme = await db().assessmentScheme.create({ data: { name: "T", level: "ss" } });
        await assert.rejects(() => db().assessmentComponent.create({ data: { schemeId: scheme.id, name: "Zero", kind: "ca", maxScore: 0, position: 1 } }), /check|constraint/i);
    }));
});
