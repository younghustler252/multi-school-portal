import { z } from "zod";
import { nairaToKobo, priceProblem } from "../lib/plan-admin";

// Mirrors CreatePlanDto/UpdatePlanDto (apps/api/src/modules/plans). Prices are typed in naira and converted on submit.
const naira = z.string().trim().refine((v) => nairaToKobo(v) !== null, "Enter an amount like 25000 or 25,000.50");

export const planFormSchema = z
	.object({
		name: z.string().trim().min(2, "At least 2 characters").max(50, "At most 50 characters"),
		description: z.string().trim().max(500, "At most 500 characters"),
		monthlyPrice: naira,
		yearlyPrice: naira,
		setupFee: z.union([z.literal(""), naira]),
		isPublic: z.boolean(),
	})
	.superRefine((v, ctx) => {
		const m = nairaToKobo(v.monthlyPrice);
		const y = nairaToKobo(v.yearlyPrice);
		if (m === null || y === null) return;
		const problem = priceProblem(m, y);
		if (problem) ctx.addIssue({ code: "custom", path: ["yearlyPrice"], message: problem });
	});

export type PlanFormValues = z.infer<typeof planFormSchema>;
