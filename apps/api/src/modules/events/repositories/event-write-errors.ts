import { eventErrors } from "../domain/event.errors";
import { eventTypeErrors } from "../domain/event-type.errors";

/* What the database says when it refuses an event write (triggers), as the module's own errors. */
const said = (e: unknown, code: string): boolean => String((e as { message?: string })?.message ?? "").includes(code);
const isHolidayLock = (e: unknown): boolean => said(e, "EVENT_HOLIDAY_TYPE_LOCKED");
// ...and an event cannot be given a type that was deactivated after the application checked it (trigger, race-safe)
export const translateEventWriteError = (e: unknown): never => {
    if (isHolidayLock(e)) throw eventErrors.holidayTypeLocked();
    if (said(e, "EVENT_TYPE_INACTIVE")) throw eventTypeErrors.inactive();
    throw e;
};
