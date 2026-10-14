/*
| BILLING MESSAGES: every sentence the billing engine sends to a school, in ONE place.
| (They move to platform message templates when the notifications module is built; nothing here names the platform.)
*/
export type BillingNotificationType = "subscription_expiry" | "subscription_renewed" | "subscription_failed" | "system_alert";

export interface BillingMessage { type: BillingNotificationType; title: string; message: string }

export const naira = (kobo: number): string => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
export const longDate = (d: Date): string => d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

export const billingMessages = {
    invoiceIssued: (plan: string, totalKobo: number, due: Date, card?: string): BillingMessage => ({
        type: "subscription_expiry", title: `Your ${plan} renewal invoice is ready`,
        message: card
            ? `${naira(totalKobo)} will be charged to your card ending ${card} on ${longDate(due)}. You can also pay earlier from the billing page.`
            : `${naira(totalKobo)} is due on ${longDate(due)}. Pay from the billing page to keep your plan without interruption.`,
    }),
    reminder: (plan: string, daysLeft: number, due: Date, card?: string): BillingMessage => ({
        type: "subscription_expiry", title: daysLeft <= 1 ? `Your ${plan} plan renews tomorrow` : `Your ${plan} plan renews in ${daysLeft} days`,
        message: card ? `Your card ending ${card} will be charged on ${longDate(due)}.` : `Please pay your invoice by ${longDate(due)} to avoid interruption.`,
    }),
    paid: (plan: string, until: Date, totalKobo: number): BillingMessage => ({
        type: "subscription_renewed", title: "Payment received",
        message: `Thank you. ${naira(totalKobo)} received. Your ${plan} plan is active until ${longDate(until)}.`,
    }),
    changed: (plan: string): BillingMessage => ({
        type: "subscription_renewed", title: "Plan updated", message: `You are now on the ${plan} plan.`,
    }),
    chargeFailed: (plan: string, reason: string | null, nextTry: Date | null, graceEnds: Date): BillingMessage => ({
        type: "subscription_failed", title: "We could not charge your card",
        message: `Your ${plan} renewal payment failed${reason ? ` (${reason})` : ""}. ${nextTry ? `We will try again on ${longDate(nextTry)}. ` : ""}`
               + `To avoid being moved to the Free plan after ${longDate(graceEnds)}, update your payment from the billing page.`,
    }),
    pastDue: (plan: string, graceEnds: Date): BillingMessage => ({
        type: "subscription_failed", title: "Your subscription payment is overdue",
        message: `Your ${plan} plan stays active until ${longDate(graceEnds)}. Pay your invoice before then to keep your features and data access unchanged.`,
    }),
    lapsed: (plan: string): BillingMessage => ({
        type: "subscription_failed", title: "You have been moved to the Free plan",
        message: `Your ${plan} payment was not received in time, so your school is now on the Free plan. All your data is safe. Pay your invoice or choose a plan to restore your features.`,
    }),
    cancelScheduled: (until: Date): BillingMessage => ({
        type: "subscription_expiry", title: "Cancellation scheduled",
        message: `Your plan stays active until ${longDate(until)}, then your school moves to the Free plan. You can resume any time before then.`,
    }),
    movedToFree: (): BillingMessage => ({
        type: "subscription_renewed", title: "You are now on the Free plan", message: "Your plan period ended and your school moved to the Free plan. Your data is unchanged.",
    }),
    downgradeCancelled: (plan: string, why: string): BillingMessage => ({
        type: "system_alert", title: "Scheduled downgrade cancelled", message: `Your move to ${plan} was cancelled: ${why}. You stay on your current plan.`,
    }),
};
