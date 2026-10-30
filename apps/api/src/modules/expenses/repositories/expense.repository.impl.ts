import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { ExpenseMapper, ExpenseRow } from "../mappers/expense.mapper";
import { ExpenseEntity, ExpenseFilters, ExpenseStatus } from "../domain/expense.entity";
import { parseDay } from "../../ledger/domain/ledger.dates";
import { IExpenseRepository, NewExpenseLine } from "./expense.repository";

const LIGHT = { vendor: { select: { name: true } } };
const FULL = {
    vendor: { select: { name: true } },
    lines: { include: { ledgerAccount: { select: { code: true, name: true } } } },
    payments: { include: { account: { select: { name: true } } } },
};
const EDITABLE = ["DRAFT", "REJECTED"];

export class ExpenseRepositoryImpl extends BaseTenantRepository<ExpenseEntity, ExpenseRow> implements IExpenseRepository {
    protected readonly modelName = "expense";

    constructor({ expenseMapper }: { expenseMapper: ExpenseMapper }) { super(expenseMapper); }

    findById(id: string) { return super.findById(id, FULL); }

    list(f: ExpenseFilters, page?: number, limit?: number) {
        const where: Record<string, unknown> = {
            ...(f.status && { status: f.status }), ...(f.kind && { kind: f.kind }), ...(f.vendorId && { vendorId: f.vendorId }),
            ...(f.requestedById && { requestedById: f.requestedById }),
            ...((f.from || f.to) && { expenseDate: { ...(f.from && { gte: parseDay(f.from) }), ...(f.to && { lte: parseDay(f.to) }) } }),
            ...(f.q && { OR: [
                { description: { contains: f.q, mode: "insensitive" } }, { expenseNumber: { contains: f.q, mode: "insensitive" } },
                { reference: { contains: f.q, mode: "insensitive" } }, { vendor: { name: { contains: f.q, mode: "insensitive" } } },
            ] }),
            ...(f.overdueOn && { kind: "BILL", status: { in: ["APPROVED", "PARTIALLY_PAID"] }, dueDate: { lt: parseDay(f.overdueOn) } }),
        };
        return this.paginate({ page, limit, where, include: LIGHT, orderBy: { createdAt: "desc" } });
    }

    createDraft(data: Record<string, any>, lines: NewExpenseLine[]) {
        return super.create({ ...data, lines: { create: lines } }, FULL);
    }

    async updateEditable(id: string, version: number, data: Record<string, any>, lines: NewExpenseLine[]): Promise<boolean> {
        const r = await this.model().updateMany({ where: { id, version, status: { in: EDITABLE } }, data: { ...data, version: { increment: 1 } } });
        if (r.count !== 1) return false;
        await this.prisma.expenseLine.deleteMany({ where: { expenseId: id } });
        await this.prisma.expenseLine.createMany({ data: lines.map(l => ({ ...l, expenseId: id })) });
        return true;
    }

    async deleteEditable(id: string): Promise<boolean> {
        const live = await this.model().count({ where: { id, status: { in: EDITABLE }, payments: { none: {} } } });
        if (live !== 1) return false;
        await this.prisma.expenseLine.deleteMany({ where: { expenseId: id } });
        const r = await this.model().deleteMany({ where: { id, status: { in: EDITABLE } } });
        return r.count === 1;
    }

    async transition(id: string, from: ExpenseStatus[], version: number, data: Record<string, any>): Promise<boolean> {
        const r = await this.model().updateMany({ where: { id, version, status: { in: from } }, data: { ...data, version: { increment: 1 } } });
        return r.count === 1;
    }

    async applyPaid(id: string, version: number, paidKobo: bigint, status: ExpenseStatus): Promise<boolean> {
        const r = await this.model().updateMany({ where: { id, version }, data: { paidKobo, status, version: { increment: 1 } } });
        return r.count === 1;
    }

    async createPayment(data: Record<string, any>): Promise<void> { await this.prisma.expensePayment.create({ data: data as any }); }

    async markPaymentReversed(paymentId: string, data: Record<string, any>): Promise<boolean> {
        const r = await this.prisma.expensePayment.updateMany({ where: { id: paymentId, reversedAt: null }, data: data as any });
        return r.count === 1;
    }

    async termExists(id: string): Promise<boolean> { return (await this.prisma.term.count({ where: { id } })) > 0; }
    async branchExists(id: string): Promise<boolean> { return (await this.prisma.branch.count({ where: { id } })) > 0; }

    async recurringExists(recurringId: string, expenseDay: string): Promise<boolean> {
        return (await this.model().count({ where: { recurringExpenseId: recurringId, expenseDate: parseDay(expenseDay) } })) > 0;
    }
}
