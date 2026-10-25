import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { BudgetMapper, BudgetRow } from "../mappers/budget.mapper";
import { BudgetEntity, BudgetStatus } from "../domain/expense.entity";
import { dayString, parseDay } from "../../ledger/domain/ledger.dates";
import { ActiveLimitRow, IBudgetRepository, NewBudgetLine } from "./budget.repository";

const WITH_LINES = { lines: { include: { ledgerAccount: { select: { code: true, name: true, type: true } } } } };

export class BudgetRepositoryImpl extends BaseTenantRepository<BudgetEntity, BudgetRow> implements IBudgetRepository {
    protected readonly modelName = "budget";
    protected readonly softDelete = true;

    constructor({ budgetMapper }: { budgetMapper: BudgetMapper }) { super(budgetMapper); }

    findById(id: string) { return super.findById(id, WITH_LINES); }

    list(status: BudgetStatus | undefined, page?: number, limit?: number) {
        return this.paginate({ page, limit, where: status ? { status } : {}, include: WITH_LINES, orderBy: { startDate: "desc" } });
    }

    create(data: Record<string, any>, lines: NewBudgetLine[]) {
        return super.create({ ...data, lines: { create: lines } }, WITH_LINES);
    }

    update(id: string, data: Record<string, any>) { return super.update(id, data, WITH_LINES); }

    async replaceLines(budgetId: string, lines: NewBudgetLine[]): Promise<void> {
        await this.prisma.budgetLine.deleteMany({ where: { budgetId } });
        if (lines.length > 0) await this.prisma.budgetLine.createMany({ data: lines.map(l => ({ ...l, budgetId })) });
    }

    async activeLimits(accountIds: string[], day: string): Promise<ActiveLimitRow[]> {
        if (accountIds.length === 0) return [];
        const d = parseDay(day);
        const rows = await this.prisma.budgetLine.findMany({
            where: { ledgerAccountId: { in: accountIds }, budget: { status: "ACTIVE", deletedAt: null, startDate: { lte: d }, endDate: { gte: d } } },
            include: { budget: { select: { id: true, name: true, startDate: true, endDate: true } }, ledgerAccount: { select: { name: true } } },
        });
        const termIds = [...new Set(rows.map((r: { termId: string | null }) => r.termId).filter((t: string | null): t is string => !!t))] as string[];
        const terms = termIds.length ? await this.prisma.term.findMany({ where: { id: { in: termIds } }, select: { id: true, startDate: true, endDate: true } }) : [];
        const window = new Map<string, { from: string; to: string }>(terms.map((t: { id: string; startDate: Date; endDate: Date }) => [t.id, { from: dayString(t.startDate), to: dayString(t.endDate) }]));
        const out: ActiveLimitRow[] = [];
        for (const r of rows as any[]) {
            const w = r.termId ? window.get(r.termId) : { from: dayString(r.budget.startDate), to: dayString(r.budget.endDate) };
            if (!w) continue;                                                   // the term was removed: the line cannot be checked
            out.push({
                ledgerAccountId: r.ledgerAccountId, accountName: r.ledgerAccount.name, budgetId: r.budget.id, budgetName: r.budget.name,
                termId: r.termId, plannedKobo: r.plannedKobo, from: w.from, to: w.to,
            });
        }
        return out;
    }

    private async net(accountIds: string[], from: string, to: string): Promise<Map<string, { debit: bigint; credit: bigint }>> {
        const out = new Map<string, { debit: bigint; credit: bigint }>();
        if (accountIds.length === 0) return out;
        const rows = await this.prisma.journalLine.groupBy({
            by: ["ledgerAccountId"],
            where: { ledgerAccountId: { in: accountIds }, journal: { entryDate: { gte: parseDay(from), lte: parseDay(to) } } },
            _sum: { debitKobo: true, creditKobo: true },
        });
        for (const r of rows as { ledgerAccountId: string; _sum: { debitKobo: bigint | null; creditKobo: bigint | null } }[]) {
            out.set(r.ledgerAccountId, { debit: r._sum.debitKobo ?? 0n, credit: r._sum.creditKobo ?? 0n });
        }
        return out;
    }

    async netDebits(accountIds: string[], from: string, to: string) {
        const m = await this.net(accountIds, from, to);
        return new Map([...m].map(([id, v]) => [id, v.debit - v.credit] as [string, bigint]));
    }

    async netCredits(accountIds: string[], from: string, to: string) {
        const m = await this.net(accountIds, from, to);
        return new Map([...m].map(([id, v]) => [id, v.credit - v.debit] as [string, bigint]));
    }

    async termWindow(termId: string) {
        const t = await this.prisma.term.findUnique({ where: { id: termId }, select: { startDate: true, endDate: true } });
        return t ? { from: dayString(t.startDate), to: dayString(t.endDate) } : null;
    }
}
