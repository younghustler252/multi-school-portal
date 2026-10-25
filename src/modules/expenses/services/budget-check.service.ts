import { IBudgetRepository } from "../repositories/budget.repository";
import { BUDGET_ENFORCEMENT, BudgetEnforcement, BudgetHit, BudgetLimit, budgetHits, thisByAccount } from "../domain/expense.policy";
import { expenseErrors } from "../domain/expense.errors";
import { koboOut } from "../../ledger/mappers/kobo";

interface Dependencies { budgetRepository: IBudgetRepository }

export const hitOut = (h: BudgetHit) => ({
    ledgerAccountId: h.ledgerAccountId, accountName: h.accountName, budgetId: h.budgetId, budgetName: h.budgetName, termId: h.termId,
    plannedKobo: koboOut(h.plannedKobo), spentKobo: koboOut(h.actualKobo), thisExpenseKobo: koboOut(h.thisKobo), overByKobo: koboOut(h.overByKobo),
});

/*
| BUDGET CHECK (brief 8.8). When an expense is approved, each of its accounts is compared with the ACTIVE budgets that cover its date:
| what the books already show spent on that account over the budget's days (or the term's), plus this expense, against what was planned.
| Enforcement (a school setting later): "off" does nothing, "warn" lets it through and returns the warnings, "block" refuses with BUDGET_EXCEEDED.
*/
export class BudgetCheckService {
    private readonly enforcement: BudgetEnforcement;
    constructor(private readonly d: Dependencies, options: { enforcement?: BudgetEnforcement } = {}) { this.enforcement = options.enforcement ?? BUDGET_ENFORCEMENT; }

    async check(lines: { ledgerAccountId: string; amountKobo: bigint }[], expenseDay: string): Promise<BudgetHit[]> {
        if (this.enforcement === "off") return [];
        const mine = thisByAccount(lines);
        const rows = await this.d.budgetRepository.activeLimits([...mine.keys()], expenseDay);
        if (rows.length === 0) return [];

        const limits: BudgetLimit[] = [];
        const spentCache = new Map<string, bigint>();
        for (const r of rows) {
            const key = `${r.ledgerAccountId}|${r.from}|${r.to}`;
            if (!spentCache.has(key)) spentCache.set(key, (await this.d.budgetRepository.netDebits([r.ledgerAccountId], r.from, r.to)).get(r.ledgerAccountId) ?? 0n);
            limits.push({ ledgerAccountId: r.ledgerAccountId, accountName: r.accountName, budgetId: r.budgetId, budgetName: r.budgetName, termId: r.termId, plannedKobo: r.plannedKobo, actualKobo: spentCache.get(key)! });
        }
        const hits = budgetHits(mine, limits);
        if (hits.length > 0 && this.enforcement === "block") throw expenseErrors.budgetExceeded({ hits: hits.map(hitOut) });
        return hits;
    }
}
