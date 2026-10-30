import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SubjectPresenter } from "../../src/modules/classes/services/subject-presenter";
import { EnrolmentPresenter } from "../../src/modules/enrolment/services/enrolment-presenter";

describe("a missing class, subject or student is null, never a made-up 'Unknown'", () => {
    it("assignments: a deleted class / subject comes back as null; real ones keep their names", async () => {
        const p = new SubjectPresenter({
            classRepository: { findAllSubjects: async () => [{ id: "sub1", name: "Maths", code: "MTH" }], findClassById: async (id: string) => (id === "c1" ? { id: "c1", name: "JSS 1" } : null) },
            sessionRepository: { findTermById: async () => null, findSessionById: async () => null },
            staffNameLookup: { byIds: async () => new Map() },
        } as any);
        const [ok, gone] = await p.assignments([
            { id: "a1", classId: "c1", subjectId: "sub1", staffId: "t1", termId: "tm", assignedVia: "default" },
            { id: "a2", classId: "cX", subjectId: "subX", staffId: "t1", termId: "tm", assignedVia: "default" },
        ]);
        assert.deepEqual(ok.class, { id: "c1", name: "JSS 1" }); assert.deepEqual(ok.subject, { id: "sub1", name: "Maths", code: "MTH" });
        assert.equal(gone.class, null); assert.equal(gone.subject, null);
    });
    it("enrolments: a missing student / class is null; a real one keeps name, admission number and photo", async () => {
        const p = new EnrolmentPresenter({
            studentRepository: { findMany: async () => [{ id: "s1", firstName: "Ada", lastName: "Obi", admissionNumber: "A/1" }] },
            studentPhotoService: { toResponses: async (l: any[]) => l.map(s => ({ ...s, photoUrl: "u" })) },
            classRepository: { findAllClasses: async () => [{ id: "c1", name: "JSS 1" }] },
            sessionRepository: { findAllSessions: async () => [] },
        } as any);
        const now = new Date();
        const [ok, gone] = await p.many([
            { id: "e1", studentId: "s1", classId: "c1", termId: "t", status: "active", createdAt: now },
            { id: "e2", studentId: "sX", classId: "cX", termId: "t", status: "active", createdAt: now },
        ]);
        assert.deepEqual(ok.student, { id: "s1", name: "Ada Obi", admissionNumber: "A/1", photoUrl: "u" }); assert.deepEqual(ok.class, { id: "c1", name: "JSS 1" });
        assert.equal(gone.student, null); assert.equal(gone.class, null);
    });
});
