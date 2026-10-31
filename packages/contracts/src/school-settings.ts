import { z } from "zod";

/** The preferences a school can set from the web app (the API checks keys and value types against its settings registry and names the setting in the error). */
export const PreferenceKeys = ["notifications.email_enabled", "notifications.sms_enabled", "automation.enabled"] as const;
export type PreferenceKey = (typeof PreferenceKeys)[number];
export type PreferenceValues = Record<PreferenceKey, boolean>;

/** PUT /school-settings/preferences  { values: { "automation.enabled": true, "notifications.sms_enabled": null } }  (null puts a preference back to its default; 1 to 20 keys) */
export const UpdatePreferencesRequest = z.object({
    values: z.record(z.string().min(1).max(100), z.union([z.boolean(), z.number(), z.string().max(200), z.null()]))
        .refine(v => { const n = Object.keys(v).length; return n >= 1 && n <= 20; }, "Send between 1 and 20 settings"),
}).strict();
export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequest>;
