import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

/* The only place the classes module builds domain errors. Codes are stable; the frontend switches on them. */
const conflict = (message: string, code: string, details?: Record<string, unknown>) => new AppError(message, 409, true, code, details);
const invalid  = (message: string, code: string) => new AppError(message, 400, true, code);

export const classErrors = {
    notFound:        () => new NotFoundError("Class"),
    staffNotFound:   () => new NotFoundError("Staff member"),
    nameTaken:       () => conflict("A class with this name already exists", "CLASS_NAME_TAKEN"),
    inUse:           (details: Record<string, number>) => conflict("This class is in use and cannot be deleted", "CLASS_IN_USE", details),
    capacityTooLow:  (students: number) => conflict(`The class already has ${students} students, so its capacity cannot be lower than that`, "CAPACITY_BELOW_STUDENT_COUNT", { students }),
    teacherInvalid:  () => invalid("A class teacher must be an active teaching staff member", "CLASS_TEACHER_INVALID"),
    progressionSelf: () => invalid("A class cannot be promoted into itself", "PROGRESSION_SAME_CLASS"),
    subjectNotFound: () => new NotFoundError("Subject"),
    termNotFound:    () => new NotFoundError("Term"),
    assignmentNotFound: () => new NotFoundError("Subject assignment"),
    subjectNameTaken: () => conflict("A subject with this name already exists", "SUBJECT_NAME_TAKEN"),
    subjectCodeTaken: () => conflict("A subject with this code already exists", "SUBJECT_CODE_TAKEN"),
    subjectTeacherInvalid: () => invalid("A subject teacher must be an active teaching staff member", "SUBJECT_TEACHER_INVALID"),
    assignmentInUse: (grades: number) => conflict(`This subject already has ${grades} grade record(s) in this class, so it cannot be removed`, "CLASS_SUBJECT_IN_USE", { grades }),
    noCurrentTerm:   () => invalid("No current term is set. Choose the current term first", "NO_CURRENT_TERM"),
    progressionLoop: (chain: string) => conflict(`This would make a loop (${chain})`, "PROGRESSION_LOOP", { chain }),
};
