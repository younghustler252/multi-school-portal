import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { parseDay } from "../../ledger/domain/ledger.dates";
import { ExpenseLineRow, IExpenseReportRepository, OpenBillRow } from "./expense-report.repository";

/* Read-only queries for the expense reports. */
export class ExpenseReportRepositoryImpl implements IExpenseReportRepository {
    private get db() { return getTenantClient(); }

    async expenseLines(from: string, to: string, filters: { vendorId?: string; termId?: string }): Promise<ExpenseLineRow[]> {
        const rows = await this.db.expenseLine.findMany({
            where: {
                expense: {
                    status: { in: ["APPROVED", "PARTIALLY_PAID", "PAID"] }, expenseDate: { gte: parseDay(from), lte: parseDay(to) },
                    ...(filters.vendorId && { vendorId: filters.vendorId }), ...(filters.termId && { termId: filters.termId }),
                },
            },
            select: {
                expenseId: true, ledgerAccountId: true, amountKobo: true,
                ledgerAccount: { select: { code: true, name: true } },
                expense: { select: { expenseNumber: true, expenseDate: true, vendorId: true, termId: true, vendor: { select: { name: true } } } },
            },
        });
        return (rows as any[]).map(r => ({
            expenseId: r.expenseId, expenseNumber: r.expense.expenseNumber, expenseDate: r.expense.expenseDate, ledgerAccountId: r.ledgerAccountId,
            accountCode: r.ledgerAccount.code, accountName: r.ledgerAccount.name, vendorId: r.expense.vendorId, vendorName: r.expense.vendor?.name ?? null,
            termId: r.expense.termId, amountKobo: r.amountKobo,
        }));
    }

    async openBills(filters: { vendorId?: string }): Promise<OpenBillRow[]> {
        const rows = await this.db.expense.findMany({
            where: { kind: "BILL", status: { in: ["APPROVED", "PARTIALLY_PAID"] }, ...(filters.vendorId && { vendorId: filters.vendorId }) },
            select: { id: true, expenseNumber: true, vendorId: true, description: true, expenseDate: true, dueDate: true, totalKobo: true, paidKobo: true, vendor: { select: { name: true } } },
            orderBy: [{ dueDate: "asc" }, { expenseDate: "asc" }],
        });
        return (rows as any[]).map(r => ({
            id: r.id, expenseNumber: r.expenseNumber, vendorId: r.vendorId, vendorName: r.vendor?.name ?? null, description: r.description,
            expenseDate: r.expenseDate, dueDate: r.dueDate, totalKobo: r.totalKobo, paidKobo: r.paidKobo,
        }));
    }

    async termNames(ids: string[]): Promise<Map<string, string>> {
        if (ids.length === 0) return new Map();
        const rows = await this.db.term.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
        return new Map((rows as { id: string; name: string }[]).map(t => [t.id, String(t.name)]));
    }
}
