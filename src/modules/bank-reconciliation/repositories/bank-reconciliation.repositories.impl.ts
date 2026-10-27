import { randomUUID } from "crypto";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import {
    AccountOverview, BankLineEntity, BankStatementEntity, BookLineEntity, MatchGroupEntity, MatchKind,
    NewBankLine, NewBankStatement, ReconciliationEntity,
} from "../domain/reconciliation.entity";
import {
    BankLineFilter, BookLineFilter, IBankStatementRepository, IBookLineRepository, IMatchRepository, IReconciliationRepository, Page,
} from "./bank-reconciliation.repositories";

/*
| BANK RECONCILIATION QUERIES. SQL on the tenant client (the open transaction when there is one). Dates go in as YYYY-MM-DD text
| cast to date; bigint columns come back as bigint or number depending on the driver, so every amount goes through big().
| None of these extends the base class: the tables have no soft delete and the reads join across the books.
*/
const big = (v: unknown): bigint => (typeof v === "bigint" ? v : BigInt(String(v)));
const bigOrNull = (v: unknown): bigint | null => (v === null || v === undefined ? null : big(v));
const day = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const offsetOf = (page: number, limit: number) => (Math.max(1, page) - 1) * limit;

abstract class Sql { protected get db() { return getTenantClient(); } }

/* ---------- statements and bank lines ---------- */

const statementOf = (r: any): BankStatementEntity => ({
    id: r.id, ledgerAccountId: r.ledgerAccountId, fileName: r.fileName, startDate: day(r.startDate), endDate: day(r.endDate),
    openingBalanceKobo: bigOrNull(r.openingBalanceKobo), closingBalanceKobo: bigOrNull(r.closingBalanceKobo),
    lineCount: Number(r.lineCount), importedById: r.importedById, importedAt: new Date(r.importedAt),
});

const bankLineOf = (r: any): BankLineEntity => ({
    id: r.id, statementId: r.statementId, ledgerAccountId: r.ledgerAccountId, lineNumber: Number(r.lineNumber),
    date: day(r.txnDate), description: r.description, reference: r.reference,
    amountKobo: big(r.amountKobo), balanceKobo: bigOrNull(r.balanceKobo), matchGroupId: r.matchGroupId,
});

const BANK_LINE_COLUMNS = `l.id, l."statementId", l."ledgerAccountId", l."lineNumber", l."txnDate", l.description, l.reference, l."amountKobo", l."balanceKobo", l."matchGroupId"`;

export class BankStatementRepositoryImpl extends Sql implements IBankStatementRepository {
    async existingDedupeKeys(accountId: string, keys: string[]): Promise<Set<string>> {
        if (keys.length === 0) return new Set();
        const rows = await this.db.$queryRawUnsafe<{ dedupeKey: string }[]>(
            `SELECT "dedupeKey" FROM "BankStatementLine" WHERE "ledgerAccountId" = $1 AND "dedupeKey" = ANY($2::text[])`, accountId, keys);
        return new Set(rows.map(r => r.dedupeKey));
    }

    async findByFileHash(accountId: string, fileHash: string): Promise<BankStatementEntity | null> {
        const [r] = await this.db.$queryRawUnsafe<any[]>(`SELECT * FROM "BankStatement" WHERE "ledgerAccountId" = $1 AND "fileHash" = $2`, accountId, fileHash);
        return r ? statementOf(r) : null;
    }

