import { z } from "zod";

const gradingConfigRowSchema = z
	.object({
		grade: z.string().min(1, "Required").max(5),
		remark: z.string().min(1, "Required").max(50),
		minScore: z.string().min(1, "Required"),
		maxScore: z.string().min(1, "Required"),
	});

export const gradingConfigSchema = z.object({
	configs: z.array(gradingConfigRowSchema).min(1, "Add at least one grade band"),
});

export type GradingConfigFormValues = z.infer<typeof gradingConfigSchema>;