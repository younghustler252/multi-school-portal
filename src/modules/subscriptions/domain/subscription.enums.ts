/*
|--------------------------------------------------------------------------
| SUBSCRIPTION ENUMS
|--------------------------------------------------------------------------
*/

export enum SubscriptionErrorMessage {
    NOT_FOUND              = "Subscription not found",
    ALREADY_ACTIVE         = "School already has an active subscription",
    PLAN_NOT_FOUND         = "Plan not found",
    COUPON_NOT_FOUND       = "Coupon not found or expired",
    COUPON_EXHAUSTED       = "Coupon has reached its maximum usage limit",
    INVALID_BILLING_CYCLE  = "Invalid billing cycle",
    CANNOT_DOWNGRADE       = "Cannot downgrade to a lower plan",
}

export enum SubscriptionSuccessMessage {
    CREATED    = "Subscription created successfully",
    UPGRADED   = "Plan upgraded successfully",
    CANCELLED  = "Subscription cancelled successfully",
    RENEWED    = "Subscription renewed successfully",
}