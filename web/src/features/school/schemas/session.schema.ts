import { z } from "zod";

export const createSessionSchema = z
	.object({
		name: z.string().min(1, "Session name is required").regex(/^\d{4}\/\d{4}$/, "Use format 2024/2025"),
		startDate: z.string().min(1, "Start date is required"),
		endDate: z.string().min(1, "End date is required"),
	})
	.refine((data) => new Date(data.endDate) > new Date(data.startDate), {
		message: "End date must be after start date",
		path: ["endDate"],
	});

export type CreateSessionFormValues = z.infer<typeof createSessionSchema>;

export const createTermSchema = z
	.object({
		sessionId: z.string().uuid(),
		name: z.enum(["first", "second", "third"]),
		startDate: z.string().min(1, "Start date is required"),
		endDate: z.string().min(1, "End date is required"),
	})
	.refine((data) => new Date(data.endDate) > new Date(data.startDate), {
		message: "End date must be after start date",
		path: ["endDate"],
	});

export type CreateTermFormValues = z.infer<typeof createTermSchema>;