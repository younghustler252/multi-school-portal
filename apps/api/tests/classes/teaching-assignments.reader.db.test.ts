/*
| THE CLASSES-OWNED READER of what a staff member leads and teaches, on a real database.
| The count is what Staff uses to block a category change and to warn on deactivation; it must be exactly what Staff
| used to compute for itself (subjects taught THIS term + classes led).
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";
import { seed } from "../attendance/fixtures";
import { ClassRepositoryImpl } from "../../src/modules/classes/repositories/class.repository.impl";
import { ClassMapper, SubjectMapper, ClassSubjectMapper, ClassProgressionMapper } from "../../src/modules/classes/mappers/class.mapper";
import { TeachingAssignmentsReader } from "../../src/modules/classes/services/teaching-assignments.reader";

describe("TeachingAssignmentsReader (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool; let S: any;
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    const reader = () => new TeachingAssignmentsReader({ classRepository: new ClassRepositoryImpl({ classMapper: new ClassMapper(), subjectMapper: new SubjectMapper(), classSubjectMapper: new ClassSubjectMapper(), classProgressionMapper: new ClassProgressionMapper() } as any) } as any);
    // the rule Staff used to run itself, written out independently here
    const oldCount = async (staffId: string) => (await db().classSubject.count({ where: { staffId, term: { isCurrent: true } } })) + (await db().class.count({ where: { classTeacherId: staffId } }));

    before(async () => { school = await createTestSchool(); S = await school.run(() => seed()); });
    after(async () => { await school.drop(); });

    it("counts classes led plus subjects taught THIS term, exactly as before", () => school.run(async () => {
        for (const t of [S.tA, S.tB, S.tC]) assert.equal(await reader().countActiveFor(t.id), await oldCount(t.id), t.firstName);
        assert.equal(await reader().countActiveFor(S.tA.id), 1, "Tola leads JSS 1A");
        assert.equal(await reader().countActiveFor(S.tB.id), 1, "Bisi teaches JSS 2A this term");
        assert.equal(await reader().countActiveFor(S.tC.id), 0, "Chuka only taught LAST term: nothing to hand over");
    }));
    it("a person with no assignments counts zero", () => school.run(async () => {
        const nobody = await db().staff.create({ data: { firstName: "Free", lastName: "Agent", category: "teaching" } });
        assert.equal(await reader().countActiveFor(nobody.id), 0);
    }));
    it("the classes led and the subjects taught are the Classes repository's own answers", () => school.run(async () => {
        const homerooms = await reader().homeroomsOf(S.tA.id);
        assert.deepEqual(homerooms.map((h: any) => h.className), ["JSS 1A"]);
        const taught = await reader().assignmentsOf(S.tB.id, S.term.id);
        assert.deepEqual(taught.map((a: any) => a.className), ["JSS 2A"]);
        assert.deepEqual(await reader().assignmentsOf(S.tC.id, S.term.id), [], "nothing this term");
    }));
});
