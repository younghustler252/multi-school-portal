import { z } from "zod";

export const UpdateSchoolSettingsDto = z.object({
    primaryColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, "Must be valid hex color")
        .optional(),

    secondaryColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, "Must be valid hex color")
        .optional(),

    motto: z
        .string()
        .max(200)
        .optional(),

    address: z
        .string()
        .optional(),

    website: z
        .string()
        .url()
        .optional(),

    foundedYear: z
        .number()
        .int()
        .min(1800)
        .max(new Date().getFullYear())
        .optional(),

    principalName: z
        .string()
        .optional(),

    reportCardTemplate: z
        .enum([
            "classic",
            "modern",
            "minimal",
            "custom_letterhead",
        ])
        .optional(),

    reportCardLetterheadUrl: z
        .string()
        .url()
        .optional(),

    letterheadContentTopMm: z
        .number()
        .int()
        .min(0)
        .max(200)
        .optional(),

    letterheadContentBottomMm: z
        .number()
        .int()
        .min(0)
        .max(200)
        .optional(),
});

export type UpdateSchoolSettingsDtoType =
    z.infer<typeof UpdateSchoolSettingsDto>;