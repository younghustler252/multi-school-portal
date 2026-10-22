import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

/* The only place the payments module builds domain errors. Codes are stable; the frontend switches on them.
   Money in `details` is always a string of kobo. */
export const paymentErrors = {
    paymentNotFound:  () => new NotFoundError("Payment"),
    receiptNotFound:  () => new NotFoundError("Receipt"),
    guardianNotFound: () => new NotFoundError("Guardian"),
    studentNotFound:  (id: string) => new AppError("A student on this payment does not exist", 400, true, "STUDENT_NOT_FOUND", { studentId: id }),
    studentsRequired: () => new AppError(
        "Say which students this payment is for (the guardian has no linked children to default to)", 400, true, "STUDENTS_REQUIRED"),
    accountInvalid:   (message: string) => new AppError(message, 400, true, "PAYMENT_ACCOUNT_INVALID"),
    referenceNeeded:  () => new AppError("A bank transfer or cheque needs its reference or a proof of payment", 400, true, "PAYMENT_REFERENCE_NEEDED"),
    referenceTaken:   (reference: string) => new AppError(`A payment with reference ${reference} is already recorded`, 409, true, "PAYMENT_REFERENCE_TAKEN", { reference }),
    futureDate:       () => new AppError("A payment cannot be dated in the future", 400, true, "PAYMENT_DATE_IN_FUTURE"),
    notWaiting:       (status: string) => new AppError(
        "Only a payment waiting for confirmation can be confirmed or rejected", 409, true, "PAYMENT_NOT_WAITING", { status }),
    selfConfirmation: () => new AppError(
        "A different person must confirm this payment. The person who recorded it cannot", 403, true, "SELF_CONFIRMATION_NOT_ALLOWED"),
    paymentChanged:   () => new AppError("This payment was changed by someone else. Reload it and try again", 409, true, "PAYMENT_CHANGED"),
    invoiceChanged:   (invoiceId: string) => new AppError(
        "An invoice changed while the payment was being applied. Try again", 409, true, "INVOICE_CHANGED", { invoiceId }),
    allocationInvoiceNotOpen: (invoiceId: string) => new AppError(
        "That invoice is not open for payment", 400, true, "ALLOCATION_INVOICE_NOT_OPEN", { invoiceId }),
    allocationDuplicate: () => new AppError("Each invoice can appear once in the allocation", 400, true, "ALLOCATION_DUPLICATE_INVOICE"),
    allocationOverBalance: (invoiceId: string, balanceKobo: bigint) => new AppError(
        "An allocation is more than the invoice still owes", 400, true, "ALLOCATION_EXCEEDS_BALANCE", { invoiceId, balanceKobo: balanceKobo.toString() }),
    allocationOverPayment: (amountKobo: bigint, allocatedKobo: bigint) => new AppError(
        "The allocations add up to more than the payment", 400, true, "ALLOCATION_EXCEEDS_PAYMENT", { amountKobo: amountKobo.toString(), allocatedKobo: allocatedKobo.toString() }),
    creditStudentInvalid: () => new AppError("The credit student must be one of the students on this payment", 400, true, "CREDIT_STUDENT_INVALID"),
    allocationsAtConfirmation: () => new AppError(
        "This payment waits for confirmation. Choose the allocation when it is confirmed", 400, true, "ALLOCATION_AT_CONFIRMATION"),
};
