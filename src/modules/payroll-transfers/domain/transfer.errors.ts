import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

/* The only place the salary transfers module builds domain errors. Money in `details` is a string of kobo. */
export const transferErrors = {
    notFound:        () => new NotFoundError("Salary transfer"),
    disabled:        (why: string) => new AppError(why, 409, true, "TRANSFERS_DISABLED"),
    runNotApproved:  (status: string) => new AppError(`Only an approved payroll run can be sent (this one is ${status})`, 409, true, "RUN_NOT_APPROVED", { status }),
    initiatorIsApprover: () => new AppError("The person who approved this run cannot also send it. Ask a different person", 403, true, "INITIATOR_IS_APPROVER"),
    accountInvalid:  (message: string) => new AppError(message, 400, true, "TRANSFER_ACCOUNT_INVALID"),
    nothingToSend:   (skipped: { staffId: string; reason: string }[]) => new AppError(
        "There is nothing to send: every payslip is already being paid or cannot be paid by transfer", 409, true, "NOTHING_TO_SEND", { skipped }),
    overLimit:       (code: "TRANSFER_OVER_LIMIT" | "BATCH_OVER_LIMIT", message: string, staffId?: string) => new AppError(message, 409, true, code, { staffId }),
    notRetryable:    (status: string) => new AppError(`A ${status.toLowerCase()} transfer cannot be retried. Only a failed or reversed one can`, 409, true, "TRANSFER_NOT_RETRYABLE", { status }),
    alreadyLive:     () => new AppError("This payslip already has a transfer that is pending, in flight or paid", 409, true, "TRANSFER_ALREADY_LIVE"),
    notCancellable:  (status: string) => new AppError(`Only a pending transfer can be cancelled (this one is ${status})`, 409, true, "TRANSFER_NOT_CANCELLABLE", { status }),
    manualPayBlocked: () => new AppError("This run has bank transfers started. Finish or cancel them instead of recording a manual payment", 409, true, "RUN_HAS_TRANSFERS"),
    changed:         () => new AppError("This transfer was changed by someone else. Reload and try again", 409, true, "TRANSFER_CHANGED"),
};
