import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

/* The only place the enrolment module builds domain errors. Codes are stable; the frontend switches on them. */
const conflict = (message: string, code: string, details?: Record<string, unknown>) => new AppError(message, 409, true, code, details);
const invalid  = (message: string, code: string) => new AppError(message, 400, true, code);

export const enrolmentErrors = {
    notFound:        () => new NotFoundError("Enrolment"),
    studentNotFound: () => new NotFoundError("Student"),
    classNotFound:   () => new NotFoundError("Class"),
    termNotFound:    () => new NotFoundError("Term"),
    studentInactive: () => invalid("This student is not active, so they cannot be enrolled", "STUDENT_INACTIVE"),
    alreadyEnrolled: (details: { status: string; class: string }) => conflict(`This student already has an enrolment for this term (${details.class}, ${details.status})`, "ENROLMENT_ALREADY_EXISTS", details),
    classFull:       (details: { capacity: number; enrolled: number; requested: number }) =>
        conflict(`The class has room for ${Math.max(details.capacity - details.enrolled, 0)} more student(s), but ${details.requested} were requested`, "CLASS_FULL", details),
    statusInvalid:   (from: string, to: string) => conflict(`An enrolment cannot change from ${from} to ${to}`, "ENROLMENT_STATUS_INVALID", { from, to }),
    promotionClassesFull: (classes: Array<{ name: string; capacity: number; enrolled: number; incoming: number }>) =>
        conflict(`These classes would be over capacity: ${classes.map(c => c.name).join(", ")}`, "CLASS_FULL", { classes }),
    sameClass:       () => invalid("The student is already in that class", "ENROLMENT_SAME_CLASS"),
    notActive:       () => conflict("Only an active enrolment can be moved to another class", "ENROLMENT_NOT_ACTIVE"),
    promotionSameTerm:  () => invalid("The new term must be a different term", "PROMOTION_SAME_TERM"),
    promotionTermOrder: () => invalid("The new term must start after the current term", "PROMOTION_TERM_ORDER"),
    promotionUnknownStudent: (n: number) => invalid(`${n} student(s) in the list are not active in the current term`, "PROMOTION_UNKNOWN_STUDENT"),
    promotionNeedsDecisions: (classes: string[]) => conflict(`These classes have no "promoted into" class set: ${classes.join(", ")}. Set it, or decide for each student`, "PROMOTION_NEEDS_DECISIONS", { classes }),
};
