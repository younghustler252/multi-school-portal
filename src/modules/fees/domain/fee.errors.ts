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
};
