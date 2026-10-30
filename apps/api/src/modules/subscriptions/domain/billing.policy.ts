/*
|--------------------------------------------------------------------------
| BILLING POLICY: the rules of the billing lifecycle in one place
|
|  RENEWAL      an invoice for the next period is created INVOICE_LEAD_DAYS before the period ends
|               (nobody is surprised by a charge), and is due on the day the period ends.
|  REMINDERS    sent once each (never repeated) REMINDER_DAYS before the period ends.
|  CARD CHARGE  if auto-renew is on and a card is saved, the card is charged on the due date, then retried
|               at DUNNING_OFFSET_DAYS after the due date, only inside the grace period. Each failure
|               tells the school's admin, with a pay link.
|  PAST DUE     from the due date until the grace period ends. The school keeps its plan and its features
|               (nobody is locked out mid-term); modules may block NEW enrolments and score entry.
|  LAPSE        grace over and still unpaid: the school is moved to the Free plan with all its data kept,
|               remembers the plan it lost (lapsedPlanId), and can restore it by paying.
|--------------------------------------------------------------------------
*/
export const INVOICE_LEAD_DAYS = 3;
export const REMINDER_DAYS: readonly number[] = [7, 3, 1];
export const DUNNING_OFFSET_DAYS: readonly number[] = [0, 1, 3, 5, 7];   // days after the due date
export const DEFAULT_GRACE_DAYS = 7;
export const LIVE_STATUSES = ["trialing", "active", "past_due"] as const;
export const SYSTEM_BILLING_ACTOR = "SYSTEM_BILLING";
export const CURRENCY = "NGN";
export const PENDING_ATTEMPT_RECHECK_MINUTES = 15;

// Attempt offsets that fall inside the grace period
export const dunningOffsets = (graceDays: number): number[] => DUNNING_OFFSET_DAYS.filter(d => d <= graceDays);
