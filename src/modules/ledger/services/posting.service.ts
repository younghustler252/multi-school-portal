import { randomUUID } from "crypto";
import type { SystemAccountKey } from "../domain/ledger.constants";
import { ledgerErrors } from "../domain/ledger.errors";
import { parseDay, todayInFinanceZone, monthContaining } from "../domain/ledger.dates";
import { JournalEntity, JournalSource, PartyType } from "../domain/ledger.entity";
import type { IJournalRepository } from "../repositories/journal.repository";
import type { IFinancePeriodRepository } from "../repositories/finance-period.repository";
import type { ILedgerAccountRepository } from "../repositories/ledger-account.repository";
import { RequestContext } from "../../../shared/context/request-context";

/*
|--------------------------------------------------------------------------
| POSTING SERVICE (the only code that writes journals; brief section 7 and invariants 2 to 5)
|
|   post(input)     one balanced journal, saved with its lines in ONE transaction. Refuses:
|                   unbalanced or malformed lines, future dates, closed periods, unknown or inactive accounts.
|                   The same event never posts twice: the idempotency key is "sourceType:sourceId:purpose".
|                   A repeat returns the journal already saved ({ duplicate: true }), so webhook retries,
|                   double clicks and job reruns are harmless.
|   reverse(id)     a new journal with debit and credit swapped, linked to the original, which becomes REVERSED.
|
| Other modules (fees, payments, expenses, payroll) call these INSIDE their own transaction (withTenantTransaction
| joins an open one), so the payment and its journal are saved together or not at all. Nothing here sends email or
| calls the network. Audit entries are written by whoever starts the action (manual journal, reversal use cases),
| because they know the school and the reason. The database enforces balance and immutability as well
| (migration 20261019061500_finance_books).
|--------------------------------------------------------------------------
*/

/** One side of a journal. Name the account by id, or by system key (the posting rules use keys). Exactly one amount. */
export interface PostLine {
    accountId?:  string;
    systemKey?:  SystemAccountKey;
    debitKobo?:  bigint;
    creditKobo?: bigint;
    partyType?:  PartyType;
    partyId?:    string;
}

export interface PostInput {
    entryDate:    string;                 // "YYYY-MM-DD"
    description:  string;
    sourceType:   JournalSource;
    sourceId:     string;                 // the invoice, payment, ... this journal belongs to
    purpose:      string;                 // what this journal does for that source, e.g. "ISSUE", "CONFIRM"
    lines:        PostLine[];
    termId?:      string | null;
    sessionId?:   string | null;
    branchId?:    string | null;
    actorUserId?: string | null;          // omitted: taken from the request; none at all means a system actor
}

export interface PostResult { journal: JournalEntity; duplicate: boolean }

interface Dependencies {
    journalRepository:       IJournalRepository;
    financePeriodRepository: IFinancePeriodRepository;
    ledgerAccountRepository: ILedgerAccountRepository;
    numberSequenceService:   { next(key: string, period?: string): Promise<number> };
}

// Replaced in tests only (container injection passes just the first argument)
export interface PostingOptions {
    now?:           () => Date;
    transaction?:   <T>(fn: () => Promise<T>) => Promise<T>;
    currentUserId?: () => string | undefined;
}

const isUniqueViolation = (e: unknown): boolean => (e as { code?: string })?.code === "P2002";

// Loaded on first use so that importing this file never needs a database connection
const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

export class PostingService {
    private readonly now:           () => Date;
    private readonly transaction:   <T>(fn: () => Promise<T>) => Promise<T>;
    private readonly currentUserId: () => string | undefined;

    constructor(private readonly d: Dependencies, options: PostingOptions = {}) {
        this.now           = options.now ?? (() => new Date());
        this.transaction   = options.transaction ?? defaultTransaction;
        this.currentUserId = options.currentUserId ?? (() => RequestContext.get()?.userId);
    }