    async insert(s: NewBankStatement, lines: NewBankLine[]): Promise<void> {
        await this.db.$executeRawUnsafe(
            `INSERT INTO "BankStatement" (id, "ledgerAccountId", "fileName", "fileHash", "startDate", "endDate", "openingBalanceKobo", "closingBalanceKobo", "lineCount", "importedById")
             VALUES ($1, $2, $3, $4, $5::date, $6::date, $7::bigint, $8::bigint, $9::int, $10)`,
            s.id, s.ledgerAccountId, s.fileName, s.fileHash, s.startDate, s.endDate,
            s.openingBalanceKobo === null ? null : s.openingBalanceKobo.toString(), s.closingBalanceKobo === null ? null : s.closingBalanceKobo.toString(),
            s.lineCount, s.importedById);

        const CHUNK = 400;   // 10 parameters a row: well under the driver's limit
        for (let i = 0; i < lines.length; i += CHUNK) {
            const part = lines.slice(i, i + CHUNK);
            const params: unknown[] = [];
            const tuples = part.map(l => {
                const b = params.length;
                params.push(l.id, s.id, s.ledgerAccountId, l.lineNumber, l.date, l.description, l.reference,
                    l.amountKobo.toString(), l.balanceKobo === null ? null : l.balanceKobo.toString(), l.dedupeKey);
                return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}::int, $${b + 5}::date, $${b + 6}, $${b + 7}, $${b + 8}::bigint, $${b + 9}::bigint, $${b + 10})`;
            });
            await this.db.$executeRawUnsafe(
                `INSERT INTO "BankStatementLine" (id, "statementId", "ledgerAccountId", "lineNumber", "txnDate", description, reference, "amountKobo", "balanceKobo", "dedupeKey")
                 VALUES ${tuples.join(", ")}`, ...params);
        }
    }

    async findStatement(id: string): Promise<BankStatementEntity | null> {
        const [r] = await this.db.$queryRawUnsafe<any[]>(`SELECT * FROM "BankStatement" WHERE id = $1`, id);
        return r ? statementOf(r) : null;
    }

    async listStatements(accountId: string | null, page: number, limit: number): Promise<Page<BankStatementEntity>> {
        const where = accountId ? `WHERE "ledgerAccountId" = $1` : "";
        const args = accountId ? [accountId] : [];
        const [c] = await this.db.$queryRawUnsafe<any[]>(`SELECT COUNT(*) AS n FROM "BankStatement" ${where}`, ...args);
        const rows = await this.db.$queryRawUnsafe<any[]>(
            `SELECT * FROM "BankStatement" ${where} ORDER BY "endDate" DESC, "importedAt" DESC LIMIT ${Number(limit)} OFFSET ${offsetOf(page, limit)}`, ...args);
        return { rows: rows.map(statementOf), total: Number(c.n) };
    }

    async matchedLineCount(statementId: string): Promise<number> {
        const [r] = await this.db.$queryRawUnsafe<any[]>(`SELECT COUNT(*) AS n FROM "BankStatementLine" WHERE "statementId" = $1 AND "matchGroupId" IS NOT NULL`, statementId);
        return Number(r.n);
    }

    async deleteStatement(id: string): Promise<void> {
        await this.db.$executeRawUnsafe(`DELETE FROM "BankStatement" WHERE id = $1`, id);   // its lines go with it (ON DELETE CASCADE)
    }

    async listLines(f: BankLineFilter): Promise<Page<BankLineEntity>> {
        const args: unknown[] = [f.accountId];
        const where = [`l."ledgerAccountId" = $1`];
        if (f.status === "unmatched") where.push(`l."matchGroupId" IS NULL`);
        if (f.status === "matched") where.push(`l."matchGroupId" IS NOT NULL`);
        if (f.from) { args.push(f.from); where.push(`l."txnDate" >= $${args.length}::date`); }
        if (f.to) { args.push(f.to); where.push(`l."txnDate" <= $${args.length}::date`); }
        if (f.statementId) { args.push(f.statementId); where.push(`l."statementId" = $${args.length}`); }
        const clause = where.join(" AND ");
        const [c] = await this.db.$queryRawUnsafe<any[]>(`SELECT COUNT(*) AS n FROM "BankStatementLine" l WHERE ${clause}`, ...args);
        const rows = await this.db.$queryRawUnsafe<any[]>(
            `SELECT ${BANK_LINE_COLUMNS} FROM "BankStatementLine" l WHERE ${clause}
              ORDER BY l."txnDate", l."createdAt", l."lineNumber" LIMIT ${Number(f.limit)} OFFSET ${offsetOf(f.page, f.limit)}`, ...args);
        return { rows: rows.map(bankLineOf), total: Number(c.n) };
    }

    async findLines(ids: string[]): Promise<BankLineEntity[]> {
        if (ids.length === 0) return [];
        const rows = await this.db.$queryRawUnsafe<any[]>(`SELECT ${BANK_LINE_COLUMNS} FROM "BankStatementLine" l WHERE l.id = ANY($1::text[])`, ids);
        return rows.map(bankLineOf);
    }

    async unmatchedUpTo(accountId: string, toDay: string): Promise<BankLineEntity[]> {
        const rows = await this.db.$queryRawUnsafe<any[]>(
            `SELECT ${BANK_LINE_COLUMNS} FROM "BankStatementLine" l
              WHERE l."ledgerAccountId" = $1 AND l."txnDate" <= $2::date AND l."matchGroupId" IS NULL
              ORDER BY l."txnDate", l."createdAt", l."lineNumber"`, accountId, toDay);
        return rows.map(bankLineOf);
    }

    async balancesUpTo(accountId: string, toDay: string): Promise<{ date: string; balanceKobo: bigint | null }[]> {
        const rows = await this.db.$queryRawUnsafe<any[]>(
            `SELECT l."txnDate", l."balanceKobo" FROM "BankStatementLine" l
              WHERE l."ledgerAccountId" = $1 AND l."txnDate" <= $2::date
              ORDER BY l."txnDate", l."createdAt", l."lineNumber"`, accountId, toDay);
        return rows.map(r => ({ date: day(r.txnDate), balanceKobo: bigOrNull(r.balanceKobo) }));
    }
}

/* ---------- the books' side ---------- */

const bookLineOf = (r: any): BookLineEntity => ({
    id: r.id, ledgerAccountId: r.ledgerAccountId, journalId: r.journalId, journalNumber: r.number, lineNumber: Number(r.lineNumber),
    date: day(r.entryDate), description: r.description, memo: r.memo, sourceType: r.sourceType, journalStatus: r.journalStatus,
    reversalOfJournalId: r.reversalOfId, amountKobo: big(r.debitKobo) - big(r.creditKobo), matchGroupId: r.matchGroupId,
});

const BOOK_FROM = `FROM "JournalLine" jl
    JOIN "JournalEntry" je ON je.id = jl."journalId"
    LEFT JOIN "BankMatchedJournalLine" m ON m."journalLineId" = jl.id`;
const BOOK_COLUMNS = `jl.id, jl."ledgerAccountId", jl."journalId", jl."lineNumber", jl."debitKobo", jl."creditKobo", jl.memo,
    je.number, je."entryDate", je.description, je."sourceType"::text AS "sourceType", je.status::text AS "journalStatus", je."reversalOfId",
    m."groupId" AS "matchGroupId"`;
const BOOK_ORDER = `ORDER BY je."entryDate", je."postedAt", je.number, jl."lineNumber"`;

export class BookLineRepositoryImpl extends Sql implements IBookLineRepository {
    async list(f: BookLineFilter): Promise<Page<BookLineEntity>> {
        const args: unknown[] = [f.accountId];
        const where = [`jl."ledgerAccountId" = $1`];
        if (f.status === "unmatched") where.push(`m."journalLineId" IS NULL`);
        if (f.status === "matched") where.push(`m."journalLineId" IS NOT NULL`);
        if (f.from) { args.push(f.from); where.push(`je."entryDate" >= $${args.length}::date`); }
        if (f.to) { args.push(f.to); where.push(`je."entryDate" <= $${args.length}::date`); }
        const clause = where.join(" AND ");
        const [c] = await this.db.$queryRawUnsafe<any[]>(`SELECT COUNT(*) AS n ${BOOK_FROM} WHERE ${clause}`, ...args);
        const rows = await this.db.$queryRawUnsafe<any[]>(
            `SELECT ${BOOK_COLUMNS} ${BOOK_FROM} WHERE ${clause} ${BOOK_ORDER} LIMIT ${Number(f.limit)} OFFSET ${offsetOf(f.page, f.limit)}`, ...args);
        return { rows: rows.map(bookLineOf), total: Number(c.n) };
    }

    async findByIds(ids: string[]): Promise<BookLineEntity[]> {
        if (ids.length === 0) return [];
        const rows = await this.db.$queryRawUnsafe<any[]>(`SELECT ${BOOK_COLUMNS} ${BOOK_FROM} WHERE jl.id = ANY($1::text[])`, ids);
        return rows.map(bookLineOf);
    }

    async unmatchedUpTo(accountId: string, toDay: string): Promise<BookLineEntity[]> {
        const rows = await this.db.$queryRawUnsafe<any[]>(
            `SELECT ${BOOK_COLUMNS} ${BOOK_FROM}
              WHERE jl."ledgerAccountId" = $1 AND je."entryDate" <= $2::date AND m."journalLineId" IS NULL ${BOOK_ORDER}`, accountId, toDay);
        return rows.map(bookLineOf);
    }

    async balanceAsOf(accountId: string, asOf: string): Promise<bigint> {
        const [r] = await this.db.$queryRawUnsafe<any[]>(
            `SELECT COALESCE(SUM(jl."debitKobo" - jl."creditKobo"), 0)::text AS n
               FROM "JournalLine" jl JOIN "JournalEntry" je ON je.id = jl."journalId"
              WHERE jl."ledgerAccountId" = $1 AND je."entryDate" <= $2::date`, accountId, asOf);
        return big(r.n);
    }
}

/* ---------- pairings ---------- */

export class MatchRepositoryImpl extends Sql implements IMatchRepository {
    async createGroup(g: { id: string; ledgerAccountId: string; kind: MatchKind; note: string | null; createdById: string | null }, bankLineIds: string[], journalLineIds: string[]): Promise<boolean> {
        await this.db.$executeRawUnsafe(
            `INSERT INTO "BankMatchGroup" (id, "ledgerAccountId", kind, note, "createdById") VALUES ($1, $2, $3::"BankMatchKind", $4, $5)`,
            g.id, g.ledgerAccountId, g.kind, g.note, g.createdById);

        // Claim the bank lines only if they are still free: the count tells us whether someone beat us to one
        if (bankLineIds.length > 0) {
            const claimed = await this.db.$executeRawUnsafe(
                `UPDATE "BankStatementLine" SET "matchGroupId" = $1 WHERE id = ANY($2::text[]) AND "matchGroupId" IS NULL AND "ledgerAccountId" = $3`,
                g.id, bankLineIds, g.ledgerAccountId);
            if (Number(claimed) !== bankLineIds.length) return false;
        }
        if (journalLineIds.length > 0) {
            // The primary key on journalLineId makes a double claim fail; ON CONFLICT DO NOTHING lets us count instead
            const claimed = await this.db.$executeRawUnsafe(
                `INSERT INTO "BankMatchedJournalLine" ("journalLineId", "groupId")
                 SELECT x, $1 FROM unnest($2::text[]) AS x ON CONFLICT ("journalLineId") DO NOTHING`, g.id, journalLineIds);
            if (Number(claimed) !== journalLineIds.length) return false;
        }
        return true;
    }

    async findGroup(id: string): Promise<MatchGroupEntity | null> {
        const [g] = await this.db.$queryRawUnsafe<any[]>(`SELECT * FROM "BankMatchGroup" WHERE id = $1`, id);
        if (!g) return null;
        const bank = await this.db.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "BankStatementLine" WHERE "matchGroupId" = $1`, id);
        const book = await this.db.$queryRawUnsafe<{ journalLineId: string }[]>(`SELECT "journalLineId" FROM "BankMatchedJournalLine" WHERE "groupId" = $1`, id);
        return {
            id: g.id, ledgerAccountId: g.ledgerAccountId, kind: g.kind, note: g.note, createdById: g.createdById, createdAt: new Date(g.createdAt),
            bankLineIds: bank.map(b => b.id), journalLineIds: book.map(b => b.journalLineId),
        };
    }

