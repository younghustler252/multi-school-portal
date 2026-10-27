import { randomUUID } from "crypto";
import { IBankStatementRepository, IBookLineRepository, IMatchRepository, IReconciliationRepository } from "../repositories/bank-reconciliation.repositories";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { PostingService } from "../../ledger/services/posting.service";
import { ReconciliationMapper } from "../mappers/reconciliation.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { BankLineEntity, BookLineEntity } from "../domain/reconciliation.entity";
import { BankFacts, BookFacts, checkMatchGroup, dropReversalPairs, suggestMatches } from "../domain/matching";
import { reconciliationErrors } from "../domain/reconciliation.errors";
import { FinanceSettingsReader, settingsOf } from "../../finance-settings/domain/finance-settings";
import { ledgerErrors } from "../../ledger/domain/ledger.errors";
import { AppError } from "../../../shared/errors/domain.errors";
import { todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { koboOut } from "../../ledger/mappers/kobo";
import {
    AutoMatchDtoType, BankLinesQueryType, BookLinesQueryType, ClearBookLinesDtoType, CreateEntryDtoType, MatchDtoType,
} from "../dtos/bank-reconciliation.dto";
import { FAR_FUTURE, ReconciliationOptions, assertUnlocked, defaultTransaction, loadBankAccount } from "./reconciliation-shared";

interface Dependencies {
    bankStatementRepository: IBankStatementRepository; bookLineRepository: IBookLineRepository; matchRepository: IMatchRepository;
    reconciliationRepository: IReconciliationRepository; ledgerAccountRepository: ILedgerAccountRepository; postingService: PostingService;
    reconciliationMapper: ReconciliationMapper; auditService: AuditService;
    financeSettingsService?: FinanceSettingsReader;      // finance.reconciliation_tolerance_days; absent in hand-built tests (default: 3)
}

const bankFacts = (l: BankLineEntity): BankFacts => ({ id: l.id, date: l.date, amountKobo: l.amountKobo, description: l.description, reference: l.reference });
const bookFacts = (l: BookLineEntity): BookFacts => ({ id: l.id, date: l.date, amountKobo: l.amountKobo, text: `${l.description} ${l.memo ?? ""} ${l.journalNumber}` });

/* What still needs a partner on each side up to a day, and the best pairings between them. Shared by "suggest" and "auto match". */
export async function computeSuggestions(d: Dependencies, accountId: string, asOf: string) {
    const toleranceDays = (await settingsOf(d)).reconciliationToleranceDays;
    const bank = await d.bankStatementRepository.unmatchedUpTo(accountId, asOf);
    const book = dropReversalPairs(await d.bookLineRepository.unmatchedUpTo(accountId, asOf));
    return { bank, book, toleranceDays, suggestions: suggestMatches(bank.map(bankFacts), book.map(bookFacts), toleranceDays) };
}

/* ---------- reading ---------- */

export class ListBankLinesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(q: BankLinesQueryType) {
        await loadBankAccount(this.d.ledgerAccountRepository, q.accountId);
        const r = await this.d.bankStatementRepository.listLines({ accountId: q.accountId, status: q.status, from: q.from, to: q.to, statementId: q.statementId, page: q.page, limit: q.limit });
        return { data: r.rows.map(l => this.d.reconciliationMapper.bankLine(l)), meta: { page: q.page, limit: q.limit, total: r.total } };
    }
}

/* The bank account's journal lines. "unmatched" leaves out a reversed entry together with its reversal (they cancel). */
export class ListBookLinesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(q: BookLinesQueryType) {
        const d = this.d;
        await loadBankAccount(d.ledgerAccountRepository, q.accountId);
        if (q.status !== "unmatched") {
            const r = await d.bookLineRepository.list({ accountId: q.accountId, status: q.status, from: q.from, to: q.to, page: q.page, limit: q.limit });
            return { data: r.rows.map(l => d.reconciliationMapper.bookLine(l)), meta: { page: q.page, limit: q.limit, total: r.total } };
        }
        const all = dropReversalPairs(await d.bookLineRepository.unmatchedUpTo(q.accountId, q.to ?? FAR_FUTURE)).filter(l => !q.from || l.date >= q.from);
        const start = (q.page - 1) * q.limit;
        return { data: all.slice(start, start + q.limit).map(l => d.reconciliationMapper.bookLine(l)), meta: { page: q.page, limit: q.limit, total: all.length } };
    }
}

