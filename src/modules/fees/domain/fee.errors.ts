import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

/* The only place the fees module builds domain errors. Codes are stable; the frontend switches on them. */
export const feeErrors = {
    feeTypeNotFound:   () => new NotFoundError("Fee type"),
    structureNotFound: () => new NotFoundError("Fee structure"),
    discountRuleNotFound: () => new NotFoundError("Discount rule"),
    studentDiscountNotFound: () => new NotFoundError("Student discount"),
    studentNotFound:   () => new NotFoundError("Student"),
    feeTypeCodeTaken:  (code: string) => new AppError(`A fee type with code ${code} already exists`, 409, true, "FEE_TYPE_CODE_TAKEN", { code }),
    incomeAccountInvalid: (message: string) => new AppError(message, 400, true, "INCOME_ACCOUNT_INVALID"),
    feeTypeInUse:      (name: string) => new AppError(
        `${name} is already used on a fee structure or an invoice. Deactivate it instead of deleting it`, 409, true, "FEE_TYPE_IN_USE", { feeType: name }),
    feeTypeInactive:   (name: string) => new AppError(`${name} is not active`, 400, true, "FEE_TYPE_INACTIVE", { feeType: name }),
    duplicateStructureItem: () => new AppError("Each fee type can appear only once on a structure", 400, true, "DUPLICATE_STRUCTURE_ITEM"),
    termNotInSession:  () => new AppError("The term does not belong to that session", 400, true, "TERM_NOT_IN_SESSION"),
    refNotFound:       (what: string) => new AppError(`${what} does not exist`, 400, true, "REFERENCE_NOT_FOUND", { what }),
    structureOverlap:  () => new AppError(
        "A structure for this term, class, branch and student type already exists. Edit it instead", 409, true, "STRUCTURE_OVERLAP"),
    structureInUse:    () => new AppError(
        "Invoices were generated from this structure. Deactivate it instead of deleting it", 409, true, "STRUCTURE_IN_USE"),
    discountValueInvalid: (message: string) => new AppError(message, 400, true, "DISCOUNT_VALUE_INVALID"),
    discountRuleInUse: () => new AppError(
        "This discount is given to students. Deactivate it instead of deleting it", 409, true, "DISCOUNT_RULE_IN_USE"),
    discountRuleInactive: () => new AppError("This discount rule is not active", 400, true, "DISCOUNT_RULE_INACTIVE"),
    discountAlreadyGiven: () => new AppError("The student already has this discount for that session", 409, true, "DISCOUNT_ALREADY_GIVEN"),

    // invoices
    invoiceNotFound:   () => new NotFoundError("Invoice"),
    termNotFound:      () => new NotFoundError("Term"),
    invoiceNotDraft:   (number: string | null) => new AppError(
        "Only a draft invoice can be changed or deleted. An issued invoice changes through an adjustment, or is voided", 409, true, "INVOICE_NOT_DRAFT", { number }),
    invoiceChanged:    () => new AppError("Someone else changed this invoice. Reload it and try again", 409, true, "INVOICE_CHANGED"),
    invoiceEmpty:      () => new AppError("An invoice needs at least one fee above zero", 400, true, "INVOICE_HAS_NO_ITEMS"),
    invoiceAlreadyVoid: () => new AppError("This invoice is already void", 409, true, "INVOICE_ALREADY_VOID"),
    invoiceNotIssued:  () => new AppError("A draft was never issued. Delete it instead", 409, true, "INVOICE_NOT_ISSUED"),
    invoiceHasPayments: () => new AppError(
        "Money has been paid against this invoice. Reverse the payment, or use a credit note and refund", 409, true, "INVOICE_HAS_PAYMENTS"),
    invoiceHasAdjustments: () => new AppError(
        "This invoice has adjustments. Use a credit note instead of voiding it", 409, true, "INVOICE_HAS_ADJUSTMENTS"),
    studentRequired:   () => new AppError("Choose a student for the invoice", 400, true, "STUDENT_REQUIRED"),
    // adjustments
    adjustmentNotFound: () => new NotFoundError("Adjustment"),
    adjustmentAmountInvalid: () => new AppError("The amount must be above zero", 400, true, "ADJUSTMENT_AMOUNT_INVALID"),
    adjustmentInvoiceState: (status: string) => new AppError(
        "This invoice cannot be adjusted in its current state", 409, true, "ADJUSTMENT_INVOICE_STATE", { status }),
    adjustmentTooLarge: (maxKobo: bigint) => new AppError(
        "That is more than the invoice still owes", 400, true, "ADJUSTMENT_EXCEEDS_BALANCE", { maxKobo: maxKobo.toString() }),
    creditNoteItemRequired: () => new AppError("A credit note must say which fee on the invoice it cancels", 400, true, "CREDIT_NOTE_ITEM_REQUIRED"),
    itemNotOnInvoice: () => new AppError("That fee is not on this invoice", 400, true, "ITEM_NOT_ON_INVOICE"),
    itemNotAllowed: () => new AppError("Only a credit note names a fee", 400, true, "ITEM_NOT_ALLOWED"),
    creditNoteTooLarge: (maxKobo: bigint) => new AppError(
        "A credit note cannot be more than the fee it cancels, less earlier credit notes on it", 400, true, "CREDIT_NOTE_EXCEEDS_ITEM", { maxKobo: maxKobo.toString() }),
    adjustmentNotPending: (status: string) => new AppError("This adjustment was already decided", 409, true, "ADJUSTMENT_NOT_PENDING", { status }),
    adjustmentSelfApproval: () => new AppError(
        "A different person must approve this. The person who asked for it cannot", 403, true, "SELF_APPROVAL_NOT_ALLOWED"),
    adjustmentChanged: () => new AppError("This adjustment was changed by someone else. Reload it and try again", 409, true, "ADJUSTMENT_CHANGED"),
};
