import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

/* The only place the guardians module builds domain errors. Codes are stable; the frontend switches on them. */
export const guardianErrors = {
    notFound:        () => new NotFoundError("Guardian"),
    studentNotFound: () => new NotFoundError("Student"),
    alreadyLinked:   () => new AppError("This guardian is already linked to this student", 409, true, "GUARDIAN_ALREADY_LINKED"),
    notLinked:       () => new AppError("This guardian is not linked to this student", 404, true, "GUARDIAN_NOT_LINKED"),
    hasLogin:        () => new AppError("This guardian has a portal login, so the email cannot be changed here yet", 409, true, "GUARDIAN_HAS_LOGIN"),
    emailTaken:      () => new AppError("Another guardian already uses this email", 409, true, "GUARDIAN_EMAIL_TAKEN"),
    alreadyHasAccess: () => new AppError("This guardian already has portal access", 409, true, "GUARDIAN_ALREADY_HAS_ACCESS"),
    primaryConflict: () => new AppError("The primary guardian was changed at the same moment. Please try again", 409, true, "PRIMARY_GUARDIAN_CONFLICT"),
};
