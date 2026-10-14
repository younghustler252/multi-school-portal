# Subscriptions and billing pass: apply notes

## 1. Order
1. **Schema first**: `docs/BILLING_SCHEMA.md` (new tables, 3 new `Subscription` fields, back-relations). Migrate.
2. Delete the old files (section 2). Copy the new ones.
3. Run the registry sync (it now registers the billing permissions too).
4. Mount routes, update `worker.ts` (section 3).
5. Dev data: `DELETE FROM "BillingHistory"; UPDATE "Subscription" SET "paystackAuthorizationCode" = NULL;`

## 2. Delete / replace
- **Delete** the old `modules/subscriptions` folders `usecases/school-admin/`, `usecases/super-admin/`, `domain/*`, `dtos/*`, old controllers and routes; **delete** `infrastructure/jobs/workers/subscription-expiry.worker.ts` and its queue and scheduler registration.
- **Replace** `infrastructure/payments/` (interface + `paystack.provider.ts`), `modules/payments/usecases/handle-webhook.usecase.ts`, `infrastructure/jobs/workers/payment-reconciliation.worker.ts`, `foundation/permissions.registry.ts`.
- New: `infrastructure/middleware/require-good-standing.middleware.ts`, `infrastructure/jobs/queues/billing.queue.ts`, `infrastructure/jobs/workers/billing.worker.ts`.
- Search for imports of `verify-subscription-upgrade` (the webhook and reconciliation worker used it; both are replaced) and for `paginateBillingHistoryBySchool`, `BillingHistory`, `paystackAuthorizationCode`: nothing should use them.

## 3. Wiring
- `routes/index.ts`: `/billing` -> `billing.routes` (school host), `/platform/subscriptions` -> `billing.platform.routes` (admin host).
- `worker.ts`: import `billingWorker` (and keep `paymentReconciliationWorker`), call `scheduleBilling()` once at start. Needs BullMQ 5.16+.
- `registerSubscriptions` after `registerPlans`, `registerAuth`, `registerFoundation`.
- `entitlementsService.invalidate(schoolId)` is called after every plan change (assumed to exist, as documented in section 8.2).
- Optional: `webhook-entry.controller.ts` can answer 401 for an invalid signature (today it answers 200 for everything).

## 4. What was wrong, and is now fixed
- **Cards could never be saved**: the provider never returned the authorization code, so auto-renew could never turn on. Now returned (with signature, expiry, bank); codes are stored encrypted; the same card is never saved twice.
- **Cancelled schools were still charged** at period end (the renewal job ignored `cancelAtPeriodEnd`). Cancelling now voids the renewal invoice and the school moves to Free at period end; nothing is charged.
- **Double charging**: renewals used a random reference, so a crash between charging and saving would charge twice. References are now deterministic (`<invoice>-A<n>`), claimed atomically, and an unknown outcome (timeout) is verified later, never retried blindly.
- **Wrong email on saved-card charges**: Paystack needs the checkout email; it is stored with the card and used.
- **Free plan schools "expired" every month** and received "your subscription has expired" notices. Free periods now just roll forward.
- **Scheduled downgrades gave a free month** at the new plan and ignored usage. A downgrade now creates a normal renewal invoice at the new price, and is cancelled (school told why) if usage exceeds the new plan's limits when it comes due. Scheduling is refused up front with the exact numbers.
- **Payments were verified loosely**: the amount and currency must match the attempt; any school admin could verify another school's reference (now "not found"); a payment on a paid invoice is recorded as a duplicate, never applied twice; applying locks the invoice so the webhook, the return visit and the reconciliation job cannot collide.
- **Pricing**: upgrades charged the full price. Now prorated (see below), with the setup fee charged once, coupons applied to the plan charge, and a preview that is the same calculation as the real charge.
- **Open redirect**: the checkout return address came from the client; now built by the server.
- **Platform plan change** restarted the billing period for free; now a recorded complimentary change with a reason.
- **Webhook**: fee-payment events had no school context and failed silently; now routed through the school found in the payment's metadata. Events are logged once and repeats ignored.
- **A school that owed money could not see its own subscription** (past_due was excluded); fixed.
- Listing and stats ran one or two database queries per row; now one query. "MRR trend" was really revenue; it is now `revenueKobo`-style data under the old `mrrKobo` key, plus a real `mrrKobo` in stats.

