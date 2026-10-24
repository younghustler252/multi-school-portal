import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { dayString } from "../../ledger/domain/ledger.dates";
import { CollectionRow, OpenInvoiceRow, ReportFilters, StatementSource } from "../domain/report.entity";
import { IFeeReportRepository } from "./fee-report.repository";

const WITH_PEOPLE = { student: { select: { firstName: true, lastName: true, admissionNumber: true } }, class: { select: { name: true } } };
const fullName = (s: { firstName: string; lastName: string }) => `${s.firstName} ${s.lastName}`;

/* Not a table repository (it reads many tables), so it does not extend the base class. It uses the tenant client. */
export class FeeReportRepositoryImpl implements IFeeReportRepository {
    private get db() { return getTenantClient(); }

    async openInvoices(f: ReportFilters): Promise<OpenInvoiceRow[]> {
        const rows = await this.db.feeInvoice.findMany({
            where: {
                status: { in: ["unpaid", "partial"] }, balanceKobo: { gt: 0n },
                ...(f.branchId && { branchId: f.branchId }), ...(f.classId && { classId: f.classId }), ...(f.termId && { termId: f.termId }),
                ...(f.studentIds && { studentId: { in: f.studentIds } }),
            },
            select: { id: true, invoiceNumber: true, studentId: true, classId: true, branchId: true, termId: true, issueDate: true, dueDate: true, totalKobo: true, balanceKobo: true, ...WITH_PEOPLE },
        });
        return rows.map(r => ({
            id: r.id, invoiceNumber: r.invoiceNumber, studentId: r.studentId, studentName: fullName(r.student), admissionNumber: r.student.admissionNumber,
            classId: r.classId, className: r.class?.name ?? null, branchId: r.branchId, termId: r.termId, issueDate: r.issueDate, dueDate: r.dueDate, totalKobo: r.totalKobo, balanceKobo: r.balanceKobo,
        }));
    }

    async confirmedPayments(from: Date, to: Date, branchId?: string): Promise<CollectionRow[]> {
        const rows = await this.db.payment.findMany({
            where: { status: "CONFIRMED", paidAt: { gte: from, lte: to }, ...(branchId && { branchId }) },
            select: {
                id: true, method: true, amountKobo: true, paidAt: true, createdAt: true, branchId: true, receipt: { select: { receiptNumber: true } },
                allocations: { where: { reversedAt: null }, select: { amountKobo: true, invoiceId: true, invoice: { select: { classId: true, class: { select: { name: true } } } } } },
            },
            orderBy: { paidAt: "asc" },
        });
        return rows.map(p => {
            const byClass = new Map<string, { classId: string | null; className: string | null; amountKobo: bigint }>();
            let credit = 0n;
            for (const a of p.allocations) {
                if (!a.invoiceId) { credit += a.amountKobo; continue; }
                const key = a.invoice?.classId ?? "none";
                const cur = byClass.get(key) ?? { classId: a.invoice?.classId ?? null, className: a.invoice?.class?.name ?? null, amountKobo: 0n };
                cur.amountKobo += a.amountKobo; byClass.set(key, cur);
            }
            return { id: p.id, method: p.method, amountKobo: p.amountKobo, paidOn: dayString(p.paidAt ?? p.createdAt), branchId: p.branchId, receiptNumber: p.receipt?.receiptNumber ?? null, byClass: [...byClass.values()], creditKobo: credit };
        });
    }

    async branchNames(ids: string[]) {
        if (ids.length === 0) return new Map<string, string>();
        const rows = await this.db.branch.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
        return new Map(rows.map(b => [b.id, b.name]));
    }

