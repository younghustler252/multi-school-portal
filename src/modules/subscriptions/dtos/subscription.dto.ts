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
    callbackUrl: z.string().url(),
});

// ── Cancel subscription ───────────────────────────────────────────────────
export const CancelSubscriptionDto = z.object({
    cancelAtPeriodEnd: z.boolean().default(true),
});

export const ToggleAutoRenewDto = z.object({
    enabled: z.boolean(),
});

// ── Billing history ───────────────────────────────────────────────────────
export const GetBillingHistoryDto = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});

// ── Request downgrade ─────────────────────────────────────────────────────
export const RequestDowngradeDto = z.object({
    newPlanId: z.string().uuid(),
});

export type ToggleAutoRenewDtoType = z.infer<typeof ToggleAutoRenewDto>;
export type GetBillingHistoryDtoType = z.infer<typeof GetBillingHistoryDto>;
export type RequestDowngradeDtoType = z.infer<typeof RequestDowngradeDto>;
export type CreateSubscriptionDtoType = z.infer<typeof CreateSubscriptionDto>;
export type UpgradePlanDtoType        = z.infer<typeof UpgradePlanDto>;
export type CancelSubscriptionDtoType = z.infer<typeof CancelSubscriptionDto>;