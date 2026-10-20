import { randomUUID } from "crypto";
import { FINANCE_TIMEZONE, type SystemAccountKey } from "./ledger.constants";
import { ledgerErrors } from "./ledger.errors";
import { monthlyPeriods } from "./ledger.provisioning";

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
| Business code calls these INSIDE its own transaction (withTenantTransaction joins an open one), so the payment
| and its journal are saved together or not at all. Nothing here sends email or calls the network.
| The database enforces balance and immutability on its own too (migration 20261019061500_finance_books).
|--------------------------------------------------------------------------
*/

export type JournalSource =
    | "FEE_INVOICE" | "PAYMENT" | "REFUND" | "ADJUSTMENT" | "EXPENSE_BILL" | "EXPENSE_PAYMENT"
    | "PAYROLL_ACCRUAL" | "PAYROLL_PAYMENT" | "PAYROLL_REMITTANCE" | "TRANSFER" | "OPENING_BALANCE" | "MANUAL" | "REVERSAL";

export type PartyType = "STUDENT" | "GUARDIAN" | "VENDOR" | "STAFF";

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
    entryDate:   string;              // "YYYY-MM-DD"
    description: string;
    sourceType:  JournalSource;
    sourceId:    string;              // the invoice, payment, ... this journal belongs to
    purpose:     string;              // what this journal does for that source, e.g. "ISSUE", "CONFIRM"
    lines:       PostLine[];
    termId?:     string | null;
    sessionId?:  string | null;
    branchId?:   string | null;
    actorUserId?: string | null;      // omitted: taken from the request; none at all means a system actor
}

export interface PostedJournal {
    id: string; number: string; entryDate: Date; status: string; totalKobo: bigint; idempotencyKey: string;
    periodId: string; reversalOfId: string | null;
}
export interface PostResult { journal: PostedJournal; duplicate: boolean }

/* ── what the service needs from the database (the tenant Prisma client satisfies this; tests use a fake) ── */
type Where = Record<string, unknown>;
export interface PostingDb {
    journalEntry: {
        findUnique(args: { where: Where; include?: { lines: true } }): Promise<any | null>;
        create(args: { data: Record<string, unknown> }): Promise<PostedJournal>;
        update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    };
    financePeriod: {
        findFirst(args: { where: Where }): Promise<{ id: string; name: string; status: string } | null>;
        createMany(args: { data: Record<string, unknown>[]; skipDuplicates: true }): Promise<unknown>;
    };
    ledgerAccount: { findMany(args: { where: Where }): Promise<Array<{ id: string; systemKey: string | null }>> };
    numberSequence: unknown;
}

export interface PostingDeps {
    db:     () => PostingDb;                                   // the current tenant client (or the open transaction)
    tx:     <T>(fn: () => Promise<T>) => Promise<T>;           // withTenantTransaction (joins an open one)
    numberSequenceService: { next(key: string, period?: string, client?: any): Promise<number> };
    auditService?: { log(p: { userId?: string; action: string; entity: string; entityId?: string | null; newValue?: unknown; metadata?: unknown }): Promise<void> };
    now?:   () => Date;
    currentUserId?: () => string | undefined;
}

/* ── small date helpers (all dates are plain calendar days, never moments in time) ─────────────────────── */
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
export function parseDay(value: string): Date {
    const m = DAY.exec(value);
    if (!m) throw ledgerErrors.invalidDate(value);
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) throw ledgerErrors.invalidDate(value);
    return d;
}
export const dayString = (d: Date): string => d.toISOString().slice(0, 10);

/** Today's calendar day in the finance time zone, as YYYY-MM-DD. */
export function todayInFinanceZone(now: Date): string {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: FINANCE_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    return p;   // en-CA formats as YYYY-MM-DD
}

const isUniqueViolation = (e: unknown): boolean => (e as { code?: string })?.code === "P2002";

export class PostingService {
    constructor(private readonly deps: PostingDeps) {}

