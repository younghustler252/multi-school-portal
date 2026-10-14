import { AppError, ForbiddenError, NotFoundError, BadRequestError, ConflictError } from "../../../shared/errors/domain.errors";

/* The only place the school module builds domain errors. Codes are stable; the frontend switches on them. */
export const schoolErrors = {
    notFound:           () => new NotFoundError("School"),
    documentNotFound:   () => new NotFoundError("Document"),
    notVerified:        () => new ForbiddenError("This feature unlocks after your school is verified", "SCHOOL_NOT_VERIFIED"),
    fieldLocked:        (fields: string[]) => new ForbiddenError(
        "These details are locked once your school is verified. Contact support to change them", "FIELD_LOCKED_AFTER_VERIFICATION", { fields }),
    invalidFile:        (msg = "Upload a PDF, JPG or PNG file up to 5 MB") => new AppError(msg, 400, true, "INVALID_FILE"),
    invalidImage:       (msg = "Upload a JPEG, PNG or WebP image up to 2 MB") => new AppError(msg, 400, true, "INVALID_IMAGE"),
    tooManyDocuments:   () => new AppError("You have reached the upload limit for this document type", 409, true, "DOCUMENT_LIMIT_REACHED"),
    bankNotVerified:    () => new BadRequestError("Could not verify bank account. Please check the account number and bank"),
    passwordRequired:   () => new ForbiddenError("Confirm your password to change the payment account", "PASSWORD_CONFIRMATION_REQUIRED"),
    passwordWrong:      () => new ForbiddenError("Password is incorrect", "CURRENT_PASSWORD_INCORRECT"),
    documentsIncomplete: () => new AppError("Required documents are not all approved yet", 409, true, "DOCUMENTS_INCOMPLETE"),
    notSuspended:       () => new ConflictError("This school is not suspended"),
    subdomainTaken:     () => new ConflictError("This subdomain is already taken"),
    subdomainReserved:  () => new ConflictError("This subdomain is not available"),
    emailTaken:         () => new ConflictError("A school with this email already exists"),
    noFreePlan:         () => new AppError("No free plan is configured", 503, true, "REGISTRATION_UNAVAILABLE"),
};
