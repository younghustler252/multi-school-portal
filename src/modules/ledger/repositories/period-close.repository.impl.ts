import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { CloseCounts } from "../domain/period-close";
import { IPeriodCloseRepository } from "./period-close.repository";

/* Read-only counts for the close checklist. Raw SQL on the tenant client (the open transaction when there is one). */
export class PeriodCloseRepositoryImpl implements IPeriodCloseRepository {
    private get db() { return getTenantClient(); }

    private async count(sql: string, day: string): Promise<number> {
        const [row] = await this.db.$queryRawUnsafe<{ n: bigint | number }[]>(sql, day);
        return Number(row?.n ?? 0);
    }

    async counts(periodStart: string, periodEnd: string): Promise<CloseCounts> {
        return {
            draftInvoices: await this.count(`SELECT COUNT(*) AS n FROM "FeeInvoice" WHERE status = 'draft' AND "createdAt" < ($1::date + 1)`, periodEnd),
            pendingPayments: await this.count(`SELECT COUNT(*) AS n FROM "Payment" WHERE status IN ('PENDING','AWAITING_CONFIRMATION') AND "createdAt" < ($1::date + 1)`, periodEnd),
            pendingExpenses: await this.count(`SELECT COUNT(*) AS n FROM "Expense" WHERE status = 'PENDING_APPROVAL' AND "submittedAt" < ($1::date + 1)`, periodEnd),
            earlierOpenPeriods: await this.count(`SELECT COUNT(*) AS n FROM "FinancePeriod" WHERE status = 'OPEN' AND "endDate" < $1::date`, periodStart),
            unreconciledAccounts: await this.unreconciledAccounts(periodEnd),
        };
    }

    /*
    | Bank accounts that are being reconciled (they have imported statement lines up to the month end) but are not signed off through it.
    | A school that never imports a statement has none. If the reconciliation tables are not there yet (the migration has not reached
    | this school) the answer is 0, so closing a month never breaks over a feature that is not switched on.
    */
    private async unreconciledAccounts(periodEnd: string): Promise<number> {
        try {
            return await this.count(
                `SELECT COUNT(*) AS n FROM "LedgerAccount" a
                  WHERE a."isMoneyAccount" = true AND a."isActive" = true AND a."deletedAt" IS NULL
                    AND EXISTS (SELECT 1 FROM "BankStatementLine" l WHERE l."ledgerAccountId" = a.id AND l."txnDate" <= $1::date)
                    AND NOT EXISTS (SELECT 1 FROM "BankReconciliation" r JOIN "FinancePeriod" p ON p.id = r."periodId"
                                     WHERE r."ledgerAccountId" = a.id AND p."endDate" >= $1::date)`, periodEnd);
        } catch (e) {
            if (/does not exist/i.test(String((e as Error)?.message))) return 0;
            throw e;
        }
    }
}
