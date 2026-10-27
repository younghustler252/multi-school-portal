import { AppError, BadRequestError, NotFoundError } from "../../../shared/errors/domain.errors";

/* The only place the bank reconciliation module builds domain errors. Codes are stable; the frontend switches on them.
   Money in `details` is always a string of kobo (JSON cannot carry BigInt). */
export const reconciliationErrors = {
    accountInvalid:   (message: string) => new AppError(message, 400, true, "RECONCILIATION_ACCOUNT_INVALID"),
    statementColumns: (missing: string[]) => new AppError(
        "The file does not look like a bank statement: no header row with a date and an amount (or debit and credit) column was found",
        400, true, "STATEMENT_COLUMNS_NOT_FOUND", { missing }),
    statementEmpty:   (problems: { row: number; message: string }[]) => new AppError(
        "The statement has no usable transactions", 400, true, "STATEMENT_EMPTY", { problems: problems.slice(0, 20) }),
    statementProblems: (problems: { row: number; message: string }[]) => new AppError(
        `${problems.length} row(s) in the statement could not be read. Fix them and upload again, or confirm to skip them`,
        422, true, "STATEMENT_ROWS_UNREADABLE", { count: problems.length, problems: problems.slice(0, 20) }),
    statementTooLarge: (max: number, got: number) => new AppError(
        `A statement can have at most ${max} transactions (this one has ${got}). Upload it in parts`, 400, true, "STATEMENT_TOO_LARGE", { max, got }),
    statementDuplicate: () => new AppError(
        "Every transaction in this statement was already imported", 409, true, "STATEMENT_ALREADY_IMPORTED"),
    statementNotFound: () => new NotFoundError("Bank statement"),
    statementHasMatches: (count: number) => new AppError(
        `${count} line(s) of this statement are already matched. Undo those matches before deleting it`, 409, true, "STATEMENT_HAS_MATCHES", { count }),
    lineNotFound:      () => new NotFoundError("Bank line"),
    bookLineNotFound:  () => new NotFoundError("Book entry"),
    lineWrongAccount:  () => new AppError("Those lines belong to a different account", 400, true, "RECONCILIATION_WRONG_ACCOUNT"),
    bankLineMatched:   (id: string) => new AppError("A bank line is already matched", 409, true, "BANK_LINE_ALREADY_MATCHED", { id }),
    bookLineMatched:   (id: string) => new AppError("A book entry is already matched", 409, true, "BOOK_LINE_ALREADY_MATCHED", { id }),
    matchNeedsBothSides: () => new AppError("Choose at least one bank line and one book entry", 400, true, "MATCH_NEEDS_BOTH_SIDES"),
    matchTotalsDiffer: (bankTotalKobo: bigint, bookTotalKobo: bigint) => new AppError(
        "The bank lines and the book entries do not add up to the same amount", 400, true, "MATCH_TOTALS_DIFFER",
        { bankTotalKobo: bankTotalKobo.toString(), bookTotalKobo: bookTotalKobo.toString(), differenceKobo: (bankTotalKobo - bookTotalKobo).toString() }),
    matchTaken:        () => new AppError("Another person matched one of these lines a moment ago. Reload and try again", 409, true, "MATCH_CHANGED"),
    matchNotFound:     () => new NotFoundError("Match"),
    locked:            (through: string) => new AppError(
        `Everything up to ${through} has been reconciled and is locked. Reopen that reconciliation first`, 409, true, "RECONCILIATION_LOCKED", { through }),
    reasonRequired:    () => new BadRequestError("A written reason is required"),
    entryAccountInvalid: (message: string) => new AppError(message, 400, true, "ENTRY_ACCOUNT_INVALID"),
    reconciliationNotFound: () => new NotFoundError("Reconciliation"),
    alreadyReconciled: (period: string) => new AppError(`${period} is already reconciled for this account`, 409, true, "ALREADY_RECONCILED", { period }),
    periodNotEnded:    (period: string, endDate: string, today: string) => new AppError(
        `${period} has not ended yet. It can be reconciled after ${endDate}`, 409, true, "RECONCILIATION_PERIOD_NOT_ENDED", { period, endDate, today }),
    statementBalanceRequired: (asOf: string) => new AppError(
        `Enter the balance the bank shows at the end of ${asOf}: the statement has no running balance for that day`, 400, true, "STATEMENT_BALANCE_REQUIRED", { asOf }),
    unmatchedBankLines: (count: number, netKobo: bigint) => new AppError(
        `${count} bank line(s) up to the end of the month are not matched or recorded yet`, 409, true, "UNMATCHED_BANK_LINES", { count, netKobo: netKobo.toString() }),
    notAgreed:         (differenceKobo: bigint, adjustedBankKobo: bigint, adjustedBookKobo: bigint) => new AppError(
        "The bank and the books do not agree yet", 409, true, "RECONCILIATION_DIFFERENCE",
        { differenceKobo: differenceKobo.toString(), adjustedBankKobo: adjustedBankKobo.toString(), adjustedBookKobo: adjustedBookKobo.toString() }),
    onlyLatestReopens: (latest: string) => new AppError(
        `Only the latest reconciliation (${latest}) can be reopened. Reopen the later months first`, 409, true, "ONLY_LATEST_CAN_BE_REOPENED", { latest }),
};
