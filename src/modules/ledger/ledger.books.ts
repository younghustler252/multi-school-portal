import { randomUUID } from "crypto";
import { ledgerErrors } from "./ledger.errors";
import type { PostingService, PostLine, PostResult } from "./ledger.posting";

/*
|--------------------------------------------------------------------------
| BOOKS SERVICE: the three things an accountant does by hand (brief section 7, rules 11, 14 and 16)
|
|   openingBalance   a money account's balance from before the school started using the system:
|                    debit the account, credit Opening balance equity (reversed for an overdraft).
|                    Once per account; to correct it, reverse it and enter it again.
|   transfer         money moving between two money accounts (bank to cash, float to petty cash ...)
|   manualJournal    free journal for an accountant: a written reason, balanced lines, an open period.
|                    It may not touch accounts the system keeps in step with invoices, bills and payroll.
|
| All three go through the posting service, so every rule there (balance, dates, periods, no double posting)
| applies. Callers may pass a `requestId` (the browser makes one per click): the same id twice posts once.
|--------------------------------------------------------------------------
*/

// Accounts with a sub-ledger (invoices, bills, payslips). Posting by hand would break the nightly control check.
export const CONTROL_SYSTEM_KEYS: ReadonlySet<string> = new Set([
    "FEES_RECEIVABLE", "ADVANCE_PAYMENTS", "STAFF_LOANS_RECEIVABLE",
    "ACCOUNTS_PAYABLE", "SALARIES_PAYABLE", "TAX_PAYABLE", "PENSION_PAYABLE",
]);

export interface BookAccount {
    id: string; code: string; name: string; type: string; systemKey: string | null; isMoneyAccount: boolean; isActive: boolean;
}

export interface BooksDb {
    ledgerAccount: { findMany(args: { where: Record<string, unknown> }): Promise<BookAccount[]> };
    journalEntry:  { findMany(args: { where: Record<string, unknown>; select: { status: true } }): Promise<Array<{ status: string }>> };
}

export interface BooksDeps {
    db:      () => BooksDb;
    posting: Pick<PostingService, "post">;
}

const isKobo = (v: unknown): v is bigint => typeof v === "bigint";

export class BooksService {
    constructor(private readonly deps: BooksDeps) {}

    private async accounts(ids: string[]): Promise<Map<string, BookAccount>> {
        const rows = await this.deps.db().ledgerAccount.findMany({ where: { id: { in: ids }, deletedAt: null } });
        const map = new Map(rows.map(a => [a.id, a]));
        for (const id of ids) {
            const a = map.get(id);
            if (!a || !a.isActive) throw ledgerErrors.accountNotFound(id);
        }
        return map;
    }

    /** Opening balance of a money account. Positive = money held; negative = overdrawn. */
    async openingBalance(input: { accountId: string; amountKobo: bigint; asOfDate: string; actorUserId?: string | null }): Promise<PostResult> {
        if (!isKobo(input.amountKobo) || input.amountKobo === 0n) throw ledgerErrors.amountInvalid();
        const account = (await this.accounts([input.accountId])).get(input.accountId)!;
        if (!account.isMoneyAccount) throw ledgerErrors.notMoneyAccount(account.name);

        // Earlier attempts that were reversed do not count; the idempotency key moves on so the new one can be saved
        const earlier = await this.deps.db().journalEntry.findMany({ where: { sourceType: "OPENING_BALANCE", sourceId: account.id }, select: { status: true } });
        if (earlier.some(e => e.status === "POSTED")) throw ledgerErrors.openingAlreadySet(account.name);

        const amount = input.amountKobo < 0n ? -input.amountKobo : input.amountKobo;
        const money: PostLine = { accountId: account.id };
        const equity: PostLine = { systemKey: "OPENING_EQUITY" };
        if (input.amountKobo > 0n) { money.debitKobo = amount; equity.creditKobo = amount; }
        else                       { money.creditKobo = amount; equity.debitKobo = amount; }

        return this.deps.posting.post({
            entryDate: input.asOfDate, description: `Opening balance: ${account.name}`,
            sourceType: "OPENING_BALANCE", sourceId: account.id, purpose: `OPENING:${earlier.length + 1}`,
            lines: [money, equity], actorUserId: input.actorUserId,
        });
    }

    /** Move money from one money account to another. */
    async transfer(input: {
        fromAccountId: string; toAccountId: string; amountKobo: bigint; entryDate: string;
        description?: string; requestId?: string; branchId?: string | null; actorUserId?: string | null;
    }): Promise<PostResult> {
        if (!isKobo(input.amountKobo) || input.amountKobo <= 0n) throw ledgerErrors.amountInvalid();
        if (input.fromAccountId === input.toAccountId) throw ledgerErrors.sameAccount();
        const accounts = await this.accounts([input.fromAccountId, input.toAccountId]);
        const from = accounts.get(input.fromAccountId)!, to = accounts.get(input.toAccountId)!;
        for (const a of [from, to]) if (!a.isMoneyAccount) throw ledgerErrors.notMoneyAccount(a.name);

        return this.deps.posting.post({
            entryDate: input.entryDate, description: input.description?.trim() || `Transfer from ${from.name} to ${to.name}`,
            sourceType: "TRANSFER", sourceId: input.requestId ?? randomUUID(), purpose: "TRANSFER", branchId: input.branchId,
            lines: [{ accountId: to.id, debitKobo: input.amountKobo }, { accountId: from.id, creditKobo: input.amountKobo }],
            actorUserId: input.actorUserId,
        });
    }

    /** A free journal for an accountant. Always audited by the posting service. */
    async manualJournal(input: {
        entryDate: string; description: string; reason: string; lines: PostLine[]; requestId?: string;
        branchId?: string | null; actorUserId?: string | null;
    }): Promise<PostResult> {
        if (!input.reason?.trim()) throw ledgerErrors.invalidJournal("A manual journal needs a written reason");
        if (!Array.isArray(input.lines) || input.lines.some(l => !l.accountId || l.systemKey)) {
            throw ledgerErrors.invalidJournal("Manual journal lines must name their account by id");
        }

        const accounts = await this.accounts([...new Set(input.lines.map(l => l.accountId!))]);
        for (const a of accounts.values()) {
            if (a.systemKey && CONTROL_SYSTEM_KEYS.has(a.systemKey)) throw ledgerErrors.accountLocked(a.name);
        }

        return this.deps.posting.post({
            entryDate: input.entryDate, description: `${input.description.trim()} (${input.reason.trim()})`,
            sourceType: "MANUAL", sourceId: input.requestId ?? randomUUID(), purpose: "MANUAL", branchId: input.branchId,
            lines: input.lines, actorUserId: input.actorUserId,
        });
    }
}
