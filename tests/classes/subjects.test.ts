import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CreateSubjectDto, UpdateSubjectDto, AssignSubjectDto, BulkAssignSubjectsDto, SetSubjectDefaultTeacherDto } from "../../src/modules/classes/dtos/class.dto";
import { StaffNameLookup } from "../../src/modules/classes/services/staff-names";
import { SubjectPresenter } from "../../src/modules/classes/services/subject-presenter";
import { requireTeachingStaff } from "../../src/modules/classes/services/teacher-rule";
import { CreateSubjectUseCase } from "../../src/modules/classes/usecases/school-admin/create-subject.usecase";
import { UpdateSubjectUseCase } from "../../src/modules/classes/usecases/school-admin/update-subject.usecase";
import { SetSubjectDefaultTeacherUseCase } from "../../src/modules/classes/usecases/school-admin/set-subject-default-teacher.usecase";
import { AssignSubjectUseCase } from "../../src/modules/classes/usecases/school-admin/assign-subject.usecase";
import { BulkAssignSubjectsUseCase } from "../../src/modules/classes/usecases/school-admin/bulk-assign-subject.usecase";
import { GetClassSubjectsUseCase } from "../../src/modules/classes/usecases/school-admin/get-class-subjects.usecase";

const U = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${String(n).repeat(12)}`;
const CLASS = U(1), SUBJ = U(2), SUBJ2 = U(3), TEACHER = U(4), TEACHER2 = U(5), TERM = U(6), SESSION = U(7);
const actor = { userId: "u1" };

describe("subject DTOs", () => {
    it("code is saved in capitals; bad codes, unknown fields and blank names are refused", () => {
        assert.equal(CreateSubjectDto.parse({ name: " Maths ", code: " mth-1 " }).code, "MTH-1");
        assert.equal(CreateSubjectDto.parse({ name: "Maths", code: " " }).code, undefined);
        assert.equal(CreateSubjectDto.safeParse({ name: "Maths", code: "bad code!" }).success, false);
        assert.equal(CreateSubjectDto.safeParse({ name: "Maths", defaultTeacherId: TEACHER }).success, false);
        assert.equal(CreateSubjectDto.safeParse({ name: "  " }).success, false);
    });
    it("update needs one field; null clears code and description", () => {
        assert.equal(UpdateSubjectDto.safeParse({}).success, false);
        assert.deepEqual({ code: (UpdateSubjectDto.parse({ code: "" }) as any).code, d: (UpdateSubjectDto.parse({ description: null }) as any).description }, { code: null, d: null });
    });
    it("assignment bodies are strict, and bulk is capped at 50 subjects", () => {
        assert.equal(AssignSubjectDto.safeParse({ subjectId: SUBJ, staffId: TEACHER, termId: TERM }).success, true);
        assert.equal(AssignSubjectDto.safeParse({ subjectId: SUBJ, staffId: TEACHER, termId: TERM, assignedVia: "auto" }).success, false);
        assert.equal(BulkAssignSubjectsDto.safeParse({ staffId: TEACHER, termId: TERM, subjectIds: Array(51).fill(SUBJ) }).success, false);
        assert.equal(BulkAssignSubjectsDto.safeParse({ staffId: TEACHER, termId: TERM, subjectIds: [] }).success, false);
        assert.equal(SetSubjectDefaultTeacherDto.safeParse({ staffId: null }).success, true);
    });
});

// ── fakes ────────────────────────────────────────────────────────────────────
const teaching = (id: string, o: any = {}) => ({ id, userId: "u-" + id, isActive: true, category: "teaching", ...o });
function world(over: any = {}) {
    const state = { audits: [] as any[], created: [] as any[], updated: [] as any[], cascades: [] as any[], defaultSet: [] as any[] };
    const subjects = over.subjects ?? [{ id: SUBJ, name: "Maths", code: "MTH", description: null, defaultTeacherId: null, createdAt: new Date() }, { id: SUBJ2, name: "English", code: null, description: null, defaultTeacherId: TEACHER, createdAt: new Date() }];
    const staff: Record<string, any> = over.staff ?? { [TEACHER]: teaching(TEACHER), [TEACHER2]: teaching(TEACHER2) };
    const classRepository: any = {
        findAllSubjects: async () => subjects, findSubjectById: async (id: string) => subjects.find((s: any) => s.id === id) ?? null,
        findClassById: async (id: string) => (id === CLASS ? { id: CLASS, name: "JSS 1" } : null),
        createSubject: async (d: any) => { state.created.push(d); return { id: "new", description: null, code: null, defaultTeacherId: null, createdAt: new Date(), ...d }; },
        updateSubject: async (id: string, d: any) => { state.updated.push(d); return { ...subjects.find((s: any) => s.id === id), ...d }; },
        setSubjectDefaultTeacher: async (id: string, staffId: string | null) => { state.defaultSet.push(staffId); return { ...subjects.find((s: any) => s.id === id), defaultTeacherId: staffId }; },
        findClassSubject: async () => over.existing ?? null,
        updateClassSubject: async (id: string, d: any) => { state.updated.push(d); return { id, classId: CLASS, subjectId: SUBJ, termId: TERM, ...d }; },
        assignSubject: async (d: any) => { state.created.push(d); return { id: "cs1", ...d }; },
        findClassSubjects: async () => over.taken ?? [],
        findClassSubjectsEnriched: async () => over.rows ?? [],
    };
    const staffRepository: any = { findById: async (id: string) => staff[id] ?? null, findMany: async (w: any) => w.id.in.map((id: string) => staff[id]).filter(Boolean) };
    const userRepository: any = { findByIds: async (ids: string[]) => ids.map(id => ({ id, firstName: "Ada", lastName: id.slice(0, 4) })) };
    const sessionRepository: any = {
        findTermById: async (id: string) => (id === TERM ? { id: TERM, name: "first", sessionId: SESSION } : null),
        findSessionById: async () => ({ id: SESSION, name: "2025/2026" }), findCurrentTerm: async () => ({ id: TERM }),
    };
    const staffNameLookup = new StaffNameLookup({ staffRepository, userRepository });
    const subjectPresenter = new SubjectPresenter({ classRepository, sessionRepository, staffNameLookup });
    const auditService: any = { log: async (p: any) => { state.audits.push(p); } };
    const classSubjectResolutionService: any = { recascadeSubjectDefault: async (...a: any[]) => { state.cascades.push(a); } };
    return { state, deps: { classRepository, staffRepository, sessionRepository, staffNameLookup, subjectPresenter, auditService, classSubjectResolutionService } };
}

describe("teaching staff rule", () => {
    it("unknown staff is not found; inactive or non-teaching staff is refused; a teacher passes", async () => {
        const { deps } = world({ staff: { a: teaching("a"), b: teaching("b", { isActive: false }), c: teaching("c", { category: "non_teaching" }) } });
        const invalid = () => new Error("bad");
        await assert.rejects(requireTeachingStaff(deps.staffRepository, "zz", invalid), { code: "NOT_FOUND" });
        await assert.rejects(requireTeachingStaff(deps.staffRepository, "b", invalid), /bad/);
        await assert.rejects(requireTeachingStaff(deps.staffRepository, "c", invalid), /bad/);
        assert.equal((await requireTeachingStaff(deps.staffRepository, "a", invalid)).id, "a");
    });
});

describe("create and update subject", () => {
    it("name and code are unique whatever the capitals; the answer shows the default teacher as a name", async () => {
        const { deps, state } = world();
        const uc = new CreateSubjectUseCase(deps);
        await assert.rejects(uc.execute("s", { name: "maths" }, actor), { code: "SUBJECT_NAME_TAKEN" });
        await assert.rejects(uc.execute("s", { name: "Physics", code: "mth" }, actor), { code: "SUBJECT_CODE_TAKEN" });
        const out = await uc.execute("s", { name: "Physics", code: "PHY" }, actor);
        assert.equal(out.defaultTeacher, null); assert.equal(state.audits[0].action, "subject.created");
    });
    it("update writes and audits only what changed, and refuses a taken name or code", async () => {
        const { deps, state } = world();
        const uc = new UpdateSubjectUseCase(deps);
        await uc.execute("s", SUBJ, { name: "Maths", code: "MTH" }, actor);
        assert.equal(state.updated.length, 0);
        await assert.rejects(uc.execute("s", SUBJ, { name: "ENGLISH" }, actor), { code: "SUBJECT_NAME_TAKEN" });
        await uc.execute("s", SUBJ2, { description: "Reading and writing" }, actor);
        assert.deepEqual(state.updated[0], { description: "Reading and writing" });
        assert.equal(state.audits[0].oldValue.subject, "English");
        await assert.rejects(uc.execute("s", U(9), { name: "x" }, actor), { code: "NOT_FOUND" });
    });
});

describe("subject default teacher", () => {
    it("must be active teaching staff; the change is saved, followed through this term, audited with names", async () => {
        const { deps, state } = world({ staff: { [TEACHER]: teaching(TEACHER), [TEACHER2]: teaching(TEACHER2), x: teaching("x", { category: "non_teaching" }) } });
        const uc = new SetSubjectDefaultTeacherUseCase(deps);
        await assert.rejects(uc.execute("s", SUBJ2, "x", actor), { code: "SUBJECT_TEACHER_INVALID" });
        const out = await uc.execute("s", SUBJ2, TEACHER2, actor);
        assert.deepEqual(state.defaultSet, [TEACHER2]); assert.equal(state.cascades.length, 1);
        assert.equal(out.defaultTeacher?.id, TEACHER2);
        assert.ok(state.audits[0].oldValue.teacher && state.audits[0].newValue.teacher);
        assert.notEqual(state.audits[0].newValue.teacher, TEACHER2);                    // a name, not an id
    });
    it("the same teacher again changes nothing; null clears", async () => {
        const { deps, state } = world();
        const uc = new SetSubjectDefaultTeacherUseCase(deps);
        await uc.execute("s", SUBJ2, TEACHER, actor);
        assert.equal(state.defaultSet.length, 0); assert.equal(state.audits.length, 0);
        await uc.execute("s", SUBJ2, null, actor);
        assert.deepEqual(state.defaultSet, [null]);
    });
});

describe("assign a subject teacher", () => {
    const dto = { subjectId: SUBJ, staffId: TEACHER, termId: TERM };
    it("checks the class, subject, term and teacher before saving", async () => {
        const uc = new AssignSubjectUseCase(world().deps);
        await assert.rejects(uc.execute("s", U(9), dto, actor), { code: "NOT_FOUND" });
        await assert.rejects(uc.execute("s", CLASS, { ...dto, subjectId: U(9) }, actor), { code: "NOT_FOUND" });
        await assert.rejects(uc.execute("s", CLASS, { ...dto, termId: U(9) }, actor), { code: "NOT_FOUND" });
        await assert.rejects(uc.execute("s", CLASS, { ...dto, staffId: U(9) }, actor), { code: "NOT_FOUND" });
        const bad = world({ staff: { [TEACHER]: teaching(TEACHER, { category: "non_teaching" }) } });
        await assert.rejects(new AssignSubjectUseCase(bad.deps).execute("s", CLASS, dto, actor), { code: "SUBJECT_TEACHER_INVALID" });
    });
    it("a new assignment is manual and answers with names (class, subject, teacher, term and its session)", async () => {
        const { deps, state } = world();
        const out = await new AssignSubjectUseCase(deps).execute("s", CLASS, dto, actor);
        assert.equal(state.created[0].assignedVia, "manual");
        assert.deepEqual(out.class, { id: CLASS, name: "JSS 1" }); assert.equal(out.subject.name, "Maths");
        assert.deepEqual(out.term, { id: TERM, name: "first", session: { id: SESSION, name: "2025/2026" } });
        assert.ok(out.teacher && out.teacher.name.startsWith("Ada"));
        assert.equal(state.audits[0].newValue.term, "2025/2026 first");
    });
    it("changing the teacher updates the row and audits old and new; the same manual teacher is a no-op", async () => {
        const w = world({ existing: { id: "cs1", classId: CLASS, subjectId: SUBJ, termId: TERM, staffId: TEACHER2, assignedVia: "auto_subject_default" } });
        await new AssignSubjectUseCase(w.deps).execute("s", CLASS, dto, actor);
        assert.deepEqual(w.state.updated[0], { staffId: TEACHER, assignedVia: "manual" });
        assert.ok(w.state.audits[0].oldValue.teacher);
        const same = world({ existing: { id: "cs1", classId: CLASS, subjectId: SUBJ, termId: TERM, staffId: TEACHER, assignedVia: "manual" } });
        await new AssignSubjectUseCase(same.deps).execute("s", CLASS, dto, actor);
        assert.equal(same.state.updated.length, 0); assert.equal(same.state.audits.length, 0);
    });
});

describe("bulk assign (checks before any saving)", () => {
    const dto = { staffId: TEACHER, termId: TERM, subjectIds: [SUBJ, SUBJ2] };
    it("refuses an unknown class, term, subject or an unsuitable teacher", async () => {
        const uc = new BulkAssignSubjectsUseCase(world().deps);
        await assert.rejects(uc.execute("s", U(9), dto, actor), { code: "NOT_FOUND" });
        await assert.rejects(uc.execute("s", CLASS, { ...dto, termId: U(9) }, actor), { code: "NOT_FOUND" });
        await assert.rejects(uc.execute("s", CLASS, { ...dto, subjectIds: [SUBJ, U(9)] }, actor), { code: "NOT_FOUND" });
        const bad = world({ staff: { [TEACHER]: teaching(TEACHER, { isActive: false }) } });
        await assert.rejects(new BulkAssignSubjectsUseCase(bad.deps).execute("s", CLASS, dto, actor), { code: "SUBJECT_TEACHER_INVALID" });
    });
    it("when every subject already has a teacher, nothing is saved and the skipped subjects come back by name", async () => {
        const { deps, state } = world({ taken: [{ subjectId: SUBJ }, { subjectId: SUBJ2 }] });
        const out = await new BulkAssignSubjectsUseCase(deps).execute("s", CLASS, dto, actor);
        assert.deepEqual(out.assigned, []); assert.deepEqual(out.skipped.map(s => s.name), ["Maths", "English"]);
        assert.equal(out.class.name, "JSS 1"); assert.equal(out.term?.session?.name, "2025/2026"); assert.equal(state.audits.length, 0);
    });
});

describe("subjects of a class", () => {
    it("lists subjects with teacher names from one lookup; a subject with no teacher has a null teacher and id", async () => {
        const rows = [
            { classSubjectId: "cs1", classId: CLASS, subjectId: SUBJ, subjectName: "Maths", subjectCode: "MTH", staffId: TEACHER, termId: TERM, assignedVia: "manual" },
            { classSubjectId: null, classId: CLASS, subjectId: SUBJ2, subjectName: "English", subjectCode: null, staffId: null, termId: TERM, assignedVia: null },
        ];
        const { deps } = world({ rows });
        const out = await new GetClassSubjectsUseCase(deps).execute(CLASS);
        assert.equal(out[0].subject.name, "Maths"); assert.ok(out[0].teacher?.name.startsWith("Ada"));
        assert.deepEqual([out[1].id, out[1].teacher], [null, null]);
        await assert.rejects(new GetClassSubjectsUseCase(deps).execute(U(9)), { code: "NOT_FOUND" });
    });
});
