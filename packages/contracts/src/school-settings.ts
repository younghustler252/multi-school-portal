/** GET /school-settings/preferences and PUT (the body is { [key]: value } for the keys below; unknown keys are refused) */
export const PreferenceKeys = ["notifications.email_enabled", "notifications.sms_enabled", "automation.enabled"] as const;
export type PreferenceKey = (typeof PreferenceKeys)[number];
export type PreferenceValues = Record<PreferenceKey, boolean>;