export class SuggestMatchesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(accountId: string, asOf?: string) {
        const d = this.d;
        await loadBankAccount(d.ledgerAccountRepository, accountId);
        const { bank, book, toleranceDays, suggestions } = await computeSuggestions(d, accountId, asOf ?? FAR_FUTURE);
        const bankById = new Map(bank.map(l => [l.id, l])), bookById = new Map(book.map(l => [l.id, l]));
        return {
            toleranceDays, unmatchedBankLines: bank.length, unmatchedBookLines: book.length,
            suggestions: suggestions.map(s => ({
                score: s.score, reason: s.reason, ambiguous: s.ambiguous,
                bankLine: d.reconciliationMapper.bankLine(bankById.get(s.bankLineId)!),
                bookLines: s.journalLineIds.map(id => d.reconciliationMapper.bookLine(bookById.get(id)!)),
            })),
        };
    }
}

/* ---------- pairing ---------- */

/* AUTO MATCH: applies every unambiguous suggestion. Ambiguous ones (two equally good candidates) are left for a person. Locked months are skipped. */
export class AutoMatchUseCase {
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: ReconciliationOptions = {}) { this.transaction = options.transaction ?? defaultTransaction; }

    async execute(schoolId: string, actorUserId: string, dto: AutoMatchDtoType) {
        const d = this.d;
        await loadBankAccount(d.ledgerAccountRepository, dto.ledgerAccountId);
        const locked = await d.reconciliationRepository.lockedThrough(dto.ledgerAccountId);
        const { bank, book, suggestions } = await computeSuggestions(d, dto.ledgerAccountId, dto.asOf ?? FAR_FUTURE);
        const bankById = new Map(bank.map(l => [l.id, l])), bookById = new Map(book.map(l => [l.id, l]));

        let matched = 0, ambiguous = 0, skipped = 0;
        for (const s of suggestions) {
            if (s.ambiguous) { ambiguous++; continue; }
            const dates = [bankById.get(s.bankLineId)!.date, ...s.journalLineIds.map(id => bookById.get(id)!.date)];
            if (locked && dates.some(x => x <= locked)) { skipped++; continue; }
            try {
                await this.transaction(async () => {
                    const ok = await d.matchRepository.createGroup({ id: randomUUID(), ledgerAccountId: dto.ledgerAccountId, kind: "AUTO", note: null, createdById: actorUserId }, [s.bankLineId], s.journalLineIds);
                    if (!ok) throw reconciliationErrors.matchTaken();       // rolls this pairing back; the others carry on
                });
                matched++;
            } catch (e) {
                if (e instanceof AppError && e.code === "MATCH_CHANGED") skipped++; else throw e;
            }
        }
        if (matched > 0) {
            await d.auditService.log({
                userId: actorUserId, schoolId, action: "finance.bank_reconciliation.auto_matched", entity: "LedgerAccount", entityId: dto.ledgerAccountId,
                newValue: { matched, ambiguousLeftForReview: ambiguous, skipped },
            });
        }
        return { matched, ambiguousLeftForReview: ambiguous, skipped, stillUnmatchedBankLines: bank.length - matched };
    }
}

async function loadSides(d: Dependencies, accountId: string, bankLineIds: string[], journalLineIds: string[]) {
    const bank = await d.bankStatementRepository.findLines(bankLineIds);
    if (bank.length !== new Set(bankLineIds).size) throw reconciliationErrors.lineNotFound();
    const book = await d.bookLineRepository.findByIds(journalLineIds);
    if (book.length !== new Set(journalLineIds).size) throw reconciliationErrors.bookLineNotFound();
    if (bank.some(l => l.ledgerAccountId !== accountId) || book.some(l => l.ledgerAccountId !== accountId)) throw reconciliationErrors.lineWrongAccount();
    const takenBank = bank.find(l => l.matchGroupId); if (takenBank) throw reconciliationErrors.bankLineMatched(takenBank.id);
    const takenBook = book.find(l => l.matchGroupId); if (takenBook) throw reconciliationErrors.bookLineMatched(takenBook.id);
    return { bank, book };
}

