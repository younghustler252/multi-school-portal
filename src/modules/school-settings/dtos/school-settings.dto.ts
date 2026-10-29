import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be valid hex color");

/* Only web addresses. z.string().url() alone accepts javascript: and data: addresses, which would be a script
   waiting in a link on the school's public pages. */
const webUrl = (httpsOnly: boolean) => z.string().trim().max(500).url().refine(value => {
    try {
        const { protocol } = new URL(value);
        return httpsOnly ? protocol === "https:" : protocol === "https:" || protocol === "http:";
    } catch { return false; }
}, httpsOnly ? "Must be an https web address" : "Must be an http or https web address");

/*
| PUT /school-settings: the school's look and its report card template. Send only what changes.
| (allowStudentLogin and teachingModel are not edited here.)
*/
export const UpdateSchoolSettingsDto = z.object({
    primaryColor:   hexColor.optional(),
    secondaryColor: hexColor.optional(),
    motto:          z.string().trim().max(200).optional(),
    address:        z.string().trim().max(300).optional(),
    website:        webUrl(false).optional(),
    foundedYear:    z.number().int().min(1800).refine(y => y <= new Date().getFullYear(), "Cannot be in the future").optional(),
    principalName:  z.string().trim().max(100).optional(),

    reportCardTemplate:      z.enum(["classic", "modern", "minimal", "custom_letterhead"]).optional(),
    reportCardLetterheadUrl: webUrl(true).optional(),
    letterheadContentTopMm:    z.number().int().min(0).max(200).optional(),
    letterheadContentBottomMm: z.number().int().min(0).max(200).optional(),
}).strict().refine(v => Object.keys(v).length > 0, "Send at least one setting to change");

export type UpdateSchoolSettingsDtoType = z.infer<typeof UpdateSchoolSettingsDto>;

/*
| PUT /school-settings/preferences
| { "values": { "notifications.sms_enabled": true, "automation.enabled": null } }
| null puts a preference back to its default. Which keys exist and which values are allowed is checked by the use
| case against the settings registry, so the error can name the setting.
*/
export const UpdateSchoolPreferencesDto = z.object({
    values: z.record(z.string().min(1).max(100), z.union([z.boolean(), z.number(), z.string().max(200), z.null()]))
        .refine(v => { const n = Object.keys(v).length; return n >= 1 && n <= 20; }, "Send between 1 and 20 settings"),
}).strict();

export type UpdateSchoolPreferencesDtoType = z.infer<typeof UpdateSchoolPreferencesDto>;
