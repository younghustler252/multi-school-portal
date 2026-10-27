import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { AuditService } from "../../audit/services/audit.service";
import { IEnrolmentRepository } from "../repositories/enrolment.repository";
import { IClassRepository } from "../../classes/repositories/class.repository";
import { ISessionRepository } from "../../sessions/repositories/session.repository";
import { EnrolmentPresenter, NameRef, StudentLite, TermRef } from "../services/enrolment-presenter";
import { planPromotion, moves, PlanRow, PlanAction } from "../services/promotion-plan";
import { lockClass, activeInClass, wouldOverflow } from "../services/class-seats";
import { enrolmentErrors } from "../domain/enrolment.errors";
import { EnrolmentActor } from "../domain/enrolment.types";
import { PromotionPreviewQueryType, PromoteStudentsDtoType, PromotionOverrideType } from "../dtos/enrolment.dto";

interface Dependencies {
    enrolmentRepository: IEnrolmentRepository; classRepository: IClassRepository; sessionRepository: ISessionRepository;
    enrolmentPresenter: EnrolmentPresenter; auditService: AuditService;
}

const label = (t: TermRef | undefined) => (t ? `${t.session?.name ?? ""} ${t.name}`.trim() : "unknown term");

/** Loads the plan for a term from the database: active students' enrolments + the saved class order. */
async function loadPlan(d: Dependencies, termId: string, overrides: PromotionOverrideType[]) {
    const enrolments = await d.enrolmentRepository.findMany({ termId, status: "active", student: { isActive: true } });
    const progression = new Map((await d.classRepository.findAllClassProgressions()).map(p => [p.fromClassId, p.toClassId]));
    return planPromotion({ enrolments: enrolments.map(e => ({ studentId: e.studentId, classId: e.classId })), progression, overrides });
}

export interface PromotionPreviewRow {
    student: StudentLite; fromClass: NameRef; toClass: NameRef | null;
    action: "promote" | "graduate" | "needs_decision"; alreadyEnrolled: boolean;
}
export interface PromotionPreview {
    term: TermRef | null; newTerm: TermRef | null;
    summary: { total: number; promote: number; graduate: number; needsDecision: number; alreadyEnrolled: number };
    classesWithoutNextClass: NameRef[];
    rows: PromotionPreviewRow[];
}

/*
| PREVIEW THE PROMOTION: who would go where, from the saved class order, for the active students of a term.
| With `newTermId`, students who already have a place in the new term are flagged. Nothing is saved.
*/
export class PreviewPromotionUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(q: PromotionPreviewQueryType): Promise<PromotionPreview> {
        const d = this.d;
        const terms = await d.enrolmentPresenter.termMap();
        if (!terms.has(q.termId)) throw enrolmentErrors.termNotFound();
        if (q.newTermId && !terms.has(q.newTermId)) throw enrolmentErrors.termNotFound();

        const plan = await loadPlan(d, q.termId, []);
        const [classes, students] = await Promise.all([d.enrolmentPresenter.classMap(), d.enrolmentPresenter.studentLites(plan.rows.map(r => r.studentId))]);
        const placed = q.newTermId
            ? new Set((await d.enrolmentRepository.findMany({ termId: q.newTermId, studentId: { in: plan.rows.map(r => r.studentId) } })).map(e => e.studentId))
            : new Set<string>();
        const nameOf = (id: string): NameRef => classes.get(id) ?? { id, name: "Unknown" };

        const rows: PromotionPreviewRow[] = plan.rows.map(r => ({
            student: students.get(r.studentId) ?? { id: r.studentId, name: "Unknown", admissionNumber: null },
            fromClass: nameOf(r.fromClassId), toClass: r.toClassId ? nameOf(r.toClassId) : null,
            action: r.action as PromotionPreviewRow["action"], alreadyEnrolled: placed.has(r.studentId),
        }));
        const count = (a: PlanAction) => plan.rows.filter(r => r.action === a).length;
        return {
            term: terms.get(q.termId) ?? null, newTerm: q.newTermId ? terms.get(q.newTermId) ?? null : null,
            summary: { total: rows.length, promote: count("promote"), graduate: count("graduate"), needsDecision: count("needs_decision"), alreadyEnrolled: rows.filter(r => r.alreadyEnrolled).length },
            classesWithoutNextClass: plan.needsDecisionClassIds.map(nameOf), rows,
        };
    }
}

export type PromotionOutcome = "promoted" | "repeated" | "graduated" | "excluded" | "already_enrolled";
export interface PromotionResult {
    total: number; promoted: number; repeated: number; graduated: number; excluded: number; alreadyEnrolled: number;
    results: Array<{ student: StudentLite; outcome: PromotionOutcome; fromClass: NameRef; toClass: NameRef | null }>;
}

