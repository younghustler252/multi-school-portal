import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

/* The only place the sessions module builds domain errors. Codes are stable; the frontend switches on them. */
const conflict = (message: string, code: string, details?: Record<string, unknown>) => new AppError(message, 409, true, code, details);
const invalid  = (message: string, code: string) => new AppError(message, 400, true, code);

export const sessionErrors = {
    sessionNotFound:  () => new NotFoundError("Session"),
    termNotFound:     () => new NotFoundError("Term"),
    eventNotFound:    () => new NotFoundError("Calendar event"),
    sessionNameTaken: () => conflict("A session with this name already exists", "SESSION_NAME_TAKEN"),
    termNameTaken:    () => conflict("This session already has that term", "TERM_NAME_TAKEN"),
    sessionOverlap:   (otherName: string) => conflict(`These dates overlap the session ${otherName}`, "SESSION_DATES_OVERLAP", { session: otherName }),
    termOverlap:      (otherName: string) => conflict(`These dates overlap the ${otherName} term`, "TERM_DATES_OVERLAP", { term: otherName }),
    termOutsideSession: () => invalid("A term must start and end inside its session", "TERM_OUTSIDE_SESSION"),
    sessionExcludesTerms: () => conflict("These dates would leave a term outside the session", "SESSION_EXCLUDES_TERMS"),
    endBeforeStart:   () => invalid("The end date must be after the start date", "END_BEFORE_START"),
    badEventScope:    () => invalid("Choose a term or a session for the event, not two different ones", "EVENT_SCOPE_MISMATCH"),
    termInUse:        () => conflict("This term already has records, so its name cannot change", "TERM_IN_USE"),
};
