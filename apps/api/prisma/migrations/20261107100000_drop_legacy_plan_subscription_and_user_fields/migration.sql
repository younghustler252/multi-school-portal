-- Legacy columns that no code reads or writes any more are removed.
--   "Plan": studentLimit, staffLimit and features were replaced by "PlanEntitlement" rows (students.max, staff.max and feature keys).
--   "Subscription": the old Paystack codes and setup-fee/billing-attempt columns (the billing engine uses "PaymentMethod", "PaymentAttempt" and "SubscriptionInvoice").
--   "User": platformRole (platform authority is "PlatformMember" with "PlatformMemberRole").
-- The app has never been hosted, so there is no data to keep. Subscription keeps scheduledDowngradePlanId, nextBillingDate and failedBillingCount (still used).
ALTER TABLE "Plan"
    DROP COLUMN "studentLimit",
    DROP COLUMN "staffLimit",
    DROP COLUMN "features";

ALTER TABLE "Subscription"
    DROP COLUMN "paystackAuthorizationCode",
    DROP COLUMN "paystackCustomerCode",
    DROP COLUMN "paystackSubscriptionCode",
    DROP COLUMN "setupFeePaid",
    DROP COLUMN "setupFeePaidAt",
    DROP COLUMN "lastBillingAttemptAt";

DROP INDEX "User_platformRole_idx";
ALTER TABLE "User" DROP COLUMN "platformRole";
DROP TYPE "LegacyPlatformRole";
