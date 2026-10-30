import { IBudgetRepository, NewBudgetLine } from "../repositories/budget.repository";
import { IExpenseRepository } from "../repositories/expense.repository";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { BudgetMapper } from "../mappers/budget.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { expenseErrors } from "../domain/expense.errors";
import { BudgetEntity } from "../domain/expense.entity";
import { dayString, parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { koboOut } from "../../ledger/mappers/kobo";
import { CreateBudgetDtoType, UpdateBudgetDtoType, SetBudgetLinesDtoType, ListBudgetsQueryType } from "../dtos/budget.dto";
import { BudgetVsActualQueryType } from "../dtos/expense-report.dto";

interface Dependencies {
    budgetRepository: IBudgetRepository; expenseRepository: IExpenseRepository; ledgerAccountRepository: ILedgerAccountRepository;
    budgetMapper: BudgetMapper; auditService: AuditService;
}

async function load(repo: IBudgetRepository, id: string): Promise<BudgetEntity> {
    const b = await repo.findById(id);
    if (!b) throw expenseErrors.budgetNotFound();
    return b;
}

function checkDates(start: string, end: string) {
    parseDay(start); parseDay(end);
    if (end < start) throw expenseErrors.budgetDates();
}

/* A budget plans money for income and expense accounts only; an account can appear once per term (or once for the whole period). */
async function prepareLines(d: Dependencies, lines: { ledgerAccountId: string; termId?: string; plannedKobo: bigint; note?: string }[]): Promise<NewBudgetLine[]> {
    const seen = new Set<string>();
    for (const l of lines) {
        const key = `${l.ledgerAccountId}|${l.termId ?? ""}`;
        if (seen.has(key)) throw expenseErrors.budgetLineDuplicate();
        seen.add(key);
    }
    const accounts = await d.ledgerAccountRepository.findByIds([...new Set(lines.map(l => l.ledgerAccountId))]);
    const byId = new Map(accounts.map(a => [a.id, a]));
    for (const l of lines) {
        const a = byId.get(l.ledgerAccountId);
        if (!a) throw expenseErrors.budgetLineAccount("That account does not exist");
        if (!a.isActive) throw expenseErrors.budgetLineAccount(`${a.name} is not active`);
        if ((a.type !== "INCOME" && a.type !== "EXPENSE") || a.isMoneyAccount) throw expenseErrors.budgetLineAccount(`${a.name} is not an income or expense account`);
        if (l.termId && !(await d.expenseRepository.termExists(l.termId))) throw expenseErrors.refNotFound("The term");
    }
    return lines.map(l => ({ ledgerAccountId: l.ledgerAccountId, termId: l.termId ?? null, plannedKobo: l.plannedKobo, note: l.note ?? null }));
}

export class ListBudgetsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListBudgetsQueryType) {
        const r = await this.d.budgetRepository.list(q.status, q.page, q.limit);
        return { data: r.data.map(b => this.d.budgetMapper.toResponse(b)), meta: r.meta };
    }
}

export class GetBudgetUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string) { return this.d.budgetMapper.toResponse(await load(this.d.budgetRepository, id)); }
}

export class CreateBudgetUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: CreateBudgetDtoType) {
        checkDates(dto.startDate, dto.endDate);
        const lines = await prepareLines(this.d, dto.lines);
        const created = await this.d.budgetRepository.create({
            name: dto.name, sessionId: dto.sessionId ?? null, startDate: parseDay(dto.startDate), endDate: parseDay(dto.endDate), createdById: actorUserId, updatedById: actorUserId,
        }, lines);
        await this.d.auditService.log({ userId: actorUserId, schoolId, action: "budgets.created", entity: "Budget", entityId: created.id, newValue: { name: created.name, lines: lines.length } });
        return this.d.budgetMapper.toResponse(created);
    }
}

export class UpdateBudgetUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, dto: UpdateBudgetDtoType) {
        const b = await load(this.d.budgetRepository, id);
        if (b.status === "CLOSED") throw expenseErrors.budgetClosed();
        const start = dto.startDate ?? dayString(b.startDate), end = dto.endDate ?? dayString(b.endDate);
        checkDates(start, end);
        const updated = await this.d.budgetRepository.update(id, {
            ...(dto.name !== undefined && { name: dto.name }), ...(dto.sessionId !== undefined && { sessionId: dto.sessionId }),
            startDate: parseDay(start), endDate: parseDay(end), updatedById: actorUserId,
        });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "budgets.updated", entity: "Budget", entityId: id,
            oldValue: { name: b.name, startDate: dayString(b.startDate), endDate: dayString(b.endDate) }, newValue: { name: updated.name, startDate: start, endDate: end },
        });
        return this.d.budgetMapper.toResponse(updated);
    }
}