/* MATCH by hand: one or several bank lines against one or several book entries that add up to the same amount. */
export class CreateMatchUseCase {
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: ReconciliationOptions = {}) { this.transaction = options.transaction ?? defaultTransaction; }

    async execute(schoolId: string, actorUserId: string, dto: MatchDtoType) {
        const d = this.d;
        await loadBankAccount(d.ledgerAccountRepository, dto.ledgerAccountId);
        const { bank, book } = await loadSides(d, dto.ledgerAccountId, dto.bankLineIds, dto.journalLineIds);
        await assertUnlocked(d.reconciliationRepository, dto.ledgerAccountId, [...bank.map(l => l.date), ...book.map(l => l.date)]);

        const check = checkMatchGroup(bank.map(l => l.amountKobo), book.map(l => l.amountKobo));
        if (!check.ok) throw check.reason === "NEEDS_BOTH_SIDES" ? reconciliationErrors.matchNeedsBothSides() : reconciliationErrors.matchTotalsDiffer(check.bankTotalKobo, check.bookTotalKobo);

        const id = randomUUID();
        await this.transaction(async () => {
            if (!(await d.matchRepository.createGroup({ id, ledgerAccountId: dto.ledgerAccountId, kind: "MANUAL", note: dto.note ?? null, createdById: actorUserId }, bank.map(l => l.id), book.map(l => l.id)))) {
                throw reconciliationErrors.matchTaken();
            }
        });
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "finance.bank_reconciliation.matched", entity: "BankMatchGroup", entityId: id,
            newValue: { bankLines: bank.length, bookLines: book.length, amountKobo: bank.reduce((s, l) => s + l.amountKobo, 0n).toString(), note: dto.note ?? null },
        });
        return d.reconciliationMapper.group((await d.matchRepository.findGroup(id))!);
    }
}

/* UNDO a pairing (also a recorded entry or a cleared item): both sides become unmatched again. Not allowed inside a signed-off month. */
export class RemoveMatchUseCase {
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: ReconciliationOptions = {}) { this.transaction = options.transaction ?? defaultTransaction; }

    async execute(id: string, schoolId: string, actorUserId: string) {
        const d = this.d;
        const g = await d.matchRepository.findGroup(id);
        if (!g) throw reconciliationErrors.matchNotFound();
        const bank = await d.bankStatementRepository.findLines(g.bankLineIds);
        const book = await d.bookLineRepository.findByIds(g.journalLineIds);
        await assertUnlocked(d.reconciliationRepository, g.ledgerAccountId, [...bank.map(l => l.date), ...book.map(l => l.date)]);

        await this.transaction(() => d.matchRepository.deleteGroup(id));
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "finance.bank_reconciliation.unmatched", entity: "BankMatchGroup", entityId: id,
            oldValue: { kind: g.kind, bankLines: g.bankLineIds.length, bookLines: g.journalLineIds.length, note: g.note },
        });
        return { removed: true };
    }
}

/*
| CLEAR book entries that have no bank line, with a written reason. The usual case is the opening balance: money the account held
| before the first statement starts. It stops those entries showing as "not yet at the bank" for ever.
| Sensitive: a cleared entry is taken out of the comparison, so the reason is kept in the audit trail.
*/
export class ClearBookLinesUseCase {
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: ReconciliationOptions = {}) { this.transaction = options.transaction ?? defaultTransaction; }

    async execute(schoolId: string, actorUserId: string, dto: ClearBookLinesDtoType) {
        const d = this.d;
        const reason = dto.reason.trim();
        if (!reason) throw reconciliationErrors.reasonRequired();
        await loadBankAccount(d.ledgerAccountRepository, dto.ledgerAccountId);
        const { book } = await loadSides(d, dto.ledgerAccountId, [], dto.journalLineIds);
        await assertUnlocked(d.reconciliationRepository, dto.ledgerAccountId, book.map(l => l.date));

        const id = randomUUID();
        await this.transaction(async () => {
            if (!(await d.matchRepository.createGroup({ id, ledgerAccountId: dto.ledgerAccountId, kind: "CLEARED", note: reason, createdById: actorUserId }, [], book.map(l => l.id)))) {
                throw reconciliationErrors.matchTaken();
            }
        });
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "finance.bank_reconciliation.cleared", entity: "BankMatchGroup", entityId: id,
            newValue: { reason, entries: book.map(l => ({ journal: l.journalNumber, amountKobo: l.amountKobo.toString(), date: l.date })) },
        });
        return d.reconciliationMapper.group((await d.matchRepository.findGroup(id))!);
    }
}

