import { AppError } from "../../../shared/errors/domain.errors";

/* The only place the message templates module builds domain errors. Codes are stable; the frontend switches on them. */
export const templateErrors = {
    unknownTemplate: (key: string) => new AppError(`There is no message called ${key}`, 404, true, "TEMPLATE_UNKNOWN", { key }),
    invalid: (problems: string[]) => new AppError(problems[0], 400, true, "TEMPLATE_INVALID", { problems }),
    channelNotInPlan: (channel: string, feature: string) => new AppError(
        `Your plan does not include ${channel === "SMS" ? "SMS" : "email"} messages`, 403, true, "FEATURE_NOT_AVAILABLE", { feature }),
};