## 5. How billing works now
- **Upgrade inside a paid period, same cycle**: keep the renewal date, charge the price difference for the remaining days. **Anything else** (from Free, from a trial, monthly <-> yearly): new period from today at full price, minus a credit for unused paid time. Credit beyond the amount due is not refunded or carried over.
- **Renewal**: invoice created 3 days before the period ends; reminders at 7, 3 and 1 days (each sent once); card charged on the due date if auto-renew is on, retried on days +1, +3, +5, +7 inside the grace period; each failure tells the school with a pay link; non-card schools pay the invoice by link or bank transfer (platform staff confirm it with `mark-paid`).
- **Past due**: from the due date; the school keeps its plan and features. **Grace over** (platform setting, default 7 days): moved to Free with all data kept; `restorePlan` offers the lost plan; paying restores it and the saved card is kept.
- **Cancel**: at period end (or immediately): moves to Free, never locks out.
- Subscription money goes to the platform's own Paystack account; never to a school's subaccount.
- `requireGoodStanding` (new guard) is for the records modules to put on new enrolments and score entry only.

## 6. Routes (frontend contract)
School (`/billing`): `GET /` (summary: subscription, plan with features, `standing`, `graceEndsAt`, `upcomingInvoice`, `openInvoices`, `paymentMethod`, `scheduledDowngrade`, `restorePlan`, `usage[]`), `POST /preview`, `POST /change-plan` (returns `requires_payment` with `authorizationUrl` + `reference`, or `applied`), `GET /verify?reference=` (call on return from checkout), `GET /invoices`, `GET /invoices/:id`, `POST /invoices/:id/pay`, `POST/DELETE /downgrade`, `POST /cancel` `{immediately?}`, `POST /resume`, `PUT /auto-renew`, `GET /payment-methods`, `DELETE /payment-methods/:id`. The checkout returns to `<school url>/billing/callback?reference=...`; the frontend page calls `/billing/verify`.
Platform (`/platform/subscriptions`): `GET /`, `GET /stats`, `GET /invoices` (`?overdue=true`), `PUT /invoices/:id/void`, `PUT /invoices/:id/mark-paid`, `GET /:schoolId`, `PUT /:schoolId/plan`, `PUT /:schoolId/extend`.
Removed: the old `/subscriptions/...` routes, `deactivate` and the free-form create-subscription (registration and the platform create the subscription).
New codes: PLAN_UNAVAILABLE, NO_PLAN_CHANGE, NOT_AN_UPGRADE, NOT_A_DOWNGRADE, USE_DOWNGRADE, COUPON_INVALID, DOWNGRADE_BLOCKED (details.violations), INVOICE_NOT_PAYABLE, AUTO_RENEW_NEEDS_CARD, PAYMENT_UNAVAILABLE, PAYMENT_OVERDUE, INVALID_EXTENSION.
New permissions: `billing.view`, `billing.manage`, `platform.subscriptions.view`, `platform.subscriptions.manage`. School Admin has them all; consider `billing.view` for Bursar and Principal in the console.

## 7. Decisions made
- A coupon discounts the first (plan) charge it is used on, once; there is no recurring discount (coupons have no duration field).
- Moving a lapsed school back is a normal upgrade (new period, full price).
- Cancellation never deletes or locks anything.

## 8. Not built (small, add when needed)
Per-school "send invoice" collection for enterprise schools (they can already pay by link and be confirmed manually), a dedicated "update card" flow (a card is saved from any card payment), VAT, refunds, billing emails moved into message templates (wording is in one file, `billing.messages.ts`), trials as a self-serve option.
Existing dev subscriptions created before this pass have the default anchor day (1); new paid periods set it correctly.

## 9. Docs update (section 0.3)
Tables: SubscriptionInvoice(+Item), PaymentAttempt, PaymentMethod, WebhookEvent, BillingNotice, PlatformSequence. Subscription +3. Permissions +4. Section 13 decisions implemented. Defects closed: payment references, double-charge, cancelled-still-charged, free-plan expiry, webhook tenant context. Modules done: plans, subscriptions, payments webhook entry.
