import { z } from "zod";

export const createClassSchema = z.object({
	name: z.string().min(1, "Class name is required").max(50),
	level: z.string().optional(),
	capacity: z.coerce.number().int().positive().optional(),
});

export type CreateClassFormValues = z.infer<typeof createClassSchema>;

export const createSubjectSchema = z.object({
	name: z.string().min(1, "Subject name is required").max(100),
	code: z.string().optional(),
	description: z.string().optional(),
});

export type CreateSubjectFormValues = z.infer<typeof createSubjectSchema>;

export const assignSubjectSchema = z.object({
	subjectId: z.string().uuid("Select a subject"),
	staffId: z.string().uuid("Select a teacher"),
});

export type AssignSubjectFormValues = z.infer<typeof assignSubjectSchema>;