/* Replace all the lines at once (the screen sends the whole table). */
export class SetBudgetLinesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, dto: SetBudgetLinesDtoType) {
        const b = await load(this.d.budgetRepository, id);
        if (b.status === "CLOSED") throw expenseErrors.budgetClosed();
        const lines = await prepareLines(this.d, dto.lines);
        if (b.status === "ACTIVE" && lines.length === 0) throw expenseErrors.budgetNeedsLines();
        await this.d.budgetRepository.replaceLines(id, lines);
        await this.d.auditService.log({ userId: actorUserId, schoolId, action: "budgets.lines_replaced", entity: "Budget", entityId: id, oldValue: { lines: b.lines.length }, newValue: { lines: lines.length } });
        return this.d.budgetMapper.toResponse(await load(this.d.budgetRepository, id));
    }
}

/* DRAFT -> ACTIVE (needs lines; only ACTIVE budgets are used by the approval check) -> CLOSED. */
export class SetBudgetStatusUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, to: "ACTIVE" | "CLOSED") {
        const b = await load(this.d.budgetRepository, id);
        if (to === "ACTIVE") {
            if (b.status !== "DRAFT") throw expenseErrors.budgetStatus(b.status);
            if (b.lines.length === 0) throw expenseErrors.budgetNeedsLines();
        } else if (b.status !== "ACTIVE") throw expenseErrors.budgetStatus(b.status);
        const updated = await this.d.budgetRepository.update(id, { status: to, updatedById: actorUserId });
        await this.d.auditService.log({ userId: actorUserId, schoolId, action: to === "ACTIVE" ? "budgets.activated" : "budgets.closed", entity: "Budget", entityId: id, oldValue: { status: b.status }, newValue: { status: to } });
        return this.d.budgetMapper.toResponse(updated);
    }
}

export class DeleteBudgetUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string) {
        const b = await load(this.d.budgetRepository, id);
        if (b.status !== "DRAFT") throw expenseErrors.budgetStatus(b.status);
        await this.d.budgetRepository.delete(id);
        await this.d.auditService.log({ userId: actorUserId, schoolId, action: "budgets.deleted", entity: "Budget", entityId: id, oldValue: { name: b.name } });
        return { deleted: true };
    }
}

/*
| PLANNED AGAINST ACTUAL (brief 9.1): for each budget line, what the books show over its days (the term's, or the budget's), up to "as of".
| Spending is debits less credits on an expense account; income is credits less debits on an income account.
*/
export class BudgetVsActualUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: { now?: () => Date } = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(id: string, q: BudgetVsActualQueryType = {}) {
        const d = this.d;
        const b = await load(d.budgetRepository, id);
        const asOf = q.asOf ?? todayInFinanceZone(this.now());
        parseDay(asOf);

        const rows = [];
        const totals = { INCOME: { planned: 0n, actual: 0n }, EXPENSE: { planned: 0n, actual: 0n } };
        for (const l of b.lines) {
            const w = l.termId ? await d.budgetRepository.termWindow(l.termId) : { from: dayString(b.startDate), to: dayString(b.endDate) };
            const from = w?.from ?? dayString(b.startDate);
            const to = w ? (w.to < asOf ? w.to : asOf) : asOf;
            const isIncome = l.accountType === "INCOME";
            let actual = 0n;
            if (w && to >= from) {
                const m = isIncome ? await d.budgetRepository.netCredits([l.ledgerAccountId], from, to) : await d.budgetRepository.netDebits([l.ledgerAccountId], from, to);
                actual = m.get(l.ledgerAccountId) ?? 0n;
            }
            const bucket = isIncome ? totals.INCOME : totals.EXPENSE;
            bucket.planned += l.plannedKobo; bucket.actual += actual;
            rows.push({
                ledgerAccountId: l.ledgerAccountId, accountCode: l.accountCode, accountName: l.accountName, accountType: l.accountType, termId: l.termId,
                from, to, plannedKobo: koboOut(l.plannedKobo), actualKobo: koboOut(actual), remainingKobo: koboOut(l.plannedKobo - actual),
                usedPercent: Number((actual * 1000n) / l.plannedKobo) / 10, over: actual > l.plannedKobo,
            });
        }
        const sum = (t: { planned: bigint; actual: bigint }) => ({ plannedKobo: koboOut(t.planned), actualKobo: koboOut(t.actual), remainingKobo: koboOut(t.planned - t.actual) });
        return { budget: { id: b.id, name: b.name, status: b.status, startDate: dayString(b.startDate), endDate: dayString(b.endDate) }, asOf, lines: rows, totals: { income: sum(totals.INCOME), expense: sum(totals.EXPENSE) } };
    }
}
