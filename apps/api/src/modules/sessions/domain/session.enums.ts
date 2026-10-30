export enum SessionErrorMessage {
    NOT_FOUND          = "Session not found",
    TERM_NOT_FOUND     = "Term not found",
    ALREADY_CURRENT    = "This is already the current session/term",
    NAME_TAKEN         = "A session with this name already exists",
    TERM_NAME_TAKEN    = "A term with this name already exists in this session",
    OVERLAPPING_DATES  = "Dates overlap with an existing session or term",
}