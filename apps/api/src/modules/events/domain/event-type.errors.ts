import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

/* Event type errors. Codes are stable; the frontend switches on them. */
const conflict = (message: string, code: string, details?: Record<string, unknown>) => new AppError(message, 409, true, code, details);

export const eventTypeErrors = {
    notFound:  () => new NotFoundError("Event type"),
    nameTaken: () => conflict("An event type with this name already exists", "EVENT_TYPE_NAME_TAKEN"),
    protected: (why = "System event types cannot be renamed, deactivated or deleted") => conflict(why, "EVENT_TYPE_PROTECTED"),
    inUse:     (events: number) => conflict(`${events} event(s) use this type. Deactivate it instead, so they keep their label`, "EVENT_TYPE_IN_USE", { events }),
    unknown:   () => new AppError("The chosen event type does not exist", 400, true, "EVENT_TYPE_UNKNOWN"),
    inactive:  () => conflict("This event type is inactive. Choose an active one", "EVENT_TYPE_INACTIVE"),
    limit:     (max: number) => conflict(`A school can have at most ${max} custom event types. Delete or reuse one`, "EVENT_TYPE_LIMIT", { max }),
};
