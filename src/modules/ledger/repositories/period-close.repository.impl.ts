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
        };
    }
}
