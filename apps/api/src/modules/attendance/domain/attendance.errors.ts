import { AppError, NotFoundError, ForbiddenError } from "../../../shared/errors/domain.errors";

/* The only place the attendance module builds domain errors. Codes are stable; the frontend switches on them. */
export const attendanceErrors = {
    classNotFound:     () => new NotFoundError("Class"),
    recordNotFound:    () => new NotFoundError("Attendance record"),
    studentNotFound:   () => new NotFoundError("Student"),
    dateInvalid:       () => new AppError("Use a real date in the form YYYY-MM-DD", 400, true, "ATTENDANCE_DATE_INVALID"),
    dateInFuture:      () => new AppError("Attendance cannot be taken for a day that has not come yet", 400, true, "ATTENDANCE_DATE_IN_FUTURE"),
    outsideTerm:       () => new AppError("This date is not inside any term, so no register can be taken for it", 400, true, "ATTENDANCE_OUTSIDE_TERM"),
    termAmbiguous:     () => new AppError("This date falls in more than one term. Ask the school admin to fix the term dates first", 409, true, "ATTENDANCE_TERM_AMBIGUOUS"),
    holiday:           (title: string) => new AppError(`This day is a school holiday (${title}), so no register is taken`, 400, true, "ATTENDANCE_HOLIDAY", { holiday: title }),
    notYourClass:      () => new ForbiddenError("You can only take the register for a class you lead or teach in this term"),
    classNotVisible:   () => new ForbiddenError("You cannot see the attendance of this class"),
    editWindowClosed:  () => new AppError("This mark can no longer be changed. Only someone allowed to override attendance can correct it now", 403, true, "ATTENDANCE_EDIT_WINDOW_CLOSED"),
    nothingToChange:   () => new AppError("Send a new status or a new note", 400, true, "ATTENDANCE_NOTHING_TO_CHANGE"),
};
