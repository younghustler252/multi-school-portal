import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

/* The only place the events module builds domain errors. Codes are stable; the frontend switches on them. */
const conflict = (message: string, code: string, details?: Record<string, unknown>) => new AppError(message, 409, true, code, details);
const invalid  = (message: string, code: string, details?: Record<string, unknown>) => new AppError(message, 400, true, code, details);

export const eventErrors = {
    notFound:        () => new NotFoundError("Calendar event"),
    termNotFound:    () => new NotFoundError("Term"),
    sessionNotFound: () => new NotFoundError("Session"),
    branchNotFound:  () => invalid("One of the chosen branches does not exist", "EVENT_BRANCH_NOT_FOUND"),
    classNotFound:   () => invalid("One of the chosen classes does not exist", "EVENT_CLASS_NOT_FOUND"),
    badScope:        () => invalid("Choose a term or a session for the event, not two different ones", "EVENT_SCOPE_MISMATCH"),
    endBeforeStart:  () => invalid("The end date cannot be before the start date", "END_BEFORE_START"),
    timeRequired:    () => invalid("A timed event needs a start time", "EVENT_TIME_REQUIRED"),
    timeOnAllDay:    () => invalid("An all-day event cannot have a start or end time", "EVENT_TIME_ON_ALL_DAY"),
    endTimeNotAfterStart: () => invalid("The end time must be after the start time", "EVENT_END_TIME_BEFORE_START"),
    classWithStaff:  () => invalid("Classes can only be chosen for students and parents, not when staff are included", "EVENT_CLASS_AUDIENCE_NOT_FOR_STAFF"),
    classOutsideBranches: () => invalid("A chosen class is not in the chosen branches", "EVENT_CLASS_OUTSIDE_BRANCHES"),
    holidayMustBeSchoolWide: () => invalid("A holiday is for the whole school: everyone, with no branch or class narrowing", "EVENT_HOLIDAY_NOT_SCHOOL_WIDE"),
    badReminderOffsets: (why: string) => invalid(`Reminders: ${why}`, "EVENT_BAD_REMINDERS"),
    outOfScope:      () => new AppError("You can only manage events for your own branches", 403, true, "EVENT_OUT_OF_SCOPE"),
    cancelled:       () => conflict("This event was cancelled and can no longer be changed", "EVENT_CANCELLED"),
    audienceLocked:  () => conflict("The audience of a published event cannot be changed. Cancel it and create a new one", "EVENT_AUDIENCE_LOCKED"),
    notDraft:        () => conflict("Only a draft can be deleted. A published event is cancelled, so its history is kept", "EVENT_NOT_DRAFT"),
    useReschedule:   () => conflict("A published event's date and time change through the reschedule action, so the audience can be told", "EVENT_USE_RESCHEDULE"),
    notDraftToPublish: () => conflict("Only a draft can be published", "EVENT_NOT_DRAFT_TO_PUBLISH"),
    alreadyStarted:  () => conflict("This event has already started, so a notice can no longer be sent", "EVENT_ALREADY_STARTED"),
    noticeMismatch:  (kind: string) => conflict(`A "${kind}" notice does not fit the event's current state`, "EVENT_NOTICE_NOT_APPLICABLE"),
    noticesOff:      () => conflict("Event notices are switched off in the school's settings", "EVENT_NOTIFICATIONS_OFF"),
    invalidImage:    () => invalid("Upload a JPEG, PNG or WebP image up to 2 MB", "EVENT_INVALID_IMAGE"),
    notPublished:    () => conflict("Only a published event can be cancelled", "EVENT_NOT_PUBLISHED"),
};