    private db(): PostingDb { return this.deps.db(); }
    private run<T>(fn: () => Promise<T>): Promise<T> { return this.deps.tx(fn); }
    private now(): Date { return (this.deps.now ?? (() => new Date()))(); }

    /* ── post ─────────────────────────────────────────────────────────── */
    async post(input: PostInput): Promise<PostResult> {
        const lines = this.validateLines(input.lines);
        if (!input.sourceId?.trim()) throw ledgerErrors.invalidJournal("A journal needs the id of the record it belongs to");
        if (!input.purpose?.trim())  throw ledgerErrors.invalidJournal("A journal needs a purpose");
        if (!input.description?.trim()) throw ledgerErrors.invalidJournal("A journal needs a description");

        const date  = parseDay(input.entryDate);
        const today = todayInFinanceZone(this.now());
        if (input.entryDate > today) throw ledgerErrors.futureDate(input.entryDate, today);

        const idempotencyKey = `${input.sourceType}:${input.sourceId}:${input.purpose}`;

        return this.run(async () => {
            const db = this.db();

            const existing = await db.journalEntry.findUnique({ where: { idempotencyKey } });
            if (existing) return { journal: existing as PostedJournal, duplicate: true };

            const period = await this.openPeriodFor(db, input.entryDate, date);
            const accounts = await this.resolveAccounts(db, lines);
            const total = lines.reduce((sum, l) => sum + l.debit, 0n);
            const number = await this.nextNumber(db, input.entryDate.slice(0, 4));

            const actor = input.actorUserId ?? this.deps.currentUserId?.() ?? null;
            let journal: PostedJournal;
            try {
                journal = await db.journalEntry.create({
                    data: {
                        id: randomUUID(), number, entryDate: date, periodId: period.id,
                        termId: input.termId ?? null, sessionId: input.sessionId ?? null, branchId: input.branchId ?? null,
                        description: input.description.trim(), sourceType: input.sourceType, sourceId: input.sourceId,
                        purpose: input.purpose, idempotencyKey, totalKobo: total,
                        createdById: actor, isSystemActor: !actor,
                        lines: {
                            create: lines.map((l, i) => ({
                                lineNumber: i + 1, ledgerAccountId: accounts.get(l.ref)!,
                                debitKobo: l.debit, creditKobo: l.credit,
                                partyType: l.partyType ?? null, partyId: l.partyId ?? null,
                            })),
                        },
                    },
                });
            } catch (e) {
                if (isUniqueViolation(e)) throw ledgerErrors.duplicatePosting(idempotencyKey);   // two requests raced; the loser stops
                throw e;
            }

            if (input.sourceType === "MANUAL") {
                await this.deps.auditService?.log({
                    userId: actor ?? undefined, action: "finance.journal.manual_posted", entity: "JournalEntry", entityId: journal.id,
                    newValue: { number, entryDate: input.entryDate, totalKobo: total.toString(), description: input.description },
                });
            }
            return { journal, duplicate: false };
        });
    }

