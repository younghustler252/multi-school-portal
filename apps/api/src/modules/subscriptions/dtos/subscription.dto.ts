import { z } from "zod";

const cycle   = z.enum(["monthly", "yearly"]);
const idField = z.string().min(1).max(64);

// ── School realm ──────────────────────────────────────────────────────────
export const PreviewChangeDto = z.object({ planId: idField, billingCycle: cycle, couponCode: z.string().trim().max(40).optional() }).strict();
// Same shape as the preview, plus the person's choice about automatic renewal. The return address after
// checkout is built by the server and is never accepted from the client.
export const ChangePlanDto = z.object({
    planId: idField, billingCycle: cycle, couponCode: z.string().trim().max(40).optional(), autoRenew: z.boolean().optional(),
}).strict();
export const RequestDowngradeDto = z.object({ planId: idField }).strict();
export const CancelSubscriptionDto = z.object({ immediately: z.boolean().default(false) }).strict();
export const ToggleAutoRenewDto = z.object({ enabled: z.boolean() }).strict();
export const VerifyPaymentQuery = z.object({ reference: z.string().min(6).max(100) });
export const ListInvoicesQuery  = z.object({
    page:  z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["open", "paid", "void", "uncollectible"]).optional(),
});

// ── Platform realm ────────────────────────────────────────────────────────
export const ListSubscriptionsQuery = z.object({
    page:   z.coerce.number().int().min(1).default(1),
    limit:  z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["trialing", "active", "past_due", "suspended", "cancelled", "expired"]).optional(),
    planId: idField.optional(),
});
export const PlatformChangePlanDto = z.object({
    planId:       idField,
    billingCycle: cycle.optional(),
    periodEndsAt: z.string().refine(v => !Number.isNaN(Date.parse(v)), "Invalid date").optional(),   // a complimentary plan can end on a chosen date
    reason:       z.string().trim().min(10).max(300),
}).strict();
export const ExtendPeriodDto = z.object({ days: z.number().int().min(1).max(90), reason: z.string().trim().min(10).max(300) }).strict();
export const VoidInvoiceDto  = z.object({ reason: z.string().trim().min(10).max(300) }).strict();
export const MarkInvoicePaidDto = z.object({
    reference: z.string().trim().min(3).max(100),      // bank transfer reference or receipt number
    note:      z.string().trim().max(300).optional(),
}).strict();
export const ListPlatformInvoicesQuery = z.object({
    page:  z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["open", "paid", "void", "uncollectible"]).optional(),
    overdue: z.coerce.boolean().optional(),
});

export type PreviewChangeDtoType      = z.infer<typeof PreviewChangeDto>;
export type ChangePlanDtoType         = z.infer<typeof ChangePlanDto>;
export type RequestDowngradeDtoType   = z.infer<typeof RequestDowngradeDto>;
export type CancelSubscriptionDtoType = z.infer<typeof CancelSubscriptionDto>;
export type ToggleAutoRenewDtoType    = z.infer<typeof ToggleAutoRenewDto>;
export type ListInvoicesQueryType     = z.infer<typeof ListInvoicesQuery>;
export type ListSubscriptionsQueryType = z.infer<typeof ListSubscriptionsQuery>;
export type PlatformChangePlanDtoType = z.infer<typeof PlatformChangePlanDto>;
export type ExtendPeriodDtoType       = z.infer<typeof ExtendPeriodDto>;
export type VoidInvoiceDtoType        = z.infer<typeof VoidInvoiceDto>;
export type MarkInvoicePaidDtoType    = z.infer<typeof MarkInvoicePaidDto>;
export type ListPlatformInvoicesQueryType = z.infer<typeof ListPlatformInvoicesQuery>;
