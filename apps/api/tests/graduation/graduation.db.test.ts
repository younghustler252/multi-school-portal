/*
| GRADUATION against a real database (a throwaway school with every tenant migration applied).
| Runs only when TEST_DATABASE_URL is set (the database name must contain "test"); see docs/TESTING_GUIDE.md.
| The tests share one seeded school and run in order: preview, run, counts, access, entry points, undo.
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { asValue } from "awilix";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";

// TEST-ONLY: see payment-enums-stub.cjs (a file the branch's payments module imports but does not have yet).
import Module from "node:module";
import { join } from "node:path";
const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, parent: any, ...rest: unknown[]) {
    if (request === "../domain/payment.enums" && /handle-webhook/.test(parent?.filename ?? "")) return join(process.cwd(), "tests/graduation/payment-enums-stub.cjs");
    return originalResolve.call(this, request, parent, ...rest);
};

type Seed = Awaited<ReturnType<typeof import("./fixtures")["seed"]>>;

describe("graduation (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool; let S: Seed;
    let fx: typeof import("./fixtures");
    let deps: ReturnType<typeof import("./fixtures")["buildDeps"]>;
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();

    before(async () => {
        school = await createTestSchool();
        fx = await import("./fixtures");
        deps = fx.buildDeps();
        S = await school.run(fx.seed);
    });
    after(async () => { await school.drop(); });

    const meter = async () => (await import("../../src/foundation/foundation.container")).tenantMeters()["students.active"]();
    const outcomes = (rows: Array<{ student: { name: string } | null; outcome: string | null }>) => Object.fromEntries(rows.map(r => [r.student?.name, r.outcome]));

    let previewOutcomes: Record<string, string | null>;

    it("the migration leaves every existing student ungraduated (nothing is inferred)", () => school.run(async () => {
        const rows = await db().student.findMany();
        assert.equal(rows.length, 5);
        assert.ok(rows.every((s: any) => s.graduatedAt === null && s.graduatedTermId === null));
    }));

    it("before promotion: 4 students count toward the plan (the withdrawn one does not)", () => school.run(async () => {
        assert.equal(await meter(), 4);
    }));

    it("preview: names who graduates, leaves out the student who already has a place, and shows the plan impact", () => school.run(async () => {
        const { PreviewPromotionUseCase } = await import("../../src/modules/enrolment/usecases/promotion.usecases");
        const p = await new PreviewPromotionUseCase(deps as any).execute({ termId: S.t1.id, newTermId: S.t2.id } as any);
        assert.equal(p.summary.graduate, 2);
        assert.equal(p.summary.alreadyEnrolled, 1);
        assert.deepEqual(p.planImpact, { activeStudentsNow: 4, graduating: 2, activeStudentsAfter: 2 });
        previewOutcomes = outcomes(p.rows);
        assert.deepEqual(previewOutcomes, { "Ada Test": "graduated", "Bola Test": "graduated", "Chidi Test": "promoted", "Dayo Test": "already_enrolled" });
    }));

    it("run: graduation, closing the final-term enrolment and no place in the next term happen together", () => school.run(async () => {
        const { PromoteStudentsUseCase } = await import("../../src/modules/enrolment/usecases/promotion.usecases");
        const r = await new PromoteStudentsUseCase(deps as any).execute(school.schoolId, { currentTermId: S.t1.id, newTermId: S.t2.id, overrides: [] } as any, fx.actor);
        assert.equal(r.graduated, 2); assert.equal(r.promoted, 1); assert.equal(r.alreadyEnrolled, 1); assert.equal(r.activeStudentsAfter, 2);
        assert.deepEqual(outcomes(r.results), previewOutcomes, "the run does exactly what the preview said");

        for (const s of [S.A, S.B]) {
            const st = await db().student.findUnique({ where: { id: s.id } });
            assert.ok(st.graduatedAt instanceof Date); assert.equal(st.graduatedTermId, S.t1.id);
            assert.equal(st.isActive, true, "a graduate stays on the books");
            const t1 = await db().enrolment.findFirst({ where: { studentId: s.id, termId: S.t1.id } });
            assert.equal(t1.status, "completed", "final-term enrolment closed, not deleted");
            assert.equal(await db().enrolment.count({ where: { studentId: s.id, termId: S.t2.id } }), 0, "no place in the next term");
        }
        const c2 = await db().enrolment.findFirst({ where: { studentId: S.C.id, termId: S.t2.id } });
        assert.equal(c2.classId, S.jss3.id);
        const D = await db().student.findUnique({ where: { id: S.D.id } });
        assert.equal(D.graduatedAt, null, "a student who already has a place is never graduated");
        assert.equal((await db().enrolment.findFirst({ where: { studentId: S.D.id, termId: S.t1.id } })).status, "active");
        const audit = deps.audits.find((a: any) => a.action === "enrolment.promotion_run");
        assert.deepEqual(audit.newValue.graduatedStudents.sort(), ["Ada Test", "Bola Test"]);
        assert.equal(audit.newValue.graduated, 2);
    }));

    it("plan counts: graduates no longer count; list filters agree with the same rule", () => school.run(async () => {
        assert.equal(await meter(), 2);
        const { statusWhere } = await import("../../src/modules/students/usecases/student-queries.usecases");
        const n = (s: any) => db().student.count({ where: statusWhere(s) });
        assert.deepEqual([await n("active"), await n("graduated"), await n("inactive"), await n("all")], [2, 2, 1, 5]);
    }));

    it("running the promotion again cannot move a graduation date", () => school.run(async () => {
        const before = (await db().student.findUnique({ where: { id: S.A.id } })).graduatedAt.getTime();
        const { PromoteStudentsUseCase } = await import("../../src/modules/enrolment/usecases/promotion.usecases");
        const r = await new PromoteStudentsUseCase(deps as any).execute(school.schoolId, { currentTermId: S.t1.id, newTermId: S.t2.id, overrides: [] } as any, fx.actor);
        assert.equal(r.graduated, 0);
        assert.equal((await db().student.findUnique({ where: { id: S.A.id } })).graduatedAt.getTime(), before);
    }));

    it("guardians of a graduate can still see and pay for the child (access follows the books, not graduation)", () => school.run(async () => {
        const { PaymentContextRepositoryImpl } = await import("../../src/modules/payments/repositories/payment-context.repository.impl");
        const ctx = new PaymentContextRepositoryImpl();
        assert.deepEqual(await ctx.guardianChildIds(S.G1.id), [S.A.id]);                       // only child is a graduate: access kept
        assert.deepEqual((await ctx.guardianChildIds(S.G2.id)).sort(), [S.B.id, S.C.id].sort());
        await db().studentGuardian.create({ data: { guardianId: S.G3.id, studentId: S.E.id, relation: "father", isPrimary: false } });
        assert.deepEqual(await ctx.guardianChildIds(S.G3.id), [], "a withdrawn (inactive) student is still not payable: unchanged behaviour");
    }));

    it("announcements: general messages skip graduates and families with ONLY graduates; fee reminders follow the balance", () => school.run(async () => {
        const { guardianAnnouncementWhere, ACTIVE_STUDENT_WHERE, receivesAnnouncement, receivesFeeReminder } = await import("../../src/modules/students/domain/student-eligibility");
        const names = async (where: any) => (await db().guardian.findMany({ where })).map((g: any) => g.firstName).sort();
        assert.deepEqual(await names(guardianAnnouncementWhere(false)), ["Gail", "Gus"]);                // G1 (graduate only) skipped; G2 keeps a continuing child; G3 has none
        assert.deepEqual(await names(guardianAnnouncementWhere(true)), ["Gail", "Gina", "Gus"]);
        assert.deepEqual((await db().student.findMany({ where: ACTIVE_STUDENT_WHERE })).map((s: any) => s.firstName).sort(), ["Chidi", "Dayo"]);
        const grad = { isActive: true, graduatedAt: new Date() };
        assert.equal(receivesAnnouncement(grad), false); assert.equal(receivesAnnouncement(grad, { includeGraduates: true }), true);
        assert.equal(receivesFeeReminder(150000), true, "unpaid balance: reminded even after graduation");
        assert.equal(receivesFeeReminder(0), false);
    }));

    it("entry points: a graduate cannot be enrolled, bulk-enrolled or brought back by reopening an old enrolment", () => school.run(async () => {
        const { EnrolStudentUseCase } = await import("../../src/modules/enrolment/usecases/enrol-student.usecase");
        const { BulkEnrolUseCase } = await import("../../src/modules/enrolment/usecases/bulk-enrol.usecase");
        const { UpdateEnrolmentUseCase } = await import("../../src/modules/enrolment/usecases/update-enrolment.usecase");
        await assert.rejects(() => new EnrolStudentUseCase(deps as any).execute(school.schoolId, { studentId: S.A.id, classId: S.jss3.id, termId: S.t2.id } as any, fx.actor), (e: any) => e.code === "STUDENT_GRADUATED");
        const bulk = await new BulkEnrolUseCase(deps as any).execute(school.schoolId, { studentIds: [S.A.id], classId: S.jss3.id, termId: S.t2.id } as any, fx.actor);
        assert.equal(bulk.skipped[0].reason, "graduated");
        const old = await db().enrolment.findFirst({ where: { studentId: S.A.id, termId: S.t1.id } });
        await assert.rejects(() => new UpdateEnrolmentUseCase(deps as any).execute(school.schoolId, old.id, { status: "active" } as any, fx.actor), (e: any) => e.code === "STUDENT_GRADUATED");
        assert.equal(await db().enrolment.count({ where: { studentId: S.A.id, termId: S.t2.id } }), 0);
    }));

    it("term roll-over never carries a graduate, even if an old enrolment was left open by mistake", () => school.run(async () => {
        const { rolloverInTx } = await import("../../src/modules/sessions/services/term-rollover");
        const old = await db().enrolment.findFirst({ where: { studentId: S.A.id, termId: S.t1.id } });
        await db().enrolment.update({ where: { id: old.id }, data: { status: "active" } });
        await db().$transaction(async (tx: any) => { await rolloverInTx(tx, S.t1.id, S.t2.id); });
        assert.equal(await db().enrolment.count({ where: { studentId: S.A.id, termId: S.t2.id } }), 0);
        await db().enrolment.update({ where: { id: old.id }, data: { status: "completed" } });
    }));

    it("the database refuses a half-recorded graduation (date without term)", () => school.run(async () => {
        await assert.rejects(() => db().student.update({ where: { id: S.C.id }, data: { graduatedAt: new Date() } }), /check|constraint/i);
    }));

    describe("undo graduation", () => {
        const undo = async (id: string, dto: any) => {
            const { UndoGraduationUseCase } = await import("../../src/modules/students/usecases/undo-graduation.usecase");
            return new UndoGraduationUseCase(deps as any).execute(school.schoolId, id, dto, fx.actor);
        };
        const limit = async (max: number) => {
            const { container } = await import("../../src/container");
            const { tenantMeters } = await import("../../src/foundation/foundation.container");
            container.register({ entitlementsService: asValue({ checkLimit: async (_s: string, _k: string, adding: number) => {
                const current = await tenantMeters()["students.active"]();
                return current + adding <= max ? { allowed: true } : { allowed: false, reason: "limit_reached", limit: max, current };
            } }) });
        };

        it("a reason is always required", async () => {
            const { UndoGraduationDto } = await import("../../src/modules/students/dtos/student.dto");
            assert.equal(UndoGraduationDto.safeParse({}).success, false);
            assert.equal(UndoGraduationDto.safeParse({ reason: "no" }).success, false);
            assert.equal(UndoGraduationDto.safeParse({ reason: "Promoted by mistake" }).success, true);
        });
        it("a student who has not graduated cannot be 'undone'", () => school.run(async () => {
            await assert.rejects(() => undo(S.C.id, { reason: "Promoted by mistake", reopenEnrolment: false }), (e: any) => e.code === "STUDENT_NOT_GRADUATED");
        }));
        it("needs room in the plan: refused when full, and nothing changes", () => school.run(async () => {
            await limit(2);
            await assert.rejects(() => undo(S.A.id, { reason: "Promoted by mistake", reopenEnrolment: false }), (e: any) => /plan limit/i.test(e.message));
            assert.ok((await db().student.findUnique({ where: { id: S.A.id } })).graduatedAt);
            assert.equal(await meter(), 2);
        }));
        it("with room: restores eligibility, audits the reason, leaves enrolments and history alone", () => school.run(async () => {
            await limit(3);
            const r = await undo(S.A.id, { reason: "Promoted by mistake", reopenEnrolment: false });
            assert.equal(r.graduatedAt, null);
            const st = await db().student.findUnique({ where: { id: S.A.id } });
            assert.equal(st.graduatedAt, null); assert.equal(st.graduatedTermId, null);
            assert.equal(await meter(), 3);
            assert.equal((await db().enrolment.findFirst({ where: { studentId: S.A.id, termId: S.t1.id } })).status, "completed");
            const a = deps.audits.find((x: any) => x.action === "student.graduation_undone");
            assert.equal(a.newValue.reason, "Promoted by mistake"); assert.equal(a.newValue.reopenedEnrolment, false); assert.equal(a.oldValue.name, "Ada Test");
        }));
        it("reopen: puts the student back in their final class while that term is current", () => school.run(async () => {
            await limit(10);
            await undo(S.B.id, { reason: "Wrongly marked as final class", reopenEnrolment: true });
            assert.equal((await db().enrolment.findFirst({ where: { studentId: S.B.id, termId: S.t1.id } })).status, "active");
            assert.equal((await db().student.findUnique({ where: { id: S.B.id } })).graduatedAt, null);
            assert.equal(deps.audits.filter((x: any) => x.action === "student.graduation_undone").pop().newValue.class, "JSS 3");
        }));
        it("reopen is refused when the class is full or the term is no longer current, and nothing is half-done", () => school.run(async () => {
            const F = await db().student.create({ data: { firstName: "Femi", lastName: "Test", graduatedAt: new Date(), graduatedTermId: S.t1.id } });
            await db().enrolment.create({ data: { studentId: F.id, classId: S.jss3.id, termId: S.t1.id, status: "completed" } });
            await db().class.update({ where: { id: S.jss3.id }, data: { capacity: 2 } });         // Dayo + Bola already fill it
            await assert.rejects(() => undo(F.id, { reason: "Wrongly marked as final class", reopenEnrolment: true }), (e: any) => e.code === "GRADUATION_CLASS_FULL");
            assert.ok((await db().student.findUnique({ where: { id: F.id } })).graduatedAt, "still graduated");
            assert.equal((await db().enrolment.findFirst({ where: { studentId: F.id, termId: S.t1.id } })).status, "completed");
            await db().term.update({ where: { id: S.t1.id }, data: { isCurrent: false } });
            await db().term.update({ where: { id: S.t2.id }, data: { isCurrent: true } });
            await assert.rejects(() => undo(F.id, { reason: "Wrongly marked as final class", reopenEnrolment: true }), (e: any) => e.code === "GRADUATION_TERM_NOT_CURRENT");
            // undoing WITHOUT reopening is still allowed later (they are then enrolled normally)
            await undo(F.id, { reason: "Wrongly marked as final class", reopenEnrolment: false });
            assert.equal((await db().student.findUnique({ where: { id: F.id } })).graduatedAt, null);
        }));
        it("an inactive graduate does not count either way, so no plan room is needed; reopening them is refused", () => school.run(async () => {
            await limit(0);
            const H = await db().student.create({ data: { firstName: "Hope", lastName: "Test", isActive: false, graduatedAt: new Date(), graduatedTermId: S.t1.id } });
            await assert.rejects(() => undo(H.id, { reason: "Wrongly marked as final class", reopenEnrolment: true }), (e: any) => e.code === "STUDENT_INACTIVE");
            await undo(H.id, { reason: "Wrongly marked as final class", reopenEnrolment: false });
            assert.equal((await db().student.findUnique({ where: { id: H.id } })).graduatedAt, null);
        }));
    });
});