    async deleteGroup(id: string): Promise<void> {
        // Bank lines are freed by ON DELETE SET NULL and the journal line rows go by ON DELETE CASCADE
        await this.db.$executeRawUnsafe(`DELETE FROM "BankMatchGroup" WHERE id = $1`, id);
    }
}

/* ---------- month sign-off ---------- */

const reconciliationOf = (r: any): ReconciliationEntity => ({
    id: r.id, ledgerAccountId: r.ledgerAccountId, periodId: r.periodId, periodName: r.periodName, periodEnd: day(r.periodEnd),
    statementBalanceKobo: big(r.statementBalanceKobo), bookBalanceKobo: big(r.bookBalanceKobo), outstandingBookKobo: big(r.outstandingBookKobo),
    note: r.note, completedById: r.completedById, completedAt: new Date(r.completedAt),
});

const RECONCILIATION_SELECT = `SELECT r.*, p.name AS "periodName", p."endDate" AS "periodEnd" FROM "BankReconciliation" r JOIN "FinancePeriod" p ON p.id = r."periodId"`;

export class ReconciliationRepositoryImpl extends Sql implements IReconciliationRepository {
    async find(accountId: string, periodId: string): Promise<ReconciliationEntity | null> {
        const [r] = await this.db.$queryRawUnsafe<any[]>(`${RECONCILIATION_SELECT} WHERE r."ledgerAccountId" = $1 AND r."periodId" = $2`, accountId, periodId);
        return r ? reconciliationOf(r) : null;
    }

