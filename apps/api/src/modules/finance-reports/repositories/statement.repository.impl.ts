import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { AccountBalanceRow, naturalBalance } from "../../ledger/domain/cash-book";
import { LedgerMovement, MoneyBySource } from "../domain/statements";
import { IStatementRepository } from "./statement.repository";

/* Read-only SQL over the journal lines. Days are YYYY-MM-DD strings cast to date in SQL. Uses the tenant client (the open transaction when there is one). */
const big = (v: unknown): bigint => (typeof v === "bigint" ? v : BigInt(v as string | number));
const day = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

export class StatementRepositoryImpl implements IStatementRepository {
    private get db() { return getTenantClient(); }

    async activityBetween(from: string, to: string): Promise<AccountBalanceRow[]> {
        const rows = await this.db.$queryRawUnsafe<any[]>(
            `SELECT a.id AS "accountId", a.code, a.name, a.type::text AS type, a.subtype, a."systemKey", a."isMoneyAccount",
                    COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l."debitKobo"  END), 0) AS debit,
                    COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l."creditKobo" END), 0) AS credit
               FROM "LedgerAccount" a
               LEFT JOIN "JournalLine" l  ON l."ledgerAccountId" = a.id
               LEFT JOIN "JournalEntry" e ON e.id = l."journalId" AND e."entryDate" BETWEEN $1::date AND $2::date
              WHERE a."deletedAt" IS NULL
              GROUP BY a.id
              ORDER BY a.code`, from, to);
        return rows.map(r => {
            const debitKobo = big(r.debit), creditKobo = big(r.credit);
            return { accountId: r.accountId, code: r.code, name: r.name, type: r.type, subtype: r.subtype, systemKey: r.systemKey, isMoneyAccount: r.isMoneyAccount, debitKobo, creditKobo, balanceKobo: naturalBalance(r.type, debitKobo, creditKobo) };
        });
    }

    async moneyMovementsBySource(from: string, to: string): Promise<MoneyBySource[]> {
        const rows = await this.db.$queryRawUnsafe<any[]>(
            `SELECT e."sourceType"::text AS "sourceType", SUM(l."debitKobo") AS debit, SUM(l."creditKobo") AS credit
               FROM "JournalLine" l
               JOIN "JournalEntry" e ON e.id = l."journalId"
               JOIN "LedgerAccount" a ON a.id = l."ledgerAccountId" AND a."isMoneyAccount" = true
              WHERE e."entryDate" BETWEEN $1::date AND $2::date
              GROUP BY e."sourceType"`, from, to);
        return rows.map(r => ({ sourceType: r.sourceType, debitKobo: big(r.debit), creditKobo: big(r.credit) }));
    }

    async movements(from: string, to: string, accountId?: string): Promise<LedgerMovement[]> {
        const rows = await this.db.$queryRawUnsafe<any[]>(
            `SELECT l."ledgerAccountId" AS "accountId", e."entryDate" AS date, e.id AS "journalId", e.number, e.description, e."sourceType"::text AS "sourceType",
                    l."debitKobo", l."creditKobo"
               FROM "JournalLine" l JOIN "JournalEntry" e ON e.id = l."journalId"
              WHERE e."entryDate" BETWEEN $1::date AND $2::date ${accountId ? 'AND l."ledgerAccountId" = $3' : ""}
              ORDER BY e."entryDate", e."postedAt", e.number, l."lineNumber"`,
            ...(accountId ? [from, to, accountId] : [from, to]));
        return rows.map(m => ({ ...m, date: day(m.date), debitKobo: big(m.debitKobo), creditKobo: big(m.creditKobo) }));
    }
}