    /* ── reverse ──────────────────────────────────────────────────────── */
    async reverse(journalId: string, opts: { reason: string; entryDate?: string; actorUserId?: string | null }): Promise<PostResult> {
        const reason = opts.reason?.trim();
        if (!reason) throw ledgerErrors.reasonRequired();

        const today = todayInFinanceZone(this.now());
        const entryDay = opts.entryDate ?? today;
        const date = parseDay(entryDay);
        if (entryDay > today) throw ledgerErrors.futureDate(entryDay, today);

        return this.run(async () => {
            const db = this.db();
            const original = await db.journalEntry.findUnique({ where: { id: journalId }, include: { lines: true } });
            if (!original) throw ledgerErrors.journalNotFound();
            if (original.status === "REVERSED") throw ledgerErrors.alreadyReversed(original.number);
            if (original.sourceType === "REVERSAL") throw ledgerErrors.cannotReverseReversal(original.number);

            const period = await this.openPeriodFor(db, entryDay, date);
            const number = await this.nextNumber(db, entryDay.slice(0, 4));
            const actor = opts.actorUserId ?? this.deps.currentUserId?.() ?? null;
            const idempotencyKey = `REVERSAL:${original.id}:REVERSE`;

            const lines = [...original.lines].sort((a: any, b: any) => a.lineNumber - b.lineNumber);
            let reversal: PostedJournal;
            try {
                reversal = await db.journalEntry.create({
                    data: {
                        id: randomUUID(), number, entryDate: date, periodId: period.id,
                        termId: original.termId, sessionId: original.sessionId, branchId: original.branchId,
                        description: `Reversal of ${original.number}: ${reason}`, sourceType: "REVERSAL", sourceId: original.id,
                        purpose: "REVERSE", idempotencyKey, reversalOfId: original.id, reversalReason: reason,
                        totalKobo: original.totalKobo, createdById: actor, isSystemActor: !actor,
                        lines: {
                            create: lines.map((l: any, i: number) => ({
                                lineNumber: i + 1, ledgerAccountId: l.ledgerAccountId,
                                debitKobo: l.creditKobo, creditKobo: l.debitKobo,        // swapped
                                partyType: l.partyType ?? null, partyId: l.partyId ?? null,
                            })),
                        },
                    },
                });
            } catch (e) {
                if (isUniqueViolation(e)) throw ledgerErrors.alreadyReversed(original.number);
                throw e;
            }
            await db.journalEntry.update({ where: { id: original.id }, data: { status: "REVERSED" } });

            await this.deps.auditService?.log({
                userId: actor ?? undefined, action: "finance.journal.reversed", entity: "JournalEntry", entityId: original.id,
                newValue: { reversalId: reversal.id, reversalNumber: number, entryDate: entryDay }, metadata: { reason },
            });
            return { journal: reversal, duplicate: false };
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
    private async openPeriodFor(db: PostingDb, day: string, date: Date) {
        const find = () => db.financePeriod.findFirst({ where: { startDate: { lte: date }, endDate: { gte: date } } });
        let period = await find();
        if (!period) {
            const [y, m] = day.split("-").map(Number);
            const month = monthlyPeriods(m, new Date(Date.UTC(y, m - 1, 15)))[0];     // the calendar month containing the date
            await db.financePeriod.createMany({
                data: [{ id: randomUUID(), name: month.name, startDate: parseDay(month.startDate), endDate: parseDay(month.endDate), status: "OPEN", updatedAt: new Date() }],
                skipDuplicates: true,
            });
            period = await find();
        }
        if (!period) throw ledgerErrors.invalidJournal("Could not find or create the accounting period for this date");
        if (period.status !== "OPEN") throw ledgerErrors.periodClosed(period.name, day);
        return period;
    }

    private async resolveAccounts(db: PostingDb, lines: Array<{ ref: string; byKey: boolean }>): Promise<Map<string, string>> {
        const ids  = [...new Set(lines.filter(l => !l.byKey).map(l => l.ref))];
        const keys = [...new Set(lines.filter(l => l.byKey).map(l => l.ref))];
        const found = await db.ledgerAccount.findMany({
            where: { isActive: true, deletedAt: null, OR: [...(ids.length ? [{ id: { in: ids } }] : []), ...(keys.length ? [{ systemKey: { in: keys } }] : [])] },
        });
        const map = new Map<string, string>();
        for (const a of found) { map.set(a.id, a.id); if (a.systemKey) map.set(a.systemKey, a.id); }
        for (const l of lines) if (!map.has(l.ref)) throw ledgerErrors.accountNotFound(l.ref);
        return map;
    }

    // JE-2026-000001: the counter restarts each year (by the date of the entry)
    private async nextNumber(db: PostingDb, year: string): Promise<string> {
        const n = await this.deps.numberSequenceService.next("journal", year, db);
        return `JE-${year}-${String(n).padStart(6, "0")}`;
    }
}