/*
| RECORD what the bank did that the books missed (a service charge, interest, a stamp duty): one click makes the journal and matches it.
|   money out of the bank: debit the account you choose (Bank charges), credit the bank
|   money into the bank:  debit the bank, credit the account you choose (an income account)
| The journal is dated the day the bank printed. It goes through the posting service, so a closed month or a locked account is refused,
| and the same bank line can never be posted twice (the idempotency key is built from the bank line).
*/
export class CreateEntryFromBankLineUseCase {
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: ReconciliationOptions = {}) {
        this.transaction = options.transaction ?? defaultTransaction;
        this.now = options.now ?? (() => new Date());
    }

    async execute(lineId: string, schoolId: string, actorUserId: string, dto: CreateEntryDtoType) {
        const d = this.d;
        const [line] = await d.bankStatementRepository.findLines([lineId]);
        if (!line) throw reconciliationErrors.lineNotFound();
        if (line.matchGroupId) throw reconciliationErrors.bankLineMatched(line.id);
        const bankAccount = await loadBankAccount(d.ledgerAccountRepository, line.ledgerAccountId);
        await assertUnlocked(d.reconciliationRepository, bankAccount.id, [line.date]);

        const counter = (await d.ledgerAccountRepository.findByIds([dto.counterAccountId]))[0];
        if (!counter || !counter.isActive) throw ledgerErrors.accountNotFound(dto.counterAccountId);
        if (counter.id === bankAccount.id) throw ledgerErrors.sameAccount();
        if (counter.isMoneyAccount) throw reconciliationErrors.entryAccountInvalid(`${counter.name} is a money account. Record money moving between your own accounts as a transfer`);
        if (counter.isLocked && counter.systemKey !== "BANK_CHARGES") throw ledgerErrors.accountLocked(counter.name);

        const amount = line.amountKobo < 0n ? -line.amountKobo : line.amountKobo;
        const description = (dto.description ?? `Bank: ${line.description}`).trim().slice(0, 200);
        const bankSide = line.amountKobo > 0n ? { debitKobo: amount } : { creditKobo: amount };
        const counterSide = line.amountKobo > 0n ? { creditKobo: amount } : { debitKobo: amount };
        const today = todayInFinanceZone(this.now());

        const groupId = randomUUID();
        const journal = await this.transaction(async () => {
            const posted = await d.postingService.post({
                entryDate: line.date > today ? today : line.date, description, sourceType: "MANUAL", sourceId: line.id, purpose: "BANK_LINE",
                lines: [{ accountId: bankAccount.id, ...bankSide }, { accountId: counter.id, ...counterSide }], actorUserId,
            });
            const bankJournalLine = posted.journal.lines.find(l => l.accountId === bankAccount.id);
            if (!bankJournalLine) throw reconciliationErrors.entryAccountInvalid("The journal has no line on the bank account");
            const [taken] = await d.bookLineRepository.findByIds([bankJournalLine.id]);
            if (taken?.matchGroupId) throw reconciliationErrors.bookLineMatched(bankJournalLine.id);   // an earlier attempt's journal is already paired elsewhere
            if (!(await d.matchRepository.createGroup({ id: groupId, ledgerAccountId: bankAccount.id, kind: "CREATED", note: description, createdById: actorUserId }, [line.id], [bankJournalLine.id]))) {
                throw reconciliationErrors.matchTaken();
            }
            return posted.journal;
        });

        await d.auditService.log({
            userId: actorUserId, schoolId, action: "finance.bank_reconciliation.entry_created", entity: "JournalEntry", entityId: journal.id,
            newValue: { bankLineId: line.id, account: counter.name, amountKobo: line.amountKobo.toString(), journalNumber: journal.number },
        });
        return {
            journalId: journal.id, journalNumber: journal.number, amountKobo: koboOut(line.amountKobo),
            group: d.reconciliationMapper.group((await d.matchRepository.findGroup(groupId))!),
        };
    }
}
