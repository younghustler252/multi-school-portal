import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Access } from "../../src/foundation/access.service";
import { validatePermissionRegistry, PERMISSION_REGISTRY } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { EnrolStudentDto, BulkEnrolDto, UpdateEnrolmentDto, ListEnrolmentsQuery, PromotionPreviewQuery, PromoteStudentsDto } from "../../src/modules/enrolment/dtos/enrolment.dto";
import { enrolmentScopeWhere } from "../../src/modules/enrolment/services/enrolment-scope";
import { studentScopeWhere } from "../../src/modules/students/services/student-scope";
import { wouldOverflow } from "../../src/modules/enrolment/services/class-seats";
import { planPromotion } from "../../src/modules/enrolment/services/promotion-plan";
import { EnrolmentPresenter } from "../../src/modules/enrolment/services/enrolment-presenter";
import { ListEnrolmentsUseCase } from "../../src/modules/enrolment/usecases/list-enrolments.usecase";
import { EnrolStudentUseCase } from "../../src/modules/enrolment/usecases/enrol-student.usecase";
import { BulkEnrolUseCase } from "../../src/modules/enrolment/usecases/bulk-enrol.usecase";
import { UpdateEnrolmentUseCase } from "../../src/modules/enrolment/usecases/update-enrolment.usecase";
import { PreviewPromotionUseCase, PromoteStudentsUseCase } from "../../src/modules/enrolment/usecases/promotion.usecases";

