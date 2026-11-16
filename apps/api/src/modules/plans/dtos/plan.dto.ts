import { z } from "zod";

// The public database stores plan prices and invoice amounts as 32-bit integers (largest 2,147,483,647 kobo, about N21.4 million): a bigger value
// would pass validation and fail at the database. Moving those columns to BigInt is a larger change; until then the limit is stated here (REM-065).
export const MAX_PLAN_KOBO = 2_147_483_647;
const kobo = z.number().int().min(0).max(MAX_PLAN_KOBO, `The largest amount is ${MAX_PLAN_KOBO} kobo`);

// One entitlement line. Which value is required depends on the feature's kind and is checked in the use case:
//   BOOLEAN -> boolValue     LIMIT / QUOTA -> limitValue (null = unlimited)     ENUM -> enumValue
//   remove: true deletes the row (BOOLEAN: not granted, LIMIT: 0)
export const EntitlementInputDto = z.object({
    featureKey: z.string().trim().min(1).max(100),
    boolValue:  z.boolean().optional(),
    limitValue: z.number().int().min(0).nullable().optional(),
    enumValue:  z.string().trim().min(1).max(100).optional(),
    remove:     z.boolean().optional(),
}).strict();

export const CreatePlanDto = z.object({
    name:             z.string().trim().min(2).max(50),
    description:      z.string().trim().max(300).optional(),
    monthlyPriceKobo: kobo,
    yearlyPriceKobo:  kobo,
    setupFeeKobo:     kobo.optional(),
    isPublic:         z.boolean().optional(),
    isCustom:         z.boolean().optional(),
    entitlements:     z.array(EntitlementInputDto).max(200).optional(),
}).strict();

export const UpdatePlanDto = z.object({
    name:             z.string().trim().min(2).max(50).optional(),
    description:      z.string().trim().max(300).nullable().optional(),
    monthlyPriceKobo: kobo.optional(),
    yearlyPriceKobo:  kobo.optional(),
    setupFeeKobo:     kobo.optional(),
    isPublic:         z.boolean().optional(),
}).strict().refine(d => Object.keys(d).length > 0, { message: "Nothing to update" });

export const SetEntitlementsDto = z.object({
    entitlements: z.array(EntitlementInputDto).min(1).max(200),
}).strict();

export const ClonePlanDto = z.object({
    name:     z.string().trim().min(2).max(50),
    isPublic: z.boolean().default(false),
}).strict();

export type EntitlementInput    = z.infer<typeof EntitlementInputDto>;
export type CreatePlanDtoType   = z.infer<typeof CreatePlanDto>;
export type UpdatePlanDtoType   = z.infer<typeof UpdatePlanDto>;
export type SetEntitlementsDtoType = z.infer<typeof SetEntitlementsDto>;
export type ClonePlanDtoType    = z.infer<typeof ClonePlanDto>;
