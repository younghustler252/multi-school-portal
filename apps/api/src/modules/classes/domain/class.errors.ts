import { AppError, ForbiddenError, NotFoundError } from "../../../shared/errors/domain.errors";

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
    branchInvalid:   () => invalid("Choose an active branch of this school", "BRANCH_INVALID"),
    branchRequired:  () => invalid("Choose which branch this class belongs to", "BRANCH_REQUIRED"),
    branchOutOfScope: () => new ForbiddenError("You can only work with classes of your own branch", "BRANCH_OUT_OF_SCOPE"),
    allBranchesRequired: () => new ForbiddenError("This action affects the whole school, so it needs school-wide access", "ALL_BRANCHES_REQUIRED"),
    branchMoveBlocked: (students: number) => conflict(`The class has ${students} enrolment(s) this term. Move or finish them before moving the class to another branch`, "CLASS_BRANCH_HAS_STUDENTS", { students }),
    progressionBranchMismatch: (from: string, to: string) => conflict(`${from} and ${to} are in different branches. A class can only be promoted into a class of its own branch`, "PROGRESSION_BRANCH_MISMATCH", { from, to }),
    branchMoveBreaksProgression: (names: string[]) => conflict(`Moving the class would link it to a class of another branch (${names.join(", ")}). Change the "promoted into" order first`, "CLASS_BRANCH_PROGRESSION", { classes: names }),
    progressionLoop: (chain: string) => conflict(`This would make a loop (${chain})`, "PROGRESSION_LOOP", { chain }),
};
