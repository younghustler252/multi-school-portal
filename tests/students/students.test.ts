import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Access } from "../../src/foundation/access.service";
import { validatePermissionRegistry, PERMISSION_REGISTRY } from "../../src/foundation/permissions.registry";
import { studentScopeWhere } from "../../src/modules/students/services/student-scope";
import { formatAdmissionNumber, admissionYear } from "../../src/modules/students/domain/student.policy";
import { CreateStudentDto, UpdateStudentDto, ListStudentsQuery, DeactivateStudentDto } from "../../src/modules/students/dtos/student.dto";
import { sniffImage } from "../../src/modules/students/usecases/upload-photo.usecase";
import { UpdateStudentUseCase } from "../../src/modules/students/usecases/update-student.usecase";
import { DeactivateStudentUseCase } from "../../src/modules/students/usecases/deactivate-student.usecase";
import { StudentMapper } from "../../src/modules/students/mappers/student.mapper";

const access = (scope: string | null, persona: "STAFF" | "STUDENT" | "GUARDIAN", entityId: string | null, grantsAll = false) =>
    new Access("school", "u1", "m1", persona, entityId, new Set(), grantsAll, new Map(scope ? [["students.view", scope as any]] : []));

describe("students permissions", () => {
    it("registry is valid and owns students.view and students.manage once", () => {
        assert.deepEqual(validatePermissionRegistry(), []);
        assert.equal(PERMISSION_REGISTRY.filter(p => p.key === "students.view").length, 1);
        assert.ok(PERMISSION_REGISTRY.some(p => p.key === "students.manage"));
    });
});

describe("student scope", () => {
    it("ALL sees everyone", () => assert.deepEqual(studentScopeWhere(access("ALL", "STAFF", "s1")), {}));
    it("a school admin (grantsAll) sees everyone", () => assert.deepEqual(studentScopeWhere(access(null, "STAFF", "s1", true)), {}));
    it("a student sees only themselves", () => assert.deepEqual(studentScopeWhere(access("OWN", "STUDENT", "st1")), { id: "st1" }));
    it("a guardian sees only linked children", () =>
        assert.deepEqual(studentScopeWhere(access("OWN", "GUARDIAN", "g1")), { guardianLinks: { some: { guardianId: "g1" } } }));
    it("BRANCH, ASSIGNED, staff OWN and no permission see nobody", () => {
        for (const a of [access("BRANCH", "STAFF", "s1"), access("ASSIGNED", "STAFF", "s1"), access("OWN", "STAFF", "s1"), access(null, "STAFF", "s1")])
            assert.deepEqual(studentScopeWhere(a), { id: { in: [] } });
    });
});

describe("admission numbers", () => {
    it("are formatted YEAR/0001", () => assert.equal(formatAdmissionNumber("2026", 7), "2026/0007"));
    it("use Nigerian time for the year", () => {
        assert.equal(admissionYear(new Date("2026-12-31T23:30:00Z")), "2027");   // already 00:30 on 1 Jan in Lagos
        assert.equal(admissionYear(new Date("2026-06-01T10:00:00Z")), "2026");
    });
});

describe("student DTOs", () => {
    it("create trims, treats blanks as not sent, and rejects unknown fields", () => {
        const ok = CreateStudentDto.parse({ firstName: "  Ada ", lastName: "Obi", middleName: "  ", gender: "", dateOfBirth: "2015-04-02" });
        assert.equal(ok.firstName, "Ada"); assert.equal(ok.middleName, undefined); assert.equal(ok.gender, undefined);
        assert.equal(CreateStudentDto.safeParse({ firstName: "A", lastName: "B", email: "a@b.com" }).success, false);
    });
    it("create rejects a future birth date and a bad admission number", () => {
        assert.equal(CreateStudentDto.safeParse({ firstName: "A", lastName: "B", dateOfBirth: "2999-01-01" }).success, false);
        assert.equal(CreateStudentDto.safeParse({ firstName: "A", lastName: "B", admissionNumber: "x y" }).success, false);
    });
    it("update needs at least one field, and blank clears an optional field", () => {
        assert.equal(UpdateStudentDto.safeParse({}).success, false);
        assert.equal((UpdateStudentDto.parse({ address: "" }) as any).address, null);
        assert.equal(UpdateStudentDto.safeParse({ firstName: "" }).success, false);
    });
    it("list query has safe defaults and a page-size cap", () => {
        assert.deepEqual(ListStudentsQuery.parse({}), { page: 1, limit: 20, status: "active" });
        assert.equal(ListStudentsQuery.safeParse({ limit: "100000" }).success, false);
    });
    it("deactivate accepts an empty body", () => assert.deepEqual(DeactivateStudentDto.parse(undefined), {}));
});

