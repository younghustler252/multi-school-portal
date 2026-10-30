import { z } from "zod";

export const schoolSettingsSchema = z.object({
	primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional().or(z.literal("")),
	secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional().or(z.literal("")),
	motto: z.string().max(200).optional(),
	address: z.string().optional(),
	website: z.string().url("Enter a valid URL").optional().or(z.literal("")),
	foundedYear: z
		.number()
		.int()
		.min(1800)
		.max(new Date().getFullYear())
		.optional(),
	principalName: z.string().optional(),
});

export type SchoolSettingsFormValues = z.infer<typeof schoolSettingsSchema>;