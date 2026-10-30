import { AppError } from "../../../shared/errors/domain.errors";

/* The only place the finance settings module builds domain errors. Codes are stable; the frontend switches on them. */
export const financeSettingsErrors = {
    unknownKey: (keys: string[]) => new AppError(
        `Unknown finance setting: ${keys.join(", ")}`, 400, true, "FINANCE_SETTING_UNKNOWN", { keys }),
    invalid: (problems: { key: string; message: string }[]) => new AppError(
        problems.length === 1 ? problems[0].message : "Some settings have values that are not allowed",
        400, true, "FINANCE_SETTING_INVALID", { problems }),
};