describe("photo check", () => {
    const pad = (b: number[]) => Buffer.concat([Buffer.from(b), Buffer.alloc(20)]);
    it("accepts real images by content", () => {
        assert.equal(sniffImage(pad([0xff, 0xd8, 0xff])), "image/jpeg");
        assert.equal(sniffImage(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
    });
    it("refuses other content, whatever the file is called", () => assert.equal(sniffImage(Buffer.from("<html>not an image at all</html>")), null));
});

// A tiny in-memory repository and audit log
const mapper = new StudentMapper();
const row = { id: "s1", userId: null, admissionNumber: "2026/0001", firstName: "Ada", lastName: "Obi", middleName: null, dateOfBirth: null, gender: "female", bloodGroup: null,
    address: "Old street", photoUrl: null, religion: null, nationality: "Nigerian", stateOfOrigin: null, isActive: true, admittedAt: null, createdAt: new Date(), updatedAt: new Date() };
function fakes(initial = row, other: any = null) {
    const state = { student: { ...initial }, updates: [] as any[], audits: [] as any[] };
    const studentRepository: any = {
        findById: async (id: string) => (id === state.student.id ? mapper.toDomain(state.student) : null),
        findByAdmissionNumber: async () => (other ? mapper.toDomain(other) : null),
        update: async (_id: string, data: any) => { state.updates.push(data); state.student = { ...state.student, ...data }; return mapper.toDomain(state.student); },
    };
    const auditService: any = { log: async (p: any) => { state.audits.push(p); } };
    return { state, d: { studentRepository, studentMapper: mapper, auditService } };
}
const actor = { userId: "u1" };

describe("update student", () => {
    it("writes and audits only what changed", async () => {
        const { state, d } = fakes();
        await new UpdateStudentUseCase(d).execute("sch", "s1", { firstName: "Ada", address: "New street" }, actor);
        assert.deepEqual(state.updates, [{ address: "New street" }]);
        assert.deepEqual(state.audits[0].oldValue, { address: "Old street" });
        assert.deepEqual(state.audits[0].newValue, { address: "New street" });
    });
    it("does nothing (and audits nothing) when nothing changed", async () => {
        const { state, d } = fakes();
        await new UpdateStudentUseCase(d).execute("sch", "s1", { address: "Old street" }, actor);
        assert.equal(state.updates.length, 0); assert.equal(state.audits.length, 0);
    });
    it("refuses an admission number that belongs to someone else", async () => {
        const { d } = fakes(row, { ...row, id: "s2" });
        await assert.rejects(new UpdateStudentUseCase(d).execute("sch", "s1", { admissionNumber: "2026/0002" }, actor), { code: "ADMISSION_NUMBER_TAKEN" });
    });
    it("reports a missing student", async () => {
        const { d } = fakes();
        await assert.rejects(new UpdateStudentUseCase(d).execute("sch", "nope", { address: "x" }, actor), { code: "NOT_FOUND" });
    });
});

describe("deactivate student", () => {
    it("deactivates once, audits the reason, then refuses a second time", async () => {
        const { state, d } = fakes();
        const uc = new DeactivateStudentUseCase(d);
        const r = await uc.execute("sch", "s1", { reason: "Left the school" }, actor);
        assert.equal(r.isActive, false);
        assert.equal(state.audits[0].action, "student.deactivated");
        assert.equal(state.audits[0].newValue.reason, "Left the school");
        await assert.rejects(uc.execute("sch", "s1", {}, actor), { statusCode: 409 });
    });
});
