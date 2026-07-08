import { z } from "zod";

/*
|--------------------------------------------------------------------------
| SUBSCRIPTION DTOs
|--------------------------------------------------------------------------
*/

// ── Create subscription (auto on registration) ────────────────────────────
export const CreateSubscriptionDto = z.object({
    schoolId:     z.string().uuid(),
    planId:       z.string().uuid(),
    billingCycle: z.enum(["monthly", "yearly"]).optional(),
    couponCode:   z.string().optional(),
});

// ── Upgrade plan ──────────────────────────────────────────────────────────
export const UpgradePlanDto = z.object({
    planId:       z.string().uuid(),
    billingCycle: z.enum(["monthly", "yearly"]),
    couponCode:   z.string().optional(),
});

// ── Cancel subscription ───────────────────────────────────────────────────
export const CancelSubscriptionDto = z.object({
    cancelAtPeriodEnd: z.boolean().default(true),
});

export type CreateSubscriptionDtoType = z.infer<typeof CreateSubscriptionDto>;
export type UpgradePlanDtoType        = z.infer<typeof UpgradePlanDto>;
export type CancelSubscriptionDtoType = z.infer<typeof CancelSubscriptionDto>;