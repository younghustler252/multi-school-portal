import { AppError } from "../../../shared/errors/domain.errors";

/* The only place the school settings module builds domain errors. Codes are stable; the frontend switches on them. */
export const schoolSettingsErrors = {
    unknownKey: (keys: string[]) => new AppError(
        `Unknown setting: ${keys.join(", ")}`, 400, true, "SETTING_UNKNOWN", { keys }),
    invalid: (problems: { key: string; message: string }[]) => new AppError(
        problems.length === 1 ? problems[0].message : "Some settings have values that are not allowed",
        400, true, "SETTING_INVALID", { problems }),
    imageInvalid: (code: string, message: string) => new AppError(message, 400, true, code),
    noFile: () => new AppError("No file uploaded", 400, true, "FILE_MISSING"),
};
