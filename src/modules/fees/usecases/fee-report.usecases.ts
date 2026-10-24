import { IFeeReportRepository } from "../repositories/fee-report.repository";
import { koboOut, dayOut } from "../../ledger/mappers/kobo";
import { parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { feeErrors } from "../domain/fee.errors";
import { BUCKETS, buildAgeing, buildCollections, buildStatement, defaultersOf } from "../domain/report.policy";
import { AgeingReport, BucketTotals, Statement } from "../domain/report.entity";
import { AgeingQueryType, CollectionsQueryType, DefaultersQueryType, StatementQueryType } from "../dtos/report.dto";

interface Dependencies { feeReportRepository: IFeeReportRepository }
export interface ReportOptions { now?: () => Date }

const bucketsOut = (b: BucketTotals) => Object.fromEntries(BUCKETS.map(k => [k, koboOut(b[k])]));
const ageingOut = (r: AgeingReport) => ({
    asOf: r.asOf, totals: bucketsOut(r.totals), totalKobo: koboOut(r.totalKobo), overdueKobo: koboOut(r.overdueKobo),
    students: r.students.map(s => ({
        studentId: s.studentId, studentName: s.studentName, admissionNumber: s.admissionNumber, class: { id: s.classId, name: s.className },
        buckets: bucketsOut(s.buckets), totalKobo: koboOut(s.totalKobo), overdueKobo: koboOut(s.overdueKobo), oldestDaysOverdue: s.oldestDaysOverdue, invoices: s.invoices,
    })),
});
export const statementOut = (s: Statement) => ({
    student: s.student, from: s.from, to: s.to, openingKobo: koboOut(s.openingKobo), closingKobo: koboOut(s.closingKobo),
    owedKobo: koboOut(s.owedKobo), creditKobo: koboOut(s.creditKobo),
    totals: { chargedKobo: koboOut(s.totals.chargedKobo), adjustedKobo: koboOut(s.totals.adjustedKobo), paidKobo: koboOut(s.totals.paidKobo), refundedKobo: koboOut(s.totals.refundedKobo) },
    entries: s.entries.map(e => ({ date: e.date, kind: e.kind, reference: e.reference, description: e.description, amountKobo: koboOut(e.amountKobo), balanceKobo: koboOut(e.balanceKobo) })),
});

/* AGEING: what is owed, by how late it is (current, 1-30, 31-60, 61-90, over 90 days past the due date), student by student. */
export class AgeingReportUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: ReportOptions = {}) { this.now = options.now ?? (() => new Date()); }
    async execute(q: AgeingQueryType) {
        const asOf = q.asOf ?? todayInFinanceZone(this.now());
        parseDay(asOf);
        return ageingOut(buildAgeing(await this.d.feeReportRepository.openInvoices({ branchId: q.branchId, classId: q.classId, termId: q.termId }), asOf));
    }
}

/* DEFAULTERS: the students with something overdue, most overdue first. */
export class DefaultersReportUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: ReportOptions = {}) { this.now = options.now ?? (() => new Date()); }
    async execute(q: DefaultersQueryType) {
        const asOf = q.asOf ?? todayInFinanceZone(this.now());
        parseDay(asOf);
        const rows = await this.d.feeReportRepository.openInvoices({ branchId: q.branchId, classId: q.classId, termId: q.termId });
        return ageingOut(defaultersOf(buildAgeing(rows, asOf), q.minimumKobo ?? 1n));
    }
}

/* COLLECTIONS: confirmed money received in a period, by method, day, month, campus or class. */
export class CollectionsReportUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: CollectionsQueryType) {
        const rows = await this.d.feeReportRepository.confirmedPayments(parseDay(q.from), parseDay(q.to), q.branchId);
        const ids = [...new Set(rows.map(r => r.branchId).filter((x): x is string => x !== null))];
        const r = buildCollections(rows, q.groupBy, q.from, q.to, { branch: q.groupBy === "branch" ? await this.d.feeReportRepository.branchNames(ids) : undefined });
        return {
            from: r.from, to: r.to, groupBy: r.groupBy, payments: r.payments, totalKobo: koboOut(r.totalKobo), creditKobo: koboOut(r.creditKobo),
            lines: r.lines.map(l => ({ key: l.key, label: l.label, count: l.count, totalKobo: koboOut(l.totalKobo) })),
        };
    }
}

/* ONE STUDENT'S STATEMENT (staff). */
export class StatementUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(studentId: string, q: StatementQueryType) {
        const src = await this.d.feeReportRepository.statementSource(studentId);
        if (!src) throw feeErrors.studentNotFound();
        return statementOut(buildStatement(src, q.from ?? null, q.to ?? null));
    }
}

export interface Viewer { persona: string | null; personaEntityId: string | null }

/* WHAT A FAMILY LOGIN MAY SEE: a guardian's linked children, or the student themselves. Anyone else sees nobody. */
async function myStudentIds(d: Dependencies, v: Viewer): Promise<string[]> {
    if ((v.persona === "GUARDIAN" || v.persona === "STUDENT") && v.personaEntityId) return d.feeReportRepository.childIdsOf(v.persona, v.personaEntityId);
    return [];
}

/* MY CHILDREN: what each owes, what is overdue, and any credit. */
export class MyChildrenUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(v: Viewer) {
        const rows = await this.d.feeReportRepository.familySummary(await myStudentIds(this.d, v));
        return {
            children: rows.map(r => ({ studentId: r.studentId, studentName: r.studentName, admissionNumber: r.admissionNumber, className: r.className, owedKobo: koboOut(r.owedKobo), overdueInvoices: r.overdueInvoices, creditKobo: koboOut(r.creditKobo) })),
            totalOwedKobo: koboOut(rows.reduce((s, r) => s + r.owedKobo, 0n)), totalCreditKobo: koboOut(rows.reduce((s, r) => s + r.creditKobo, 0n)),
        };
    }
}

/* MY INVOICES: issued invoices of my children (one child with ?studentId). Drafts and voided invoices are never shown to families. */
export class MyInvoicesUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(v: Viewer, studentId?: string) {
        const ids = await myStudentIds(this.d, v);
        if (studentId && !ids.includes(studentId)) throw feeErrors.notYourChild();
        const rows = await this.d.feeReportRepository.familyInvoices(ids, studentId);
        return rows.map(r => ({
            id: r.id, invoiceNumber: r.invoiceNumber, student: { id: r.studentId, name: r.studentName }, status: r.status, type: r.type,
            issueDate: r.issueDate ? dayOut(r.issueDate) : null, dueDate: r.dueDate ? dayOut(r.dueDate) : null,
            totalKobo: koboOut(r.totalKobo), paidKobo: koboOut(r.paidKobo), balanceKobo: koboOut(r.balanceKobo),
        }));
    }
}

/* MY CHILD'S STATEMENT. */
export class MyStatementUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(v: Viewer, studentId: string, q: StatementQueryType) {
        if (!(await myStudentIds(this.d, v)).includes(studentId)) throw feeErrors.notYourChild();
        const src = await this.d.feeReportRepository.statementSource(studentId);
        if (!src) throw feeErrors.studentNotFound();
        return statementOut(buildStatement(src, q.from ?? null, q.to ?? null));
    }
}