    async findById(id: string): Promise<ReconciliationEntity | null> {
        const [r] = await this.db.$queryRawUnsafe<any[]>(`${RECONCILIATION_SELECT} WHERE r.id = $1`, id);
        return r ? reconciliationOf(r) : null;
    }

    async create(r: { id: string; ledgerAccountId: string; periodId: string; statementBalanceKobo: bigint; bookBalanceKobo: bigint; outstandingBookKobo: bigint; note: string | null; completedById: string | null }): Promise<void> {
        await this.db.$executeRawUnsafe(
            `INSERT INTO "BankReconciliation" (id, "ledgerAccountId", "periodId", "statementBalanceKobo", "bookBalanceKobo", "outstandingBookKobo", note, "completedById")
             VALUES ($1, $2, $3, $4::bigint, $5::bigint, $6::bigint, $7, $8)`,
            r.id, r.ledgerAccountId, r.periodId, r.statementBalanceKobo.toString(), r.bookBalanceKobo.toString(), r.outstandingBookKobo.toString(), r.note, r.completedById);
    }

    async delete(id: string): Promise<void> {
        await this.db.$executeRawUnsafe(`DELETE FROM "BankReconciliation" WHERE id = $1`, id);
    }

    async list(accountId: string | null): Promise<ReconciliationEntity[]> {
        const rows = accountId
            ? await this.db.$queryRawUnsafe<any[]>(`${RECONCILIATION_SELECT} WHERE r."ledgerAccountId" = $1 ORDER BY p."endDate" DESC`, accountId)
            : await this.db.$queryRawUnsafe<any[]>(`${RECONCILIATION_SELECT} ORDER BY p."endDate" DESC`);
        return rows.map(reconciliationOf);
    }

