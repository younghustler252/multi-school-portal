import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

/* The only place the gateway settlements module builds domain errors. Money in `details` is a string of kobo. */
export const settlementErrors = {
    notFound:        () => new NotFoundError("Settlement"),
    reportColumns:   (missing: string[]) => new AppError(`The settlement report is missing: ${missing.join(", ")}`, 422, true, "SETTLEMENT_REPORT_COLUMNS", { missing }),
    reportUnreadable: (problems: { row: number; message: string }[]) => new AppError(
        `${problems.length} row${problems.length === 1 ? "" : "s"} of the settlement report could not be read. Fix them, or confirm to skip them`,
        422, true, "SETTLEMENT_REPORT_UNREADABLE", { problems: problems.slice(0, 20), count: problems.length }),
    reportEmpty:     () => new AppError("The settlement report has no transactions", 422, true, "SETTLEMENT_REPORT_EMPTY"),
    tooLarge:        (max: number, got: number) => new AppError(`A report can hold at most ${max} transactions (this one has ${got})`, 413, true, "SETTLEMENT_REPORT_TOO_LARGE", { max, got }),
    accountInvalid:  (message: string) => new AppError(message, 400, true, "SETTLEMENT_INVALID"),
    dateRequired:    (ref: string) => new AppError(`Settlement ${ref} has no date in the report. Send settledOn`, 400, true, "SETTLEMENT_DATE_REQUIRED", { reference: ref }),
    duplicate:       (ref: string) => new AppError(`Settlement ${ref} is already recorded`, 409, true, "SETTLEMENT_ALREADY_RECORDED", { reference: ref }),
    paymentsInvalid: (reasons: { paymentId: string; message: string }[]) => new AppError(
        "Some payments cannot be settled", 400, true, "SETTLEMENT_PAYMENTS_INVALID", { reasons }),
    feeInvalid:      () => new AppError("The fee must be less than the amount settled", 400, true, "SETTLEMENT_FEE_INVALID"),
    alreadyReversed: () => new AppError("This settlement was already reversed", 409, true, "SETTLEMENT_ALREADY_REVERSED"),
    notClean:        (ref: string) => new AppError(`Settlement ${ref} has problems and cannot be recorded`, 409, true, "SETTLEMENT_NOT_CLEAN", { reference: ref }),
};