const U = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${String(n).repeat(12)}`;
const [S1, S2, S3, C1, C2, C3, T1, T2, SES] = [U(1), U(2), U(3), U(4), U(5), U(6), U(7), U(8), U(0)];
const E1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";      // U(9) is kept as the "unknown id" in the tests
const actor = { userId: "u1" };
const access = (scope: string | null, persona: "STAFF" | "STUDENT" | "GUARDIAN", id: string | null, key = "enrolment.view") =>
    new Access("school", "u1", "m1", persona, id, new Set(), false, new Map(scope ? [[key, scope as any]] : []));

describe("enrolment permissions and templates", () => {
    it("registry is valid; three keys; staff roles see by scope, only the admin manages and promotes", () => {
        assert.deepEqual(validatePermissionRegistry(), []);
        for (const k of ["enrolment.view", "enrolment.manage", "enrolment.promote"]) assert.equal(PERMISSION_REGISTRY.filter(p => p.key === k).length, 1, k);
        const scopeOf = (role: string) => ROLE_TEMPLATES.find(t => t.key === role)!.permissions.find(p => p.key === "enrolment.view")?.scope;
        assert.deepEqual(["principal", "branch_principal", "teacher", "bursar", "student", "guardian"].map(scopeOf), ["ALL", "BRANCH", "ASSIGNED", "ALL", "OWN", "OWN"]);
        for (const t of ROLE_TEMPLATES) assert.ok(!t.permissions.some(p => p.key === "enrolment.manage" || p.key === "enrolment.promote"));
    });
});

describe("enrolment DTOs", () => {
    it("are strict and bounded", () => {
        assert.equal(EnrolStudentDto.safeParse({ studentId: S1, classId: C1, termId: T1 }).success, true);
        assert.equal(EnrolStudentDto.safeParse({ studentId: S1, classId: C1, termId: T1, status: "active" }).success, false);
        assert.equal(BulkEnrolDto.safeParse({ studentIds: Array(201).fill(S1), classId: C1, termId: T1 }).success, false);
        assert.equal(BulkEnrolDto.safeParse({ studentIds: [], classId: C1, termId: T1 }).success, false);
    });
    it("an update changes the status OR the class, never both or neither", () => {
        assert.equal(UpdateEnrolmentDto.safeParse({}).success, false);
        assert.equal(UpdateEnrolmentDto.safeParse({ status: "withdrawn", classId: C2 }).success, false);
        assert.equal(UpdateEnrolmentDto.safeParse({ status: "withdrawn", reason: "Left the school" }).success, true);
        assert.equal(UpdateEnrolmentDto.safeParse({ classId: C2 }).success, true);
    });
    it("list has safe defaults and a page cap; promotion exceptions need a class only for promote", () => {
        assert.deepEqual(ListEnrolmentsQuery.parse({}), { page: 1, limit: 20 });
        assert.equal(ListEnrolmentsQuery.safeParse({ limit: "5000" }).success, false);
        assert.equal(PromotionPreviewQuery.safeParse({ termId: "x" }).success, false);
        const body = (o: any) => PromoteStudentsDto.safeParse({ currentTermId: T1, newTermId: T2, overrides: [o] }).success;
        assert.equal(body({ studentId: S1, action: "promote", classId: C2 }), true);
        assert.equal(body({ studentId: S1, action: "promote" }), false);
        assert.equal(body({ studentId: S1, action: "repeat", classId: C2 }), false);
        assert.equal(body({ studentId: S1, action: "graduate" }), true);
        assert.deepEqual(PromoteStudentsDto.parse({ currentTermId: T1, newTermId: T2 }).overrides, []);
        assert.equal(PromoteStudentsDto.safeParse({ currentTermId: T1, newTermId: T2, rows: [] }).success, false);   // the browser no longer sends the plan
    });
});

describe("who may see which enrolments", () => {
    it("ALL, own, children, assigned teacher, and nobody", () => {
        assert.deepEqual(enrolmentScopeWhere(access("ALL", "STAFF", "t1")), {});
        assert.deepEqual(enrolmentScopeWhere(access("OWN", "STUDENT", "st1")), { studentId: "st1" });
        assert.deepEqual(enrolmentScopeWhere(access("OWN", "GUARDIAN", "g1")), { student: { guardianLinks: { some: { guardianId: "g1" } } } });
        const w: any = enrolmentScopeWhere(access("ASSIGNED", "STAFF", "t1"));
        assert.deepEqual(w.OR[0], { class: { classTeacherId: "t1" } });
        assert.deepEqual(w.OR[1].class.classSubjects.some, { staffId: "t1", term: { isCurrent: true } });
        for (const a of [access("BRANCH", "STAFF", "t1"), access(null, "STAFF", "t1"), access("OWN", "STAFF", "t1"), access("ASSIGNED", "STUDENT", "st1")])
            assert.deepEqual(enrolmentScopeWhere(a), { id: { in: [] } });
    });
    it("Students now unlocks ASSIGNED: students enrolled this term in a class the teacher leads or teaches", () => {
        const w: any = studentScopeWhere(access("ASSIGNED", "STAFF", "t1", "students.view"));
        assert.equal(w.enrolments.some.term.isCurrent, true);
        assert.deepEqual(w.enrolments.some.class.OR[0], { classTeacherId: "t1" });
        assert.deepEqual(studentScopeWhere(access("BRANCH", "STAFF", "t1", "students.view")), { id: { in: [] } });
        assert.deepEqual(studentScopeWhere(access("ASSIGNED", "GUARDIAN", "g1", "students.view")), { id: { in: [] } });
    });
});

describe("room in a class", () => {
    it("a class with no limit is never full; the limit counts the new students too", () => {
        assert.equal(wouldOverflow(null, 500, 50), false);
        assert.equal(wouldOverflow(30, 29, 1), false);
        assert.equal(wouldOverflow(30, 30, 1), true);
        assert.equal(wouldOverflow(30, 20, 11), true);
    });
});

describe("promotion plan", () => {
    const enrolments = [{ studentId: S1, classId: C1 }, { studentId: S2, classId: C2 }, { studentId: S3, classId: C3 }];
    it("follows the saved class order: promote, graduate, and a class with no order needs a decision", () => {
        const progression = new Map<string, string | null>([[C1, C2], [C2, null]]);
        const { rows, needsDecisionClassIds } = planPromotion({ enrolments, progression, overrides: [] });
        assert.deepEqual(rows.map(r => [r.action, r.toClassId]), [["promote", C2], ["graduate", null], ["needs_decision", null]]);
        assert.deepEqual(needsDecisionClassIds, [C3]);
    });
    it("exceptions replace the default and settle a missing order; unknown students are reported", () => {
        const progression = new Map<string, string | null>([[C1, C2], [C2, null]]);
        const r = planPromotion({ enrolments, progression, overrides: [
            { studentId: S1, action: "repeat" }, { studentId: S2, action: "exclude" }, { studentId: S3, action: "promote", classId: C1 }, { studentId: "ghost", action: "graduate" }] });
        assert.deepEqual(r.rows.map(x => [x.action, x.toClassId, x.overridden]), [["repeat", C1, true], ["exclude", null, true], ["promote", C1, true]]);
        assert.deepEqual(r.needsDecisionClassIds, []); assert.deepEqual(r.unknownOverrides, ["ghost"]);
    });
});

// ── fakes ────────────────────────────────────────────────────────────────────
const students: Record<string, any> = {
    [S1]: { id: S1, firstName: "Ada", lastName: "Obi", admissionNumber: "2026/0001", isActive: true },
    [S2]: { id: S2, firstName: "Bayo", lastName: "Eze", admissionNumber: "2026/0002", isActive: true },
    [S3]: { id: S3, firstName: "Chi", lastName: "Ode", admissionNumber: null, isActive: false },
};
const classes = [{ id: C1, name: "JSS 1", capacity: 30 }, { id: C2, name: "JSS 2", capacity: 30 }, { id: C3, name: "JSS 3", capacity: null }];
const sessions = [{ id: SES, name: "2025/2026", terms: [{ id: T1, name: "first" }, { id: T2, name: "second" }] }];
const row = (o: any = {}) => ({ id: E1, studentId: S1, classId: C1, termId: T1, status: "active", createdAt: new Date("2025-09-01"), ...o });

function world(over: any = {}) {
    const state = { audits: [] as any[], paginate: null as any, finds: [] as any[] };
    const enrolmentRepository: any = {
        findById: async (id: string) => (id === E1 ? (over.enrolment ?? row()) : null),
        findByStudentAndTerm: async () => over.existing ?? null,
        findMany: async (w: any) => { state.finds.push(w); return over.findMany ? over.findMany(w) : []; },
        paginate: async (p: any) => { state.paginate = p; return { data: over.rows ?? [row()], meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false } }; },
    };
    const studentRepository: any = {
        findById: async (id: string) => students[id] ?? null,
        findMany: async (w: any) => (w.id?.in ?? []).map((id: string) => students[id]).filter(Boolean),
    };
    const classRepository: any = {
        findClassById: async (id: string) => classes.find(c => c.id === id) ?? null, findAllClasses: async () => classes,
        findAllClassProgressions: async () => over.progression ?? [],
    };
    const startOf: Record<string, Date> = { [T1]: new Date("2025-09-08"), [T2]: new Date("2026-01-05") };
    const sessionRepository: any = {
        findTermById: async (id: string) => (startOf[id] ? { id, startDate: startOf[id] } : null),
        findCurrentTerm: async () => ({ id: T1 }), findAllSessions: async () => sessions,
    };
    const studentPhotoService: any = { toResponses: async (list: any[]) => list.map(s => ({ ...s, photoUrl: "https://signed.test/" + s.id })) };
    const enrolmentPresenter = new EnrolmentPresenter({ studentRepository, studentPhotoService, classRepository, sessionRepository });
    const auditService: any = { log: async (p: any) => { state.audits.push(p); } };
    return { state, deps: { enrolmentRepository, studentRepository, classRepository, sessionRepository, enrolmentPresenter, auditService } };
}

describe("class list", () => {
    it("is limited by scope, defaults to the current term, searches every word, and answers with names", async () => {
        const { deps, state } = world();
        const out = await new ListEnrolmentsUseCase(deps).execute({ page: 1, limit: 20, search: "ada obi", status: "active" } as any, access("OWN", "STUDENT", S1));
        const and = state.paginate.where.AND;
        assert.deepEqual(and[0], { studentId: S1 }); assert.deepEqual(and[1], { termId: T1 }); assert.deepEqual(and[4], { status: "active" });
        assert.equal(and.length, 7);                                    // scope, term, class, student, status, and one filter per word typed
        assert.deepEqual(and.slice(2, 4), [{}, {}]);
        const e = out.data[0];
        assert.deepEqual(e.student, { id: S1, name: "Ada Obi", admissionNumber: "2026/0001", photoUrl: "https://signed.test/" + S1 });
        assert.deepEqual(e.class, { id: C1, name: "JSS 1" }); assert.deepEqual(e.term, { id: T1, name: "first", session: { id: SES, name: "2025/2026" } });
    });
});

describe("enrol one student (checks before saving)", () => {
    const dto = { studentId: S1, classId: C1, termId: T1 };
    it("unknown student, class or term; an inactive student", async () => {
        const uc = new EnrolStudentUseCase(world().deps);
        await assert.rejects(uc.execute("s", { ...dto, studentId: U(9) }, actor), { code: "NOT_FOUND" });
        await assert.rejects(uc.execute("s", { ...dto, studentId: S3 }, actor), { code: "STUDENT_INACTIVE" });
        await assert.rejects(uc.execute("s", { ...dto, classId: U(9) }, actor), { code: "NOT_FOUND" });
        await assert.rejects(uc.execute("s", { ...dto, termId: U(9) }, actor), { code: "NOT_FOUND" });
    });
    it("a second enrolment in the same term names the class they are already in", async () => {
        const { deps } = world({ existing: row({ classId: C2, status: "active" }) });
        await assert.rejects(new EnrolStudentUseCase(deps).execute("s", dto, actor), { code: "ENROLMENT_ALREADY_EXISTS", details: { status: "active", class: "JSS 2" } });
    });
});

describe("enrol a list (skips reported by name)", () => {
    it("when nobody can be enrolled nothing is saved, and each skip has a reason", async () => {
        const { deps, state } = world({ findMany: (w: any) => (w.termId === T1 && w.studentId ? [row({ studentId: S2 })] : []) });
        const out = await new BulkEnrolUseCase(deps).execute("s", { studentIds: [S2, S3, U(9)], classId: C1, termId: T1 }, actor);
        assert.deepEqual(out.enrolled, []);
        assert.deepEqual(out.skipped.map(s => [s.student.name, s.reason]), [["Bayo Eze", "already_enrolled"], ["Chi Ode", "inactive"], [null, "not_found"]]);
        assert.deepEqual([out.class.name, out.term?.session?.name], ["JSS 1", "2025/2026"]); assert.equal(state.audits.length, 0);
    });
    it("unknown class or term", async () => {
        const uc = new BulkEnrolUseCase(world().deps);
        await assert.rejects(uc.execute("s", { studentIds: [S1], classId: U(9), termId: T1 }, actor), { code: "NOT_FOUND" });
        await assert.rejects(uc.execute("s", { studentIds: [S1], classId: C1, termId: U(9) }, actor), { code: "NOT_FOUND" });
    });
});

describe("change an enrolment", () => {
    it("only active enrolments can be moved, and not into the same class or an unknown one", async () => {
        await assert.rejects(new UpdateEnrolmentUseCase(world().deps).execute("s", E1, { classId: C1 }, actor), { code: "ENROLMENT_SAME_CLASS" });
        await assert.rejects(new UpdateEnrolmentUseCase(world().deps).execute("s", E1, { classId: U(9) }, actor), { code: "NOT_FOUND" });
        await assert.rejects(new UpdateEnrolmentUseCase(world({ enrolment: row({ status: "withdrawn" }) }).deps).execute("s", E1, { classId: C2 }, actor), { code: "ENROLMENT_NOT_ACTIVE" });
        await assert.rejects(new UpdateEnrolmentUseCase(world().deps).execute("s", U(9), { classId: C2 }, actor), { code: "NOT_FOUND" });
    });
    it("status rules: same status is a no-op; active becomes closed; a closed one can only re-open, and only for an active student", async () => {
        const same = world(); const out = await new UpdateEnrolmentUseCase(same.deps).execute("s", E1, { status: "active" }, actor);
        assert.equal(out.status, "active"); assert.equal(same.state.audits.length, 0);
        await assert.rejects(new UpdateEnrolmentUseCase(world({ enrolment: row({ status: "withdrawn" }) }).deps).execute("s", E1, { status: "completed" }, actor), { code: "ENROLMENT_STATUS_INVALID", details: { from: "withdrawn", to: "completed" } });
        await assert.rejects(new UpdateEnrolmentUseCase(world({ enrolment: row({ status: "withdrawn", studentId: S3 }) }).deps).execute("s", E1, { status: "active" }, actor), { code: "STUDENT_INACTIVE" });
    });
});

describe("promotion", () => {
    const progression = [{ fromClassId: C1, toClassId: C2 }, { fromClassId: C2, toClassId: null }];
    const active = (w: any) => (w.termId === T1 && w.status === "active" ? [row(), row({ id: "e2", studentId: S2, classId: C2 })] : w.termId === T2 ? [row({ id: "e3", studentId: S1, termId: T2, classId: C2 })] : []);
    it("the preview comes from the saved class order, with names, and flags students already placed in the new term", async () => {
        const { deps } = world({ progression, findMany: active });
        const out = await new PreviewPromotionUseCase(deps).execute({ termId: T1, newTermId: T2 });
        assert.deepEqual(out.summary, { total: 2, promote: 1, graduate: 1, needsDecision: 0, alreadyEnrolled: 1 });
        assert.deepEqual(out.rows[0], { student: { id: S1, name: "Ada Obi", admissionNumber: "2026/0001" }, fromClass: { id: C1, name: "JSS 1" }, toClass: { id: C2, name: "JSS 2" }, action: "promote", alreadyEnrolled: true });
        assert.equal(out.rows[1].toClass, null);
        const none = await new PreviewPromotionUseCase(world({ progression: [], findMany: active }).deps).execute({ termId: T1 });
        assert.deepEqual(none.classesWithoutNextClass.map(c => c.name), ["JSS 1", "JSS 2"]); assert.equal(none.summary.needsDecision, 2);
    });
    it("promote refuses: same term, a term that is not later, unknown students, and classes without a decision", async () => {
        const d = (o: any = {}) => new PromoteStudentsUseCase(world({ progression, findMany: active, ...o }).deps);
        await assert.rejects(d().execute("s", { currentTermId: T1, newTermId: T1, overrides: [] }, actor), { code: "PROMOTION_SAME_TERM" });
        await assert.rejects(d().execute("s", { currentTermId: T2, newTermId: T1, overrides: [] }, actor), { code: "PROMOTION_TERM_ORDER" });
        await assert.rejects(d().execute("s", { currentTermId: T1, newTermId: U(9), overrides: [] }, actor), { code: "NOT_FOUND" });
        await assert.rejects(d().execute("s", { currentTermId: T1, newTermId: T2, overrides: [{ studentId: S3, action: "graduate" }] }, actor), { code: "PROMOTION_UNKNOWN_STUDENT" });
        await assert.rejects(d({ progression: [] }).execute("s", { currentTermId: T1, newTermId: T2, overrides: [] }, actor), { code: "PROMOTION_NEEDS_DECISIONS", details: { classes: ["JSS 1", "JSS 2"] } });
        await assert.rejects(d().execute("s", { currentTermId: T1, newTermId: T2, overrides: [{ studentId: S1, action: "promote", classId: U(9) }] }, actor), { code: "NOT_FOUND" });
    });
});
