import { IBudgetRepository } from "../repositories/budget.repository";
import { BUDGET_ENFORCEMENT, BudgetEnforcement, BudgetHit, BudgetLimit, budgetHits, thisByAccount } from "../domain/expense.policy";
import { expenseErrors } from "../domain/expense.errors";
import { koboOut } from "../../ledger/mappers/kobo";
import { FinanceSettingsReader } from "../../finance-settings/domain/finance-settings";

interface Dependencies { budgetRepository: IBudgetRepository; financeSettingsService?: FinanceSettingsReader }

export const hitOut = (h: BudgetHit) => ({
    ledgerAccountId: h.ledgerAccountId, accountName: h.accountName, budgetId: h.budgetId, budgetName: h.budgetName, termId: h.termId,
    plannedKobo: koboOut(h.plannedKobo), spentKobo: koboOut(h.actualKobo), thisExpenseKobo: koboOut(h.thisKobo), overByKobo: koboOut(h.overByKobo),
});

/*
| BUDGET CHECK (brief 8.8). When an expense is approved, each of its accounts is compared with the ACTIVE budgets that cover its date:
| what the books already show spent on that account over the budget's days (or the term's), plus this expense, against what was planned.
| Enforcement is the school's setting finance.budget_enforcement: "off" does nothing, "warn" lets it through and returns the
| warnings, "block" refuses with BUDGET_EXCEEDED. An explicit option (tests) wins over the setting; with neither, the default applies.
*/
export class BudgetCheckService {
    private readonly fixedEnforcement: BudgetEnforcement | undefined;
    constructor(private readonly d: Dependencies, options: { enforcement?: BudgetEnforcement } = {}) { this.fixedEnforcement = options.enforcement; }

    private async enforcementNow(): Promise<BudgetEnforcement> {
        if (this.fixedEnforcement) return this.fixedEnforcement;
        return this.d.financeSettingsService ? (await this.d.financeSettingsService.get()).budgetEnforcement : BUDGET_ENFORCEMENT;
    }

    async check(lines: { ledgerAccountId: string; amountKobo: bigint }[], expenseDay: string): Promise<BudgetHit[]> {
        const enforcement = await this.enforcementNow();
        if (enforcement === "off") return [];
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
        if (hits.length > 0 && enforcement === "block") throw expenseErrors.budgetExceeded({ hits: hits.map(hitOut) });
        return hits;
    }
}
