import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validatePermissionRegistry, PERMISSION_REGISTRY } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { CreateClassDto, UpdateClassDto, SetClassTeacherDto, SetClassProgressionDto } from "../../src/modules/classes/dtos/class.dto";
import { findProgressionLoop, classUsage } from "../../src/modules/classes/services/class-rules";
import { StaffNameLookup } from "../../src/modules/classes/services/staff-names";
import { ClassPresenter } from "../../src/modules/classes/services/class-presenter";
import { CreateClassUseCase } from "../../src/modules/classes/usecases/school-admin/create-class.usecase";
import { UpdateClassUseCase } from "../../src/modules/classes/usecases/school-admin/update-class.usecase";
import { SetClassTeacherUseCase } from "../../src/modules/classes/usecases/school-admin/set-classteacher.usecase";
import { SetClassProgressionUseCase } from "../../src/modules/classes/usecases/school-admin/set-class-progression.usecase";

const C1 = "11111111-1111-4111-8111-111111111111", C2 = "22222222-2222-4222-8222-222222222222", C3 = "33333333-3333-4333-8333-333333333333";
const T1 = "44444444-4444-4444-8444-444444444444";
const actor = { userId: "u1" };

describe("class permissions and templates", () => {
    it("registry is valid; both keys exist once; staff roles can view classes, only the admin manages", () => {
        assert.deepEqual(validatePermissionRegistry(), []);
        assert.equal(PERMISSION_REGISTRY.filter(p => p.key === "classes.view").length, 1);
        assert.equal(PERMISSION_REGISTRY.find(p => p.key === "classes.manage")?.isSensitive, true);
        for (const k of ["principal", "branch_principal", "teacher", "bursar"])
            assert.ok(ROLE_TEMPLATES.find(t => t.key === k)!.permissions.some(p => p.key === "classes.view"), `${k} cannot view classes`);
        for (const t of ROLE_TEMPLATES) assert.ok(!t.permissions.some(p => p.key === "classes.manage"));
        for (const k of ["student", "guardian"]) assert.ok(!ROLE_TEMPLATES.find(t => t.key === k)!.permissions.some(p => p.key === "classes.view"));
    });
});

describe("class DTOs", () => {
    it("create trims, treats blanks as not sent, bounds capacity, rejects unknown fields", () => {
        const ok = CreateClassDto.parse({ name: "  JSS 1 ", level: " ", capacity: 40 });
        assert.equal(ok.name, "JSS 1"); assert.equal(ok.level, undefined);
        assert.equal(CreateClassDto.safeParse({ name: "A", capacity: 0 }).success, false);
        assert.equal(CreateClassDto.safeParse({ name: "A", capacity: 501 }).success, false);
        assert.equal(CreateClassDto.safeParse({ name: "A", classTeacherId: C1 }).success, false);
    });
    it("update needs one field; null clears level and capacity", () => {
        assert.equal(UpdateClassDto.safeParse({}).success, false);
        assert.equal((UpdateClassDto.parse({ level: "" }) as any).level, null);
        assert.equal((UpdateClassDto.parse({ capacity: null }) as any).capacity, null);
    });
    it("teacher and progression bodies take an id or null only", () => {
        assert.equal(SetClassTeacherDto.safeParse({ staffId: null }).success, true);
        assert.equal(SetClassTeacherDto.safeParse({ staffId: "x" }).success, false);
        assert.equal(SetClassTeacherDto.safeParse({}).success, false);
        assert.equal(SetClassProgressionDto.safeParse({ toClassId: null }).success, true);
        assert.equal(SetClassProgressionDto.safeParse({ toClassId: C1, extra: 1 }).success, false);
    });
});

