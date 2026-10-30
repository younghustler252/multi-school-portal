import { IMapper } from "../../../infrastructure/repository/base.repository";
import { koboOut, dayOut } from "../../ledger/mappers/kobo";
import { ExpenseEntity, ExpenseKind, ExpenseLineEntity, ExpensePaymentEntity, ExpenseStatus } from "../domain/expense.entity";

export interface ExpenseRow {
    id: string; expenseNumber: string | null; kind: string; vendorId: string | null; reference: string | null; description: string;
    expenseDate: Date; dueDate: Date | null; totalKobo: bigint; paidKobo: bigint; status: string; payFromAccountId: string | null;
    termId: string | null; branchId: string | null; recurringExpenseId: string | null; requestedById: string; submittedAt: Date | null;
    approvedById: string | null; approvedAt: Date | null; firstApprovedById?: string | null; firstApprovedAt?: Date | null; autoApproved: boolean; rejectedById: string | null; rejectedAt: Date | null; rejectionReason: string | null; voidReason: string | null;
    voidedById: string | null; voidedAt: Date | null; journalId: string | null; version: number; createdAt: Date;
    vendor?: { name: string } | null;
    lines?: { id: string; ledgerAccountId: string; description: string; amountKobo: bigint; vatKobo?: bigint; sortOrder: number; ledgerAccount?: { code: string; name: string } | null }[];
    payments?: {
        id: string; expenseId: string; amountKobo: bigint; paidOn: Date; accountId: string; method: string; reference: string | null; paidById: string;
        journalId: string; reversedAt: Date | null; reversedById: string | null; reverseReason: string | null; createdAt: Date; account?: { name: string } | null;
    }[];
}

export class ExpenseMapper implements IMapper<ExpenseRow, ExpenseEntity> {
    toDomain(raw: ExpenseRow): ExpenseEntity {
        const lines: ExpenseLineEntity[] = [...(raw.lines ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map(l => ({
            id: l.id, ledgerAccountId: l.ledgerAccountId, accountCode: l.ledgerAccount?.code ?? null, accountName: l.ledgerAccount?.name ?? null,
            description: l.description, amountKobo: l.amountKobo, vatKobo: l.vatKobo ?? 0n, sortOrder: l.sortOrder,
        }));
        const payments: ExpensePaymentEntity[] = [...(raw.payments ?? [])].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map(p => ({
            id: p.id, expenseId: p.expenseId, amountKobo: p.amountKobo, paidOn: p.paidOn, accountId: p.accountId, accountName: p.account?.name ?? null,
            method: p.method, reference: p.reference, paidById: p.paidById, journalId: p.journalId, reversedAt: p.reversedAt,
            reversedById: p.reversedById, reverseReason: p.reverseReason, createdAt: p.createdAt,
        }));
        return {
            id: raw.id, expenseNumber: raw.expenseNumber, kind: raw.kind as ExpenseKind, vendorId: raw.vendorId, vendorName: raw.vendor?.name ?? null,
            reference: raw.reference, description: raw.description, expenseDate: raw.expenseDate, dueDate: raw.dueDate, totalKobo: raw.totalKobo,
            paidKobo: raw.paidKobo, status: raw.status as ExpenseStatus, payFromAccountId: raw.payFromAccountId, termId: raw.termId, branchId: raw.branchId,
            recurringExpenseId: raw.recurringExpenseId, requestedById: raw.requestedById, submittedAt: raw.submittedAt, firstApprovedById: raw.firstApprovedById ?? null, firstApprovedAt: raw.firstApprovedAt ?? null, approvedById: raw.approvedById,
            approvedAt: raw.approvedAt, autoApproved: raw.autoApproved, rejectedById: raw.rejectedById, rejectedAt: raw.rejectedAt, rejectionReason: raw.rejectionReason, voidReason: raw.voidReason,
            voidedById: raw.voidedById, voidedAt: raw.voidedAt, journalId: raw.journalId, version: raw.version, createdAt: raw.createdAt, lines, payments,
        };
    }

    /* A short row for lists: no lines or payments. */
    toSummary(e: ExpenseEntity) {
        return {
            id: e.id, expenseNumber: e.expenseNumber, kind: e.kind, status: e.status, description: e.description, reference: e.reference,
            vendor: e.vendorId ? { id: e.vendorId, name: e.vendorName } : null,
            expenseDate: dayOut(e.expenseDate), dueDate: e.dueDate ? dayOut(e.dueDate) : null,
            totalKobo: koboOut(e.totalKobo), paidKobo: koboOut(e.paidKobo), balanceKobo: koboOut(e.kind === "BILL" ? e.totalKobo - e.paidKobo : 0n),
            requestedById: e.requestedById, autoApproved: e.autoApproved, createdAt: e.createdAt,
        };
    }

    toResponse(e: ExpenseEntity) {
        return {
            ...this.toSummary(e),
            payFromAccountId: e.payFromAccountId, termId: e.termId, branchId: e.branchId, recurringExpenseId: e.recurringExpenseId,
            submittedAt: e.submittedAt, firstApprovedById: e.firstApprovedById, firstApprovedAt: e.firstApprovedAt, approvedById: e.approvedById, approvedAt: e.approvedAt, rejectedById: e.rejectedById, rejectedAt: e.rejectedAt, rejectionReason: e.rejectionReason,
            voidReason: e.voidReason, voidedById: e.voidedById, voidedAt: e.voidedAt, journalId: e.journalId, version: e.version,
            lines: e.lines.map(l => ({ id: l.id, ledgerAccountId: l.ledgerAccountId, accountCode: l.accountCode, accountName: l.accountName, description: l.description, amountKobo: koboOut(l.amountKobo), vatKobo: koboOut(l.vatKobo ?? 0n) })),
            vatKobo: koboOut(e.lines.reduce((s, l) => s + (l.vatKobo ?? 0n), 0n)),
            payments: e.payments.map(p => ({
                id: p.id, amountKobo: koboOut(p.amountKobo), paidOn: dayOut(p.paidOn), accountId: p.accountId, accountName: p.accountName, method: p.method,
                reference: p.reference, paidById: p.paidById, journalId: p.journalId, reversed: p.reversedAt !== null, reversedAt: p.reversedAt, reverseReason: p.reverseReason,
            })),
        };
    }
}