    async statementSource(studentId: string): Promise<StatementSource | null> {
        const student = await this.db.student.findUnique({ where: { id: studentId }, select: { id: true, firstName: true, lastName: true, admissionNumber: true } });
        if (!student) return null;
        const [invoices, adjustments, allocs, refunds, open, credit] = await Promise.all([
            this.db.feeInvoice.findMany({ where: { studentId }, select: { id: true, invoiceNumber: true, issueDate: true, subtotalKobo: true, discountKobo: true, status: true, createdAt: true } }),
            this.db.invoiceAdjustment.findMany({ where: { status: "APPROVED", invoice: { studentId } }, select: { id: true, type: true, amountKobo: true, decidedAt: true, reason: true, invoice: { select: { invoiceNumber: true } } } }),
            this.db.paymentAllocation.findMany({ where: { studentId, payment: { status: { in: ["CONFIRMED", "REVERSED"] } } }, select: { paymentId: true, amountKobo: true, payment: { select: { method: true, paidAt: true, createdAt: true, status: true, receipt: { select: { receiptNumber: true } } } } } }),
            this.db.refund.findMany({ where: { studentId, status: "PAID" }, select: { id: true, paymentId: true, amountKobo: true, paidAt: true, payment: { select: { receipt: { select: { receiptNumber: true } } } } } }),
            this.db.feeInvoice.aggregate({ where: { studentId, status: { in: ["unpaid", "partial"] } }, _sum: { balanceKobo: true } }),
            this.db.paymentAllocation.aggregate({ where: { studentId, invoiceId: null, reversedAt: null, payment: { status: "CONFIRMED" } }, _sum: { amountKobo: true } }),
        ]);

        // what each payment gave this student: the allocations that still exist plus what was paid back out of its credit
        const shares = new Map<string, StatementSource["payments"][number]>();
        for (const a of allocs) {
            const cur = shares.get(a.paymentId) ?? { paymentId: a.paymentId, receiptNumber: a.payment.receipt?.receiptNumber ?? null, method: a.payment.method, paidAt: a.payment.paidAt ?? a.payment.createdAt, status: a.payment.status, amountKobo: 0n };
            cur.amountKobo += a.amountKobo; shares.set(a.paymentId, cur);
        }
        for (const r of refunds) { const s = shares.get(r.paymentId); if (s) s.amountKobo += r.amountKobo; }

        return {
            student: { id: student.id, name: fullName(student), admissionNumber: student.admissionNumber },
            invoices, adjustments: adjustments.map(a => ({ id: a.id, invoiceNumber: a.invoice.invoiceNumber, type: a.type, amountKobo: a.amountKobo, decidedAt: a.decidedAt, reason: a.reason })),
            payments: [...shares.values()],
            refunds: refunds.map(r => ({ id: r.id, receiptNumber: r.payment.receipt?.receiptNumber ?? null, paidAt: r.paidAt, amountKobo: r.amountKobo })),
            openBalanceKobo: open._sum.balanceKobo ?? 0n, creditKobo: credit._sum.amountKobo ?? 0n,
        };
    }

    async childIdsOf(persona: "GUARDIAN" | "STUDENT", personaEntityId: string): Promise<string[]> {
        if (persona === "STUDENT") return [personaEntityId];
        return (await this.db.studentGuardian.findMany({ where: { guardianId: personaEntityId }, select: { studentId: true } })).map(r => r.studentId);
    }

    async familyInvoices(studentIds: string[], studentId?: string) {
        if (studentIds.length === 0) return [];
        const rows = await this.db.feeInvoice.findMany({
            where: { studentId: studentId ? studentId : { in: studentIds }, status: { notIn: ["draft", "void"] } },
            select: { id: true, invoiceNumber: true, studentId: true, status: true, type: true, issueDate: true, dueDate: true, totalKobo: true, paidKobo: true, balanceKobo: true, student: { select: { firstName: true, lastName: true } } },
            orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
        });
        return rows.map(r => ({ ...r, studentName: fullName(r.student) }));
    }

    async familySummary(studentIds: string[]) {
        if (studentIds.length === 0) return [];
        const [students, invoices, credit] = await Promise.all([
            this.db.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, firstName: true, lastName: true, admissionNumber: true } }),
            this.db.feeInvoice.findMany({ where: { studentId: { in: studentIds }, status: { in: ["unpaid", "partial"] }, balanceKobo: { gt: 0n } }, select: { studentId: true, balanceKobo: true, dueDate: true, issueDate: true, class: { select: { name: true } } } }),
            this.db.paymentAllocation.groupBy({ by: ["studentId"], where: { studentId: { in: studentIds }, invoiceId: null, reversedAt: null, payment: { status: "CONFIRMED" } }, _sum: { amountKobo: true } }),
        ]);
        const today = dayString(new Date());
        return students.map(s => {
            const mine = invoices.filter(i => i.studentId === s.id);
            return {
                studentId: s.id, studentName: fullName(s), admissionNumber: s.admissionNumber, className: mine.find(i => i.class)?.class?.name ?? null,
                owedKobo: mine.reduce((x, i) => x + i.balanceKobo, 0n),
                overdueInvoices: mine.filter(i => { const due = i.dueDate ?? i.issueDate; return due !== null && dayString(due) < today; }).length,
                creditKobo: credit.find(c => c.studentId === s.id)?._sum.amountKobo ?? 0n,
            };
        });
    }
}