describe("class rules", () => {
    it("finds a promotion loop and names the chain; no loop returns null", async () => {
        const next: Record<string, string | null> = { [C2]: C3, [C3]: C1, [C1]: null };
        const name = (id: string) => ({ [C1]: "JSS 1", [C2]: "JSS 2", [C3]: "JSS 3" } as any)[id];
        assert.equal(await findProgressionLoop(C1, C2, async id => next[id] ?? null, name), "JSS 1 → JSS 2 → JSS 3 → JSS 1");
        assert.equal(await findProgressionLoop(C3, C2, async id => ({ [C2]: null } as any)[id] ?? null, name), null);
    });
    it("classUsage reports only what still points at the class", async () => {
        const n = (v: number) => ({ count: async () => v });
        const used = await classUsage({ enrolment: n(12), classSubject: n(0), feeStructure: n(2), feeInvoice: n(0), classProgression: n(1) } as any, C1);
        assert.deepEqual(used, { enrolments: 12, feeStructures: 2, promotionsInto: 1 });
        assert.deepEqual(await classUsage({ enrolment: n(0), classSubject: n(0), feeStructure: n(0), feeInvoice: n(0), classProgression: n(0) } as any, C1), {});
    });
});

// ── names: two queries for a whole page ──────────────────────────────────────
function lookup(calls: string[] = []) {
    const staffRepository: any = { findMany: async (w: any) => { calls.push("staff"); return w.id.in.map((id: string) => ({ id, userId: id === "s-nologin" ? null : "u-" + id })); } };
    const userRepository: any = { findByIds: async (ids: string[]) => { calls.push("users"); return ids.map(id => ({ id, firstName: "Ada", lastName: id })); } };
    return new StaffNameLookup({ staffRepository, userRepository });
}
describe("staff names", () => {
    it("one page = two queries, with objects { id, name }; people without a login are still listed", async () => {
        const calls: string[] = [];
        const m = await lookup(calls).byIds(["s1", "s2", "s1", null, "s-nologin"]);
        assert.deepEqual(calls, ["staff", "users"]);
        assert.deepEqual(m.get("s1"), { id: "s1", name: "Ada u-s1" }); assert.equal(m.get("s-nologin")?.name, "Unknown");
        assert.equal((await lookup([]).byIds([null])).size, 0);
    });
});

// ── use cases with in-memory fakes ───────────────────────────────────────────
const row = (o: any = {}) => ({ id: C1, name: "JSS 1", level: "JSS", capacity: 30, classTeacherId: null, studentCount: 25, createdAt: new Date("2025-01-01"), ...o });
function fakes(over: any = {}) {
    const state = { updates: [] as any[], audits: [] as any[], progress: [] as any[], recascades: [] as any[] };
    const classes = [row(), row({ id: C2, name: "JSS 2", classTeacherId: null }), row({ id: C3, name: "JSS 3" })];
    const classRepository: any = {
        findClassById: async (id: string) => classes.find(c => c.id === id) ?? null,
        findAllClasses: async () => classes,
        findClassByIdEnriched: async (id: string) => classes.find(c => c.id === id) ?? null,
        createClass: async (d: any) => ({ id: "new", createdAt: new Date("2025-01-01"), level: null, capacity: null, ...d }),
        updateClass: async (_i: string, d: any) => { state.updates.push(d); return classes[0]; },
        findClassProgression: async (id: string) => (over.progression ?? {})[id] ?? null,
        findClassProgressionEnriched: async () => null,
        setClassProgression: async (d: any) => { state.progress.push(d); return d; },
    };
    const staffRepository: any = { findById: async (id: string) => over.staff?.[id] ?? null };
    const sessionRepository: any = { findCurrentTerm: async () => ({ id: "term1" }) };
    const staffNameLookup = lookup();
    const classPresenter = new ClassPresenter({ staffNameLookup });
    const auditService: any = { log: async (p: any) => { state.audits.push(p); } };
    const teachingModelReader: any = { get: async () => over.model ?? null };
    const classSubjectResolutionService: any = { recascadeHomeroom: async (...a: any[]) => { state.recascades.push(a); } };
    return { state, deps: { classRepository, staffRepository, sessionRepository, staffNameLookup, classPresenter, auditService, teachingModelReader, classSubjectResolutionService } };
}