    /* ── post ─────────────────────────────────────────────────────────── */
    async post(input: PostInput): Promise<PostResult> {
        const lines = this.validateLines(input.lines);
        if (!input.sourceId?.trim())    throw ledgerErrors.invalidJournal("A journal needs the id of the record it belongs to");
        if (!input.purpose?.trim())     throw ledgerErrors.invalidJournal("A journal needs a purpose");
        if (!input.description?.trim()) throw ledgerErrors.invalidJournal("A journal needs a description");

        const date  = parseDay(input.entryDate);
        const today = todayInFinanceZone(this.now());
        if (input.entryDate > today) throw ledgerErrors.futureDate(input.entryDate, today);

        const idempotencyKey = `${input.sourceType}:${input.sourceId}:${input.purpose}`;

        return this.transaction(async () => {
            const existing = await this.d.journalRepository.findByIdempotencyKey(idempotencyKey);
            if (existing) return { journal: existing, duplicate: true };

            const period   = await this.openPeriodFor(input.entryDate, date);
            const accounts = await this.resolveAccounts(lines);
            const total    = lines.reduce((sum, l) => sum + l.debit, 0n);
            const number   = await this.nextNumber(input.entryDate.slice(0, 4));
            const actor    = input.actorUserId ?? this.currentUserId() ?? null;

            try {
                const journal = await this.d.journalRepository.saveWithLines({
                    id: randomUUID(), number, entryDate: date, periodId: period.id,
                    termId: input.termId ?? null, sessionId: input.sessionId ?? null, branchId: input.branchId ?? null,
                    description: input.description.trim(), sourceType: input.sourceType, sourceId: input.sourceId,
                    purpose: input.purpose, idempotencyKey, totalKobo: total, createdById: actor, isSystemActor: !actor,
                    lines: lines.map((l, i) => ({
                        lineNumber: i + 1, ledgerAccountId: accounts.get(l.ref)!, debitKobo: l.debit, creditKobo: l.credit,
                        partyType: l.partyType ?? null, partyId: l.partyId ?? null,
                    })),
                });
                return { journal, duplicate: false };
            } catch (e) {
                if (isUniqueViolation(e)) throw ledgerErrors.duplicatePosting(idempotencyKey);   // two requests raced; the loser stops
                throw e;
            }
        });
    }

    /* ── reverse ──────────────────────────────────────────────────────── */
    async reverse(journalId: string, opts: { reason: string; entryDate?: string; actorUserId?: string | null }): Promise<PostResult & { original: JournalEntity }> {
        const reason = opts.reason?.trim();
        if (!reason) throw ledgerErrors.reasonRequired();

        const today    = todayInFinanceZone(this.now());
        const entryDay = opts.entryDate ?? today;
        const date     = parseDay(entryDay);
        if (entryDay > today) throw ledgerErrors.futureDate(entryDay, today);

        return this.transaction(async () => {
            const original = await this.d.journalRepository.findDetail(journalId);
            if (!original) throw ledgerErrors.journalNotFound();
            if (original.status === "REVERSED")    throw ledgerErrors.alreadyReversed(original.number);
            if (original.sourceType === "REVERSAL") throw ledgerErrors.cannotReverseReversal(original.number);

            const period = await this.openPeriodFor(entryDay, date);
            const number = await this.nextNumber(entryDay.slice(0, 4));
            const actor  = opts.actorUserId ?? this.currentUserId() ?? null;

            let reversal: JournalEntity;
            try {
                reversal = await this.d.journalRepository.saveWithLines({
                    id: randomUUID(), number, entryDate: date, periodId: period.id,
                    termId: original.termId, sessionId: original.sessionId, branchId: original.branchId,
                    description: `Reversal of ${original.number}: ${reason}`, sourceType: "REVERSAL", sourceId: original.id,
                    purpose: "REVERSE", idempotencyKey: `REVERSAL:${original.id}:REVERSE`,
                    reversalOfId: original.id, reversalReason: reason,
                    totalKobo: original.totalKobo, createdById: actor, isSystemActor: !actor,
                    lines: [...original.lines].sort((a, b) => a.lineNumber - b.lineNumber).map((l, i) => ({
                        lineNumber: i + 1, ledgerAccountId: l.accountId,
                        debitKobo: l.creditKobo, creditKobo: l.debitKobo,                // swapped
                        partyType: l.partyType, partyId: l.partyId,
                    })),
                });
            } catch (e) {
                if (isUniqueViolation(e)) throw ledgerErrors.alreadyReversed(original.number);
                throw e;
            }
            await this.d.journalRepository.markReversed(original.id);
            return { journal: reversal, duplicate: false, original };
        });
    }

