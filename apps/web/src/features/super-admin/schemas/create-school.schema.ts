import { z } from "zod";

export const createSchoolSchema = z.object({
	name: z.string().min(3, "At least 3 characters").max(100),
	subdomain: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only"),
	email: z.string().email(),
	phone: z.string().optional(),
	schoolCategory: z.enum(["primary", "secondary", "primary_secondary"]),
	schoolOwnership: z.enum(["private", "public", "mission", "international"]),
});
export type CreateSchoolFormValues = z.infer<typeof createSchoolSchema>;