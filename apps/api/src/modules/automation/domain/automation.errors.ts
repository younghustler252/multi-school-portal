import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

/* The only place the automation module builds domain errors. Codes are stable; the frontend switches on them. */
export const automationErrors = {
    ruleNotFound:      () => new NotFoundError("Automation rule"),
    unknownDefinition: (key: string) => new AppError(`There is no automation called ${key}`, 400, true, "AUTOMATION_UNKNOWN", { key }),
    invalid:           (problems: string[]) => new AppError(problems[0], 400, true, "AUTOMATION_INVALID", { problems }),
    disabledForSchool: () => new AppError("Automatic messages are switched off for this school. Turn them on in the school settings first", 409, true, "AUTOMATION_DISABLED"),
    planLimit:         (limit: number | undefined) => new AppError("Your plan does not allow more automatic messages to be switched on", 403, true, "AUTOMATION_PLAN_LIMIT", { limit }),
    ruleDisabled:      () => new AppError("This rule is switched off. Turn it on before running it", 409, true, "RULE_DISABLED"),
    noChannel:         (blocked: { channel: string; reason: string }[]) => new AppError(
        "None of this rule's channels can be used right now", 409, true, "NO_CHANNEL_AVAILABLE", { blocked }),
};
