/** Every response with success:false carries one of these in `code` (the web app switches on them, never on the message). */
export const ErrorCodes = {
    // automation
    AUTOMATION_UNKNOWN: "AUTOMATION_UNKNOWN", AUTOMATION_INVALID: "AUTOMATION_INVALID", AUTOMATION_DISABLED: "AUTOMATION_DISABLED",
    AUTOMATION_PLAN_LIMIT: "AUTOMATION_PLAN_LIMIT", RULE_DISABLED: "RULE_DISABLED", NO_CHANNEL_AVAILABLE: "NO_CHANNEL_AVAILABLE",
    // notifications
    CHANNEL_NOT_AVAILABLE: "CHANNEL_NOT_AVAILABLE", NO_RECIPIENTS: "NO_RECIPIENTS", NOTIFICATION_NOT_FOUND: "NOTIFICATION_NOT_FOUND",
    // settings and templates
    SETTING_UNKNOWN: "SETTING_UNKNOWN", SETTING_INVALID: "SETTING_INVALID", FILE_MISSING: "FILE_MISSING",
    // provisioning
    ALREADY_PROVISIONED: "ALREADY_PROVISIONED", PROVISIONING_IN_PROGRESS: "PROVISIONING_IN_PROGRESS",
    // auth
    ROLE_NOT_ALLOWED: "ROLE_NOT_ALLOWED",
} as const;
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface ApiError { success: false; message: string; code?: ErrorCode | string; details?: unknown }
export interface PaginationMeta { page: number; limit: number; total: number; totalPages: number }
