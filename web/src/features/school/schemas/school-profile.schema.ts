import { z } from "zod";

export const schoolProfileSchema = z.object({
	name: z.string().min(2).max(100).optional(),
	email: z.string().email().optional(),
	phone: z.string().optional(),
	address: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	country: z.string().optional(),
	timezone: z.string().optional(),
	schoolCategory: z.enum(["primary", "secondary", "primary_secondary"]).optional(),
	schoolOwnership: z.enum(["private", "public", "mission", "international"]).optional(),
});

export type SchoolProfileFormValues = z.infer<typeof schoolProfileSchema>;