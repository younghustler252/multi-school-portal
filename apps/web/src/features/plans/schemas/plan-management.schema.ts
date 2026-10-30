import { z } from "zod";

const featureKeys = [
	"smsNotifications", "emailNotifications", "reportCardPdf", "customGrading",
	"attendanceTracking", "gradeManagement", "paymentCollection", "feeManagement",
	"paymentReceipts", "multipleBranches", "prioritySupport", "apiAccess",
	"customDomain", "parentPortal", "bulkSms", "advancedReports", "whatsappNotifications",
] as const;

export const planFormSchema = z.object({
	name: z.string().min(2, "At least 2 characters").max(50),
	description: z.string().optional(),
	studentLimit: z.string().min(1, "Required"), // "-1" for unlimited
	staffLimit: z.string().min(1, "Required"),
	monthlyPriceKobo: z.string().min(1, "Required"), // entered in Naira, converted at submit
	yearlyPriceKobo: z.string().min(1, "Required"),
	setupFeeKobo: z.string().optional(),
	isPublic: z.boolean(),
	features: z.record(z.enum(featureKeys), z.boolean()),
});

export type PlanFormValues = z.infer<typeof planFormSchema>;
export { featureKeys };