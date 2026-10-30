import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { AccountBalanceRow, RawMovement, naturalBalance } from "../domain/cash-book";
import { ILedgerReportRepository } from "./ledger-report.repository";

/*
| REPORT QUERIES (read-only SQL: sums over journal lines). Dates are YYYY-MM-DD strings cast to date in SQL.
| Not a table repository, so it does not extend the base class. It uses the tenant client, which is the open
| transaction when there is one.
*/
const big = (v: unknown): bigint => (typeof v === "bigint" ? v : BigInt(v as string | number));
const day = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

export class LedgerReportRepositoryImpl implements ILedgerReportRepository {
    private get db() { return getTenantClient(); }

    async balancesAsOf(asOf: string, moneyOnly: boolean): Promise<AccountBalanceRow[]> {
        const rows = await this.db.$queryRawUnsafe<any[]>(
            `SELECT a.id AS "accountId", a.code, a.name, a.type::text AS type, a.subtype, a."systemKey", a."isMoneyAccount",
                    COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l."debitKobo"  END), 0) AS debit,
                    COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l."creditKobo" END), 0) AS credit
               FROM "LedgerAccount" a
               LEFT JOIN "JournalLine" l  ON l."ledgerAccountId" = a.id
               LEFT JOIN "JournalEntry" e ON e.id = l."journalId" AND e."entryDate" <= $1::date
              WHERE a."deletedAt" IS NULL ${moneyOnly ? 'AND a."isMoneyAccount" = true' : ""}
              GROUP BY a.id
              ORDER BY a.code`,
            asOf,
        );
        // A line whose journal is dated after `asOf` finds no entry in the join (e.id is null), so it is not counted
        return rows.map(r => {
            const debitKobo = big(r.debit), creditKobo = big(r.credit);
            return {
                accountId: r.accountId, code: r.code, name: r.name, type: r.type, subtype: r.subtype, systemKey: r.systemKey,
                isMoneyAccount: r.isMoneyAccount, debitKobo, creditKobo, balanceKobo: naturalBalance(r.type, debitKobo, creditKobo),
            };
        });
    }

    async totalsBefore(accountId: string, before: string): Promise<{ debit: bigint; credit: bigint }> {
        const [row] = await this.db.$queryRawUnsafe<any[]>(
            `SELECT COALESCE(SUM(l."debitKobo"), 0) AS debit, COALESCE(SUM(l."creditKobo"), 0) AS credit
               FROM "JournalLine" l JOIN "JournalEntry" e ON e.id = l."journalId"
              WHERE l."ledgerAccountId" = $1 AND e."entryDate" < $2::date`, accountId, before);
        return { debit: big(row.debit), credit: big(row.credit) };
    }

    async movements(accountId: string, from: string, to: string): Promise<RawMovement[]> {
        const rows = await this.db.$queryRawUnsafe<any[]>(
            `SELECT e."entryDate" AS date, e.id AS "journalId", e.number, e.description, e."sourceType"::text AS "sourceType",
                    l."debitKobo", l."creditKobo"
               FROM "JournalLine" l JOIN "JournalEntry" e ON e.id = l."journalId"
              WHERE l."ledgerAccountId" = $1 AND e."entryDate" BETWEEN $2::date AND $3::date
              ORDER BY e."entryDate", e."postedAt", e.number, l."lineNumber"`, accountId, from, to);
        return rows.map(m => ({ ...m, date: day(m.date), debitKobo: big(m.debitKobo), creditKobo: big(m.creditKobo) }));
    }
}
