export enum SubscriptionErrorMessage {
    NOT_FOUND                         = "Subscription not found",
    ALREADY_ACTIVE                    = "School already has an active subscription",
    PLAN_NOT_FOUND                    = "Plan not found",
    COUPON_NOT_FOUND                  = "Coupon not found or expired",
    COUPON_EXHAUSTED                  = "Coupon has reached its maximum usage limit",
    INVALID_BILLING_CYCLE             = "Invalid billing cycle",
    CANNOT_DOWNGRADE                  = "Cannot downgrade to a lower plan",
    AUTO_RENEW_REQUIRES_CARD_PAYMENT  = "Auto-renew can only be enabled after a successful card payment",
    BILLING_RECORD_NOT_FOUND          = "Billing record not found",
    PAYMENT_VERIFICATION_FAILED       = "Payment verification failed",
}

export enum SubscriptionSuccessMessage {
    CREATED              = "Subscription created successfully",
    UPGRADED             = "Plan upgraded successfully",
    CANCELLED            = "Subscription cancelled successfully",
    RENEWED              = "Subscription renewed successfully",
    PAYMENT_ALREADY_VERIFIED = "Subscription upgrade payment was already verified",
}
