import { IExpenseRepository } from "../repositories/expense.repository";
import { ExpenseMapper } from "../mappers/expense.mapper";
import { ListExpensesQueryType } from "../dtos/expense.dto";
import { loadExpense } from "./expense-shared";
import { todayInFinanceZone } from "../../ledger/domain/ledger.dates";

interface Dependencies { expenseRepository: IExpenseRepository; expenseMapper: ExpenseMapper }

export class ListExpensesUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: { now?: () => Date } = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(q: ListExpensesQueryType) {
        const r = await this.d.expenseRepository.list({
            status: q.status, kind: q.kind, vendorId: q.vendorId, requestedById: q.requestedById, from: q.from, to: q.to, q: q.q,
            overdueOn: q.overdue ? todayInFinanceZone(this.now()) : undefined,
        }, q.page, q.limit);
        return { data: r.data.map(e => this.d.expenseMapper.toSummary(e)), meta: r.meta };
    }
}

export class GetExpenseUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string) { return this.d.expenseMapper.toResponse(await loadExpense(this.d.expenseRepository, id)); }
}