/*
| PROMOTE (end of year), all in ONE transaction. The server decides from the saved class order; the request only
| carries exceptions. Checks first: both terms exist, the new term is a later term, every student in an exception is
| in the plan, and no class lacks a decision. Then every target class is locked and its room checked: if any class
| would go over capacity (CLASS_FULL, listing them) nothing is saved. Promoted, repeating and graduating students'
| old enrolments become "completed"; students who already have a place in the new term are left alone.
| (Graduated students stay active: deactivating graduates is a separate decision.)
*/
export class PromoteStudentsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, dto: PromoteStudentsDtoType, actor: EnrolmentActor): Promise<PromotionResult> {
        const d = this.d;
        if (dto.currentTermId === dto.newTermId) throw enrolmentErrors.promotionSameTerm();
        const [current, next] = await Promise.all([d.sessionRepository.findTermById(dto.currentTermId), d.sessionRepository.findTermById(dto.newTermId)]);
        if (!current || !next) throw enrolmentErrors.termNotFound();
        if (next.startDate.getTime() <= current.startDate.getTime()) throw enrolmentErrors.promotionTermOrder();

        const plan = await loadPlan(d, dto.currentTermId, dto.overrides);
        if (plan.unknownOverrides.length) throw enrolmentErrors.promotionUnknownStudent(plan.unknownOverrides.length);
        const classes = await d.enrolmentPresenter.classMap();
        const nameOf = (id: string): NameRef => classes.get(id) ?? { id, name: "Unknown" };
        if (plan.needsDecisionClassIds.length) throw enrolmentErrors.promotionNeedsDecisions(plan.needsDecisionClassIds.map(id => nameOf(id).name));
        for (const r of plan.rows) if (r.toClassId && !classes.has(r.toClassId)) throw enrolmentErrors.classNotFound();

        const placed = new Set((await d.enrolmentRepository.findMany({ termId: dto.newTermId, studentId: { in: plan.rows.map(r => r.studentId) } })).map(e => e.studentId));
        const movers = plan.rows.filter(r => moves(r) && !placed.has(r.studentId));
        const incoming = new Map<string, number>();
        for (const r of movers) incoming.set(r.toClassId!, (incoming.get(r.toClassId!) ?? 0) + 1);
        const capacity = new Map((await d.classRepository.findAllClasses()).map(c => [c.id, c.capacity]));
        const closing = plan.rows.filter(r => r.action === "graduate" || (moves(r) && !placed.has(r.studentId))).map(r => r.studentId);

        await getTenantClient().$transaction(async tx => {
            const full: Array<{ name: string; capacity: number; enrolled: number; incoming: number }> = [];
            for (const classId of [...incoming.keys()].sort()) {
                await lockClass(tx as any, classId);
                const enrolled = await activeInClass(tx as any, classId, dto.newTermId);
                if (wouldOverflow(capacity.get(classId), enrolled, incoming.get(classId)!)) full.push({ name: nameOf(classId).name, capacity: capacity.get(classId)!, enrolled, incoming: incoming.get(classId)! });
            }
            if (full.length) throw enrolmentErrors.promotionClassesFull(full);
            if (movers.length) await tx.enrolment.createMany({ data: movers.map(r => ({ studentId: r.studentId, classId: r.toClassId!, termId: dto.newTermId, status: "active" as const })), skipDuplicates: true });
            if (closing.length) await tx.enrolment.updateMany({ where: { termId: dto.currentTermId, status: "active", studentId: { in: closing } }, data: { status: "completed" } });
        }, { maxWait: 5000, timeout: 30000 });

        const students = await d.enrolmentPresenter.studentLites(plan.rows.map(r => r.studentId));
        const outcomeOf = (r: PlanRow): PromotionOutcome =>
            r.action === "exclude" ? "excluded" : r.action === "graduate" ? "graduated" : placed.has(r.studentId) ? "already_enrolled" : r.action === "repeat" ? "repeated" : "promoted";
        const results = plan.rows.map(r => ({
            student: students.get(r.studentId) ?? { id: r.studentId, name: "Unknown", admissionNumber: null },
            outcome: outcomeOf(r), fromClass: nameOf(r.fromClassId), toClass: r.toClassId ? nameOf(r.toClassId) : null,
        }));
        const n = (o: PromotionOutcome) => results.filter(r => r.outcome === o).length;
        const summary = { promoted: n("promoted"), repeated: n("repeated"), graduated: n("graduated"), excluded: n("excluded"), alreadyEnrolled: n("already_enrolled") };

        const terms = await d.enrolmentPresenter.termMap();
        await d.auditService.log({
            userId: actor.userId, schoolId, action: "enrolment.promotion_run", entity: "Term", entityId: dto.newTermId,
            oldValue: { from: label(terms.get(dto.currentTermId)) }, newValue: { to: label(terms.get(dto.newTermId)), total: results.length, ...summary, exceptions: dto.overrides.length },
        });
        return { total: results.length, ...summary, results };
    }
}
