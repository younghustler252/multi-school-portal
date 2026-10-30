import { AppError, BadRequestError, NotFoundError } from "../../../shared/errors/domain.errors";

/* The only place the ledger builds domain errors. Codes are stable; the frontend switches on them.
   Money in `details` is always a string of kobo (JSON cannot carry BigInt). */
export const ledgerErrors = {
    journalUnbalanced: (debitKobo: bigint, creditKobo: bigint) => new AppError(
        "The journal does not balance: total debits must equal total credits",
        400, true, "JOURNAL_UNBALANCED", { debitKobo: debitKobo.toString(), creditKobo: creditKobo.toString() }),
    invalidJournal:    (message: string) => new AppError(message, 400, true, "INVALID_JOURNAL"),
    invalidDate:       (value: string)   => new AppError(`"${value}" is not a valid date (use YYYY-MM-DD)`, 400, true, "INVALID_POSTING_DATE", { value }),
    futureDate:        (date: string, today: string) => new AppError(
        "Postings cannot be dated in the future", 400, true, "POSTING_DATE_IN_FUTURE", { date, today }),
    periodClosed:      (period: string, date: string) => new AppError(
        `The accounting period ${period} is closed. Reopen it, or post with a date in an open period`,
        409, true, "PERIOD_CLOSED", { period, date }),
    duplicatePosting:  (idempotencyKey: string) => new AppError(
        "This event has already been posted", 409, true, "DUPLICATE_POSTING", { idempotencyKey }),
    accountNotFound:   (ref: string) => new AppError(
        `Ledger account ${ref} does not exist or is not active`, 400, true, "ACCOUNT_NOT_FOUND", { account: ref }),
    journalNotFound:   () => new NotFoundError("Journal"),
    alreadyReversed:   (number: string) => new AppError(
        `Journal ${number} has already been reversed`, 409, true, "JOURNAL_ALREADY_REVERSED", { number }),
    cannotReverseReversal: (number: string) => new AppError(
        `Journal ${number} is itself a reversal and cannot be reversed`, 409, true, "CANNOT_REVERSE_REVERSAL", { number }),
    reasonRequired:    () => new BadRequestError("A reason is required to reverse a journal"),
    openingAlreadySet: (account: string) => new AppError(
        `${account} already has an opening balance. Reverse it first if it was wrong`, 409, true, "OPENING_BALANCE_EXISTS", { account }),
    notMoneyAccount:   (account: string) => new AppError(
        `${account} is not a cash, bank or other money account`, 400, true, "NOT_A_MONEY_ACCOUNT", { account }),
    sameAccount:       () => new AppError("Choose two different accounts", 400, true, "SAME_ACCOUNT"),
    amountInvalid:     () => new AppError("The amount must be a whole number of kobo above zero", 400, true, "INVALID_AMOUNT"),
    accountLocked:     (account: string) => new AppError(
        `${account} is kept by the system (it follows invoices, bills or payroll) and cannot be used in a manual journal`,
        409, true, "ACCOUNT_LOCKED", { account }),
    accountLockedFor:  (account: string, action: string) => new AppError(
        `${account} is a system account: it can be renamed, but it cannot be ${action}`, 409, true, "ACCOUNT_LOCKED", { account, action }),
    accountHasPostings: (account: string, lines: number) => new AppError(
        `${account} already has postings, so it cannot be deleted. Deactivate it instead`, 409, true, "ACCOUNT_HAS_POSTINGS", { account, lines }),
    accountHasChildren: (account: string, children: number) => new AppError(
        `${account} still has ${children} account(s) nested under it. Move or deactivate them first`, 409, true, "ACCOUNT_HAS_CHILDREN", { account, children }),
    accountHasBalance:  (account: string, balanceKobo: string) => new AppError(
        `${account} still holds money. Move the balance to another account first`, 409, true, "ACCOUNT_HAS_BALANCE", { account, balanceKobo }),
    accountCodeTaken:   (code: string) => new AppError(`Account code ${code} is already used`, 409, true, "ACCOUNT_CODE_TAKEN", { code }),
    accountCodeInvalid: (message: string) => new AppError(message, 400, true, "INVALID_ACCOUNT_CODE"),
    accountInvalid:     (message: string) => new AppError(message, 400, true, "INVALID_ACCOUNT"),
    accountAlreadyActive:   (account: string) => new AppError(`${account} is already active`, 409, true, "ACCOUNT_ALREADY_ACTIVE", { account }),
    accountAlreadyInactive: (account: string) => new AppError(`${account} is already inactive`, 409, true, "ACCOUNT_ALREADY_INACTIVE", { account }),
    periodNotFound:    () => new NotFoundError("Accounting period"),
    periodAlreadyClosed: (period: string) => new AppError(`${period} is already closed`, 409, true, "PERIOD_ALREADY_CLOSED", { period }),
    periodNotClosed:   (period: string) => new AppError(`${period} is not closed`, 409, true, "PERIOD_NOT_CLOSED", { period }),
    periodNotEnded:    (period: string, endDate: string, today: string) => new AppError(
        `${period} has not ended yet. It can be closed after ${endDate}`, 409, true, "PERIOD_NOT_ENDED", { period, endDate, today }),
    closeBlocked:      (period: string, items: unknown[]) => new AppError(
        `${period} cannot be closed until the problems on its checklist are fixed`, 409, true, "PERIOD_CLOSE_BLOCKED", { period, items }),
    closeNeedsAcknowledgement: (period: string, items: unknown[]) => new AppError(
        `${period} still has open items. Confirm that you want to close it anyway`, 409, true, "CLOSE_WARNINGS_UNACKNOWLEDGED", { period, items }),
    reopenReasonRequired: () => new BadRequestError("A written reason is required to reopen a period"),
    periodChanged:     () => new AppError("The period was changed by someone else. Reload and try again", 409, true, "STALE_VERSION"),
};
