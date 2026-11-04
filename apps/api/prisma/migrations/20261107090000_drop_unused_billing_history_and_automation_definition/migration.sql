-- Two public tables were never read or written by any code and are removed:
--   "BillingHistory"             superseded by "SubscriptionInvoice" and "PaymentAttempt" (billing engine)
--   "AutomationRuleDefinition"   superseded by the automation definitions kept in code (modules/automation/domain/automation-definitions.ts)
-- Their enums are dropped with them: "PaymentStatus" was used only by "BillingHistory", "AutomationTrigger" only by "AutomationRuleDefinition".
-- The app has never been hosted, so there is no data to keep.
DROP TABLE "BillingHistory";
DROP TABLE "AutomationRuleDefinition";
DROP TYPE "PaymentStatus";
DROP TYPE "AutomationTrigger";
