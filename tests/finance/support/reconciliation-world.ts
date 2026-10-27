/*
| An in-memory bank reconciliation world over the REAL posting service. Statements, bank lines, match groups and sign-offs are small fakes that obey
| the same rules the database does (a line belongs to one group; a group claims all its lines or none). Book lines come straight from the posted journals.
*/
import { setup as booksSetup } from "../posting.test";
import { PostingService } from "../../../src/modules/ledger/services/posting.service";
import { dayString } from "../../../src/modules/ledger/domain/ledger.dates";
import { ReconciliationMapper } from "../../../src/modules/bank-reconciliation/mappers/reconciliation.mapper";
import { ImportStatementUseCase, DeleteStatementUseCase } from "../../../src/modules/bank-reconciliation/usecases/statement.usecases";
import {
    AutoMatchUseCase, CreateMatchUseCase, RemoveMatchUseCase, ClearBookLinesUseCase, CreateEntryFromBankLineUseCase, SuggestMatchesUseCase,
} from "../../../src/modules/bank-reconciliation/usecases/matching.usecases";
import { ReconciliationSummaryUseCase, CompleteReconciliationUseCase, ReopenReconciliationUseCase } from "../../../src/modules/bank-reconciliation/usecases/reconciliation.usecases";
import type { BankLineEntity, BankStatementEntity, BookLineEntity, MatchGroupEntity, ReconciliationEntity } from "../../../src/modules/bank-reconciliation/domain/reconciliation.entity";

export const NOW = new Date("2026-11-03T10:00:00Z");     // October is over, so it can be signed off
export const N = (n: number) => BigInt(n) * 100n;
export const code = (c: string) => (e: any) => e.code === c;
export const BANK = "a-bank";

