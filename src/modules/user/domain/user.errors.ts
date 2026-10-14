import { AppError, ForbiddenError, NotFoundError } from "../../../shared/errors/domain.errors";

/*
| USER ERROR FACTORIES — the only place this module builds domain errors.
| Codes are stable; the frontend switches on them.
*/
export const userErrors = {
    notFound:                () => new NotFoundError("User"),
    currentPasswordIncorrect: () => new ForbiddenError("Current password is incorrect", "CURRENT_PASSWORD_INCORRECT"),
    samePassword:            () => new AppError("New password must be different from the current password", 400, true, "SAME_PASSWORD"),
    notWhileImpersonating:   () => new ForbiddenError("This action is not available while impersonating", "IMPERSONATION_RESTRICTED"),
    invalidImage:            (msg = "Upload a JPEG, PNG or WebP image up to 2 MB") => new AppError(msg, 400, true, "INVALID_IMAGE"),
    sessionNotFound:         () => new NotFoundError("Session"),
    schoolNotFound:          () => new NotFoundError("School"),
    adminNotFound:           () => new NotFoundError("School administrator"),
    adminAmbiguous:          () => new AppError("This school has more than one administrator. Specify which one", 409, true, "ADMIN_AMBIGUOUS"),
};
