import { AppError, NotFoundError, ConflictError } from "../../../shared/errors/domain.errors";

/* The only place the subscriptions module builds domain errors. Codes are stable; the frontend switches on them. */
export const billingErrors = {
    notFound:          () => new NotFoundError("Subscription"),
    planNotFound:      () => new NotFoundError("Plan"),
    invoiceNotFound:   () => new NotFoundError("Invoice"),
    methodNotFound:    () => new NotFoundError("Payment method"),
    planUnavailable:   () => new AppError("This plan is not available", 409, true, "PLAN_UNAVAILABLE"),
    noChange:          () => new AppError("You are already on this plan and billing cycle", 409, true, "NO_PLAN_CHANGE"),
    notAnUpgrade:      () => new AppError("That plan costs less than your current one. Use the downgrade option so it starts when your period ends", 409, true, "NOT_AN_UPGRADE"),
    notADowngrade:     () => new AppError("That plan does not cost less than your current one. Use the upgrade option", 409, true, "NOT_A_DOWNGRADE"),
    freeIsDowngrade:   () => new AppError("To move to the Free plan, cancel your subscription or schedule a downgrade", 409, true, "USE_DOWNGRADE"),
    couponInvalid:     (why: string) => new AppError(why, 400, true, "COUPON_INVALID"),
    downgradeBlocked:  (violations: { feature: string; name: string; limit: number; usage: number }[]) =>
        new AppError("Your school currently uses more than the new plan allows", 409, true, "DOWNGRADE_BLOCKED", { violations }),
    invoiceNotPayable: () => new AppError("This invoice cannot be paid", 409, true, "INVOICE_NOT_PAYABLE"),
    wrongSchool:       () => new NotFoundError("Payment"),                      // never confirm that another school's reference exists
    needsCard:         () => new AppError("Automatic renewal needs a saved card. Pay an invoice with a card first", 409, true, "AUTO_RENEW_NEEDS_CARD"),
    alreadyCancelling: () => new ConflictError("Cancellation is already scheduled"),
    notCancelling:     () => new ConflictError("No cancellation is scheduled"),
    noScheduledChange: () => new ConflictError("No downgrade is scheduled"),
    paymentUnavailable: () => new AppError("Payments are temporarily unavailable. Please try again in a few minutes", 503, true, "PAYMENT_UNAVAILABLE"),
    invoiceSettled:    () => new ConflictError("This invoice is already settled"),
    badExtension:      () => new AppError("Extension must be between 1 and 90 days", 400, true, "INVALID_EXTENSION"),
};