    async lockedThrough(accountId: string): Promise<string | null> {
        const [r] = await this.db.$queryRawUnsafe<any[]>(
            `SELECT MAX(p."endDate") AS d FROM "BankReconciliation" r JOIN "FinancePeriod" p ON p.id = r."periodId" WHERE r."ledgerAccountId" = $1`, accountId);
        return r?.d ? day(r.d) : null;
    }

    async latest(accountId: string): Promise<ReconciliationEntity | null> {
        const [r] = await this.db.$queryRawUnsafe<any[]>(`${RECONCILIATION_SELECT} WHERE r."ledgerAccountId" = $1 ORDER BY p."endDate" DESC LIMIT 1`, accountId);
        return r ? reconciliationOf(r) : null;
    }

    async overview(): Promise<AccountOverview[]> {
        const rows = await this.db.$queryRawUnsafe<any[]>(
            `SELECT a.id, a.code, a.name, a.subtype, a."bankName", a."accountNumberLast4",
                    (SELECT COUNT(*) FROM "BankStatementLine" l WHERE l."ledgerAccountId" = a.id) AS "statementLines",
                    (SELECT COUNT(*) FROM "BankStatementLine" l WHERE l."ledgerAccountId" = a.id AND l."matchGroupId" IS NULL) AS "unmatchedBankLines",
                    (SELECT MAX(l."txnDate") FROM "BankStatementLine" l WHERE l."ledgerAccountId" = a.id) AS "lastLineDate",
                    (SELECT MAX(p."endDate") FROM "BankReconciliation" r JOIN "FinancePeriod" p ON p.id = r."periodId" WHERE r."ledgerAccountId" = a.id) AS "reconciledThrough"
               FROM "LedgerAccount" a
              WHERE a."isMoneyAccount" = true AND a."isActive" = true AND a."deletedAt" IS NULL AND a.subtype IN ('BANK', 'ONLINE_CLEARING')
              ORDER BY a.code`);
        return rows.map(r => ({
            accountId: r.id, code: r.code, name: r.name, subtype: r.subtype, bankName: r.bankName, accountNumberLast4: r.accountNumberLast4,
            statementLines: Number(r.statementLines), unmatchedBankLines: Number(r.unmatchedBankLines),
            lastLineDate: r.lastLineDate ? day(r.lastLineDate) : null, reconciledThrough: r.reconciledThrough ? day(r.reconciledThrough) : null,
        }));
    }
}

export const newId = (): string => randomUUID();
