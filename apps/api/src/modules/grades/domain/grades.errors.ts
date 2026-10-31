import { AppError, NotFoundError, ForbiddenError } from "../../../shared/errors/domain.errors";

/* Grades setup errors. Codes are stable; the frontend switches on them. */
export const gradesErrors = {
    levelInvalid:    () => new AppError("Use one of: default, primary, jss, ss", 400, true, "GRADES_LEVEL_INVALID"),
    scaleInvalid:    (problems: string[]) => new AppError("This grading scale is not valid", 400, true, "GRADES_SCALE_INVALID", { problems }),
    schemeInvalid:   (problems: string[]) => new AppError("This assessment scheme is not valid", 400, true, "GRADES_SCHEME_INVALID", { problems }),
    notFound:        (what: string) => new NotFoundError(what),
    defaultRequired: (what: string) => new AppError(`The default ${what} cannot be removed. Change it instead`, 409, true, "GRADES_DEFAULT_REQUIRED"),
    sheetNotFound:   () => new NotFoundError("Mark sheet"),
    notYourSheet:    () => new ForbiddenError("You can only work on the mark sheet of a subject you teach"),
    cannotSee:       () => new ForbiddenError("You cannot see this mark sheet"),
    notEditable:     (status: string) => new AppError(`This sheet is ${status}. Scores can only be changed while it is a draft`, 409, true, "GRADES_SHEET_NOT_EDITABLE", { status }),
    illegalMove:     (action: string, status: string) => new AppError(`A sheet that is ${status} cannot be ${action === "reopen" ? "reopened" : action + (action.endsWith("e") ? "d" : "ed")}`, 409, true, "GRADES_ILLEGAL_TRANSITION", { action, status }),
    emptyClass:      () => new AppError("There are no students on the class list for this term, so there is nothing to submit", 409, true, "GRADES_SHEET_EMPTY"),
    incomplete:      (missing: Array<{ student: string; missing: string[] }>) => new AppError(`${missing.length} student(s) still have scores missing. Enter every part, or mark the student absent`, 409, true, "GRADES_SHEET_INCOMPLETE", { missing: missing.slice(0, 50), total: missing.length }),
    notAllowed:      (what: string) => new ForbiddenError(`You are not allowed to ${what}`),
};