    /* ── internals ────────────────────────────────────────────────────── */

    // Each line: exactly one side, a positive whole number of kobo, an account reference. Totals must match.
    private validateLines(lines: PostLine[]) {
        if (!Array.isArray(lines) || lines.length < 2) throw ledgerErrors.invalidJournal("A journal needs at least two lines");
        let debits = 0n, credits = 0n;
        const out = lines.map((l, i) => {
            const debit = l.debitKobo ?? 0n, credit = l.creditKobo ?? 0n;
            if (typeof debit !== "bigint" || typeof credit !== "bigint") throw ledgerErrors.invalidJournal(`Line ${i + 1}: amounts must be whole kobo (BigInt)`);
            if (debit < 0n || credit < 0n) throw ledgerErrors.invalidJournal(`Line ${i + 1}: amounts cannot be negative`);
            if ((debit > 0n) === (credit > 0n)) throw ledgerErrors.invalidJournal(`Line ${i + 1}: use either a debit or a credit, not both and not neither`);
            if (Boolean(l.accountId) === Boolean(l.systemKey)) throw ledgerErrors.invalidJournal(`Line ${i + 1}: name the account by id or by system key, not both and not neither`);
            if (Boolean(l.partyType) !== Boolean(l.partyId)) throw ledgerErrors.invalidJournal(`Line ${i + 1}: party type and party id go together`);
            debits += debit; credits += credit;
            return { ref: (l.accountId ?? l.systemKey)!, byKey: !l.accountId, debit, credit, partyType: l.partyType, partyId: l.partyId };
        });
        if (debits !== credits) throw ledgerErrors.journalUnbalanced(debits, credits);
        return out;
    }

    // The open month containing the date. A month that does not exist yet (a new year) is created on demand.
    private async openPeriodFor(day: string, date: Date) {
        let period = await this.d.financePeriodRepository.findContaining(date);
        if (!period) {
            await this.d.financePeriodRepository.createMonthIfMissing(monthContaining(day));
            period = await this.d.financePeriodRepository.findContaining(date);
        }
        if (!period) throw ledgerErrors.invalidJournal("Could not find or create the accounting period for this date");
        if (period.status !== "OPEN") throw ledgerErrors.periodClosed(period.name, day);
        return period;
    }

    private async resolveAccounts(lines: Array<{ ref: string; byKey: boolean }>): Promise<Map<string, string>> {
        const ids  = [...new Set(lines.filter(l => !l.byKey).map(l => l.ref))];
        const keys = [...new Set(lines.filter(l => l.byKey).map(l => l.ref))];
        const found = await this.d.ledgerAccountRepository.findPostable(ids, keys);
        const map = new Map<string, string>();
        for (const a of found) { map.set(a.id, a.id); if (a.systemKey) map.set(a.systemKey, a.id); }
        for (const l of lines) if (!map.has(l.ref)) throw ledgerErrors.accountNotFound(l.ref);
        return map;
    }

    // JE-2026-000001: the counter restarts each year (by the date of the entry)
    private async nextNumber(year: string): Promise<string> {
        const n = await this.d.numberSequenceService.next("journal", year);
        return `JE-${year}-${String(n).padStart(6, "0")}`;
    }
}
