import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

/* Grades setup errors. Codes are stable; the frontend switches on them. */
export const gradesErrors = {
    levelInvalid:    () => new AppError("Use one of: default, primary, jss, ss", 400, true, "GRADES_LEVEL_INVALID"),
    scaleInvalid:    (problems: string[]) => new AppError("This grading scale is not valid", 400, true, "GRADES_SCALE_INVALID", { problems }),
    schemeInvalid:   (problems: string[]) => new AppError("This assessment scheme is not valid", 400, true, "GRADES_SCHEME_INVALID", { problems }),
    notFound:        (what: string) => new NotFoundError(what),
    defaultRequired: (what: string) => new AppError(`The default ${what} cannot be removed. Change it instead`, 409, true, "GRADES_DEFAULT_REQUIRED"),
    unchanged:       () => new AppError("Nothing changed", 409, true, "GRADES_UNCHANGED"),
};