export function reconciliationWorld() {
    const books = booksSetup();
    const acct = (id: string, over: any = {}) => ({ id, code: id, name: id, type: "ASSET", subtype: "GENERAL", systemKey: null as any, parentId: null, isMoneyAccount: false, isActive: true, isLocked: false, sortOrder: 0, deletedAt: null, bankName: null, accountNumberLast4: null, ...over });
    const accounts = [
        acct(BANK, { subtype: "BANK", isMoneyAccount: true, systemKey: "BANK_DEFAULT", bankName: "GTB", accountNumberLast4: "1234" }),
        acct("a-cash2", { subtype: "CASH", isMoneyAccount: true }),
        acct("a-charges", { type: "EXPENSE", systemKey: "BANK_CHARGES", isLocked: true }),
        acct("a-interest", { type: "INCOME" }), acct("a-locked", { type: "EXPENSE", isLocked: true }),
        acct("a-tuition", { type: "INCOME" }),
    ];
    // the books' own accounts (cash / receivable / tuition from posting.test) stay reachable too
    const findPostable = async (ids: string[], keys: string[]) => accounts.filter(a => a.isActive && (ids.includes(a.id) || (a.systemKey && keys.includes(a.systemKey))));
    books.deps.ledgerAccountRepository.findPostable = findPostable;
    const ledgerAccountRepository: any = {
        findById: async (id: string) => accounts.find(a => a.id === id) ?? null,
        findByIds: async (ids: string[]) => accounts.filter(a => ids.includes(a.id)),
        findPostable,
    };
    const posting = new PostingService(books.deps, { ...books.options, now: () => NOW });
    const audit: any[] = [];
    const auditService = { async log(p: any) { audit.push(p); } };

    const statements: BankStatementEntity[] = [];
    const bankLines: (BankLineEntity & { dedupeKey: string; fileHash?: string })[] = [];
    const hashes = new Map<string, string>();               // `${account}:${hash}` -> statement id
    const groups = new Map<string, MatchGroupEntity>();
    const clearedJournalLines = new Map<string, string>();  // journalLineId -> group id
    const recs: ReconciliationEntity[] = [];
    let stN = 0;

    const groupOfJournalLine = (id: string) => clearedJournalLines.get(id) ?? null;

    const bookLines = (accountId: string): BookLineEntity[] => books.journals.flatMap(j => j.lines.filter(l => l.accountId === accountId).map(l => ({
        id: l.id, ledgerAccountId: accountId, journalId: j.id, journalNumber: j.number, lineNumber: l.lineNumber,
        date: dayString(j.entryDate), description: j.description, memo: l.memo, sourceType: j.sourceType, journalStatus: j.status,
        reversalOfJournalId: j.reversalOfId, amountKobo: l.debitKobo - l.creditKobo, matchGroupId: groupOfJournalLine(l.id),
    }))).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.journalNumber < b.journalNumber ? -1 : 1));

    const page = <T>(rows: T[], p: number, l: number) => ({ rows: rows.slice((p - 1) * l, p * l), total: rows.length });
    const filt = (status: string, matched: boolean) => status === "all" || (status === "matched") === matched;

    const bankStatementRepository: any = {
        async existingDedupeKeys(a: string, keys: string[]) { return new Set(bankLines.filter(l => l.ledgerAccountId === a && keys.includes(l.dedupeKey)).map(l => l.dedupeKey)); },
        async findByFileHash(a: string, h: string) { const id = hashes.get(`${a}:${h}`); return id ? statements.find(s => s.id === id) ?? null : null; },
        async insert(s: any, lines: any[]) {
            if (hashes.has(`${s.ledgerAccountId}:${s.fileHash}`)) throw Object.assign(new Error("unique"), { code: "P2002" });
            hashes.set(`${s.ledgerAccountId}:${s.fileHash}`, s.id);
            statements.push({ id: s.id, ledgerAccountId: s.ledgerAccountId, fileName: s.fileName, startDate: s.startDate, endDate: s.endDate, openingBalanceKobo: s.openingBalanceKobo, closingBalanceKobo: s.closingBalanceKobo, lineCount: s.lineCount, importedById: s.importedById, importedAt: NOW });
            for (const l of lines) bankLines.push({ ...l, statementId: s.id, ledgerAccountId: s.ledgerAccountId, matchGroupId: null });
        },
        async findStatement(id: string) { return statements.find(s => s.id === id) ?? null; },
        async listStatements(a: string | null, p: number, l: number) { return page(statements.filter(s => !a || s.ledgerAccountId === a), p, l); },
        async matchedLineCount(id: string) { return bankLines.filter(l => l.statementId === id && l.matchGroupId).length; },
        async deleteStatement(id: string) {
            const i = statements.findIndex(s => s.id === id); if (i >= 0) statements.splice(i, 1);
            for (let k = bankLines.length - 1; k >= 0; k--) if (bankLines[k].statementId === id) bankLines.splice(k, 1);
            for (const [k, v] of hashes) if (v === id) hashes.delete(k);
        },
        async listLines(f: any) { return page(bankLines.filter(l => l.ledgerAccountId === f.accountId && filt(f.status, !!l.matchGroupId)), f.page, f.limit); },
        async findLines(ids: string[]) { return bankLines.filter(l => ids.includes(l.id)); },
        async unmatchedUpTo(a: string, day: string) { return bankLines.filter(l => l.ledgerAccountId === a && !l.matchGroupId && l.date <= day).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.lineNumber - y.lineNumber)); },
        async balancesUpTo(a: string, day: string) { return bankLines.filter(l => l.ledgerAccountId === a && l.date <= day).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.lineNumber - y.lineNumber)).map(l => ({ date: l.date, balanceKobo: l.balanceKobo })); },
    };
    const bookLineRepository: any = {
        async list(f: any) { return page(bookLines(f.accountId).filter(l => filt(f.status, !!l.matchGroupId)), f.page, f.limit); },
        async findByIds(ids: string[]) { return BANK && books.journals.length >= 0 ? bookLines(BANK).concat(bookLines("a-cash2")).filter(l => ids.includes(l.id)) : []; },
        async unmatchedUpTo(a: string, day: string) { return bookLines(a).filter(l => !l.matchGroupId && l.date <= day); },
        async balanceAsOf(a: string, day: string) { return bookLines(a).filter(l => l.date <= day).reduce((s, l) => s + l.amountKobo, 0n); },
    };
    const matchRepository: any = {
        async createGroup(g: any, bankIds: string[], jIds: string[]) {
            if (bankLines.some(l => bankIds.includes(l.id) && l.matchGroupId) || jIds.some(id => clearedJournalLines.has(id))) return false;
            groups.set(g.id, { ...g, createdAt: NOW, bankLineIds: bankIds, journalLineIds: jIds });
            for (const l of bankLines) if (bankIds.includes(l.id)) l.matchGroupId = g.id;
            for (const id of jIds) clearedJournalLines.set(id, g.id);
            return true;
        },
        async findGroup(id: string) { return groups.get(id) ?? null; },
        async deleteGroup(id: string) {
            groups.delete(id);
            for (const l of bankLines) if (l.matchGroupId === id) l.matchGroupId = null;
            for (const [k, v] of clearedJournalLines) if (v === id) clearedJournalLines.delete(k);
        },
    };
    const reconciliationRepository: any = {
        async find(a: string, p: string) { return recs.find(r => r.ledgerAccountId === a && r.periodId === p) ?? null; },
        async findById(id: string) { return recs.find(r => r.id === id) ?? null; },
        async create(r: any) {
            if (recs.some(x => x.ledgerAccountId === r.ledgerAccountId && x.periodId === r.periodId)) throw Object.assign(new Error("unique"), { code: "P2002" });
            const p = books.periods.find((x: any) => x.id === r.periodId);
            recs.push({ ...r, periodName: p.name, periodEnd: dayString(p.endDate), completedAt: NOW });
        },
        async delete(id: string) { const i = recs.findIndex(r => r.id === id); if (i >= 0) recs.splice(i, 1); },
        async list(a: string | null) { return recs.filter(r => !a || r.ledgerAccountId === a); },
        async lockedThrough(a: string) { const e = recs.filter(r => r.ledgerAccountId === a).map(r => r.periodEnd).sort(); return e.length ? e[e.length - 1] : null; },
        async latest(a: string) { return recs.filter(r => r.ledgerAccountId === a).sort((x, y) => (x.periodEnd < y.periodEnd ? -1 : 1)).pop() ?? null; },
        async overview() { return []; },
    };
    books.deps.financePeriodRepository.findById = async (id: string) => books.periods.find((p: any) => p.id === id) ?? null;

    const d: any = {
        bankStatementRepository, bookLineRepository, matchRepository, reconciliationRepository, ledgerAccountRepository, financePeriodRepository: books.deps.financePeriodRepository,
        postingService: posting, reconciliationMapper: new ReconciliationMapper(), auditService,
    };
    const o = { now: () => NOW, transaction: books.options.transaction };

    const world = {
        d, books, accounts, statements, bankLines, groups, recs, audit,
        importer: new ImportStatementUseCase(d, o), deleter: new DeleteStatementUseCase(d, o), suggest: new SuggestMatchesUseCase(d),
        autoMatch: new AutoMatchUseCase(d, o), match: new CreateMatchUseCase(d, o), unmatch: new RemoveMatchUseCase(d, o), clear: new ClearBookLinesUseCase(d, o),
        createEntry: new CreateEntryFromBankLineUseCase(d, o), summary: new ReconciliationSummaryUseCase(d), complete: new CompleteReconciliationUseCase(d, o), reopen: new ReopenReconciliationUseCase(d, o),

        /** the books record money in (+) or out (-) at the bank */
        async book(amountKobo: bigint, date: string, id: string, description = "Book entry") {
            const other = { accountId: "a-tuition" };
            const lines = amountKobo > 0n
                ? [{ accountId: BANK, debitKobo: amountKobo }, { ...other, creditKobo: amountKobo }]
                : [{ accountId: BANK, creditKobo: -amountKobo }, { ...other, debitKobo: -amountKobo }];
            return posting.post({ entryDate: date, description, sourceType: "MANUAL", sourceId: id, purpose: "TEST", lines, actorUserId: "u1" });
        },
        /** import lines as the frontend would send them */
        importLines(lines: { date: string; description: string; amountKobo: bigint; reference?: string; balanceKobo?: bigint }[], over: any = {}) {
            return world.importer.execute("school-1", "u1", { ledgerAccountId: BANK, lines, ...over } as any);
        },
        period: (name: string) => books.periods.find((p: any) => p.name === name).id as string,
    };
    return world;
}
