import { AppError } from "../../../shared/errors/domain.errors";

/* The only place the notifications module builds domain errors. Codes are stable; the frontend switches on them. */
export const notificationErrors = {
    channelUnavailable: (channels: { channel: string; reason: "plan" | "school_setting" }[]) => new AppError(
        channels.map(c => c.reason === "plan"
            ? `${c.channel === "SMS" ? "SMS" : "Email"} is not included in your plan`
            : `${c.channel === "SMS" ? "SMS" : "Email"} is switched off in your school settings`).join(". "),
        400, true, "CHANNEL_NOT_AVAILABLE", { channels }),
    audienceOutOfScope: () => new AppError("You can only send to the students, parents and staff of your own branches", 403, true, "AUDIENCE_OUT_OF_SCOPE"),
    classAudienceNotForStaff: () => new AppError("A class can only be chosen when sending to students or parents", 400, true, "CLASS_AUDIENCE_NOT_FOR_STAFF"),
    noRecipients: () => new AppError("There is nobody to send this to", 400, true, "NO_RECIPIENTS"),
    notYours: () => new AppError("That message is not yours", 404, true, "NOTIFICATION_NOT_FOUND"),
    noInbox: () => new AppError("This account has no inbox in this school", 403, true, "NO_INBOX"),
};