describe("create and update class", () => {
    it("a name is unique whatever the capitals; a new class answers with names, a zero count and no teacher", async () => {
        const { deps, state } = fakes();
        await assert.rejects(new CreateClassUseCase(deps).execute("s", { name: "jss 1" }, actor), { code: "CLASS_NAME_TAKEN" });
        const out = await new CreateClassUseCase(deps).execute("s", { name: "SS 1", capacity: 40 } as any, actor);
        assert.equal(out.studentCount, 0); assert.equal(out.classTeacher, null); assert.equal(state.audits[0].action, "class.created");
    });
    it("capacity cannot drop below the students already in the class", async () => {
        const { deps } = fakes();
        await assert.rejects(new UpdateClassUseCase(deps).execute("s", C1, { capacity: 20 }, actor), { code: "CAPACITY_BELOW_STUDENT_COUNT", details: { students: 25 } });
    });
    it("a taken name is refused; an unchanged update writes and audits nothing; a change is audited with old and new", async () => {
        const { deps, state } = fakes();
        await assert.rejects(new UpdateClassUseCase(deps).execute("s", C1, { name: "JSS 2" }, actor), { code: "CLASS_NAME_TAKEN" });
        await new UpdateClassUseCase(deps).execute("s", C1, { name: "JSS 1", capacity: 30 }, actor);
        assert.equal(state.updates.length, 0); assert.equal(state.audits.length, 0);
        await new UpdateClassUseCase(deps).execute("s", C1, { capacity: 35, level: null }, actor);
        assert.deepEqual(state.updates[0], { capacity: 35, level: null });
        assert.deepEqual(state.audits[0].oldValue, { class: "JSS 1", capacity: 30, level: "JSS" });
        await assert.rejects(new UpdateClassUseCase(deps).execute("s", "nope", { capacity: 35 }, actor), { code: "NOT_FOUND" });
    });
});

describe("class teacher", () => {
    const teaching = { id: T1, isActive: true, category: "teaching" };
    it("must be an active teaching staff member; unknown staff is not found", async () => {
        for (const bad of [{ ...teaching, category: "non_teaching" }, { ...teaching, isActive: false }]) {
            const { deps } = fakes({ staff: { [T1]: bad } });
            await assert.rejects(new SetClassTeacherUseCase(deps).execute("s", C1, T1, actor), { code: "CLASS_TEACHER_INVALID" });
        }
        await assert.rejects(new SetClassTeacherUseCase(fakes().deps).execute("s", C1, T1, actor), { code: "NOT_FOUND" });
    });
    it("saves the teacher, audits names (not ids) and re-cascades only in a homeroom school", async () => {
        const a = fakes({ staff: { [T1]: teaching }, model: "homeroom" });
        await new SetClassTeacherUseCase(a.deps).execute("s", C1, T1, actor);
        assert.deepEqual(a.state.updates, [{ classTeacherId: T1 }]);
        assert.equal(a.state.audits[0].newValue.teacher, "Ada u-" + T1); assert.equal(a.state.recascades.length, 1);
        const b = fakes({ staff: { [T1]: teaching }, model: "subject_specialist" });
        await new SetClassTeacherUseCase(b.deps).execute("s", C1, T1, actor);
        assert.equal(b.state.recascades.length, 0);
        await new SetClassTeacherUseCase(b.deps).execute("s", C1, null, actor);   // clearing needs no staff check
        assert.deepEqual(b.state.updates[1], { classTeacherId: null });
    });
});

describe("class progression", () => {
    it("refuses itself, unknown classes and loops; null means the class graduates", async () => {
        const { deps, state } = fakes({ progression: { [C2]: { toClassId: C3 }, [C3]: { toClassId: C1 } } });
        const uc = new SetClassProgressionUseCase(deps);
        await assert.rejects(uc.execute("s", C1, C1, actor), { code: "PROGRESSION_SAME_CLASS" });
        await assert.rejects(uc.execute("s", C1, "99999999-9999-4999-8999-999999999999", actor), { code: "NOT_FOUND" });
        await assert.rejects(uc.execute("s", C1, C2, actor), { code: "PROGRESSION_LOOP" });
        const grad = await uc.execute("s", C3, null, actor);
        assert.deepEqual(grad, { class: { id: C3, name: "JSS 3" }, nextClass: null });
        assert.deepEqual(state.progress, [{ fromClassId: C3, toClassId: null }]);
        assert.equal(state.audits[0].action, "class.progression_set");
    });
    it("a valid next class is answered with names", async () => {
        const { deps } = fakes();
        assert.deepEqual(await new SetClassProgressionUseCase(deps).execute("s", C1, C2, actor), { class: { id: C1, name: "JSS 1" }, nextClass: { id: C2, name: "JSS 2" } });
    });
});
