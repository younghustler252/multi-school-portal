import { z } from "zod";

/*
|--------------------------------------------------------------------------
| PLAN DTOs
|--------------------------------------------------------------------------
*/

const FeaturesSchema = z.object({
    smsNotifications:       z.boolean().optional(),
    emailNotifications:     z.boolean().optional(),
    reportCardPdf:          z.boolean().optional(),
    customGrading:          z.boolean().optional(),
    attendanceTracking:     z.boolean().optional(),
    gradeManagement:        z.boolean().optional(),
    paymentCollection:      z.boolean().optional(),
    feeManagement:          z.boolean().optional(),
    paymentReceipts:        z.boolean().optional(),
    multipleBranches:       z.boolean().optional(),
    prioritySupport:        z.boolean().optional(),
    apiAccess:              z.boolean().optional(),
    customDomain:           z.boolean().optional(),
    parentPortal:           z.boolean().optional(),
    bulkSms:                z.boolean().optional(),
    advancedReports:        z.boolean().optional(),
    whatsappNotifications:  z.boolean().optional(),
}).optional();

// ── Create plan ───────────────────────────────────────────────────────────
export const CreatePlanDto = z.object({
    name:             z.string().min(2).max(50),
    description:      z.string().optional(),
    studentLimit:     z.number().int().min(-1),
    staffLimit:       z.number().int().min(-1),
    features:         FeaturesSchema,
    monthlyPriceKobo: z.number().int().min(0),
    yearlyPriceKobo:  z.number().int().min(0),
    setupFeeKobo:     z.number().int().min(0).optional(),
    isPublic:         z.boolean().optional(),
    isCustom:         z.boolean().optional(),
});

// ── Update plan ───────────────────────────────────────────────────────────
export const UpdatePlanDto = z.object({
    name:             z.string().min(2).max(50).optional(),
    description:      z.string().optional(),
    studentLimit:     z.number().int().min(-1).optional(),
    staffLimit:       z.number().int().min(-1).optional(),
    features:         FeaturesSchema,
    monthlyPriceKobo: z.number().int().min(0).optional(),
    yearlyPriceKobo:  z.number().int().min(0).optional(),
    setupFeeKobo:     z.number().int().min(0).optional(),
    isPublic:         z.boolean().optional(),
    isActive:         z.boolean().optional(),
});

export type CreatePlanDtoType = z.infer<typeof CreatePlanDto>;
export type UpdatePlanDtoType = z.infer<typeof UpdatePlanDto>;