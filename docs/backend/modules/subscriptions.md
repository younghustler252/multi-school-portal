# Subscriptions and Billing Module

> **Source snapshot:** refactor/modules, reviewed 2026-11-06. This guide documents school subscriptions, plan changes, invoices, payment attempts, saved cards, lifecycle automation, platform support and billing webhooks. No dedicated subscription test suite was found; no runtime checks were executed.

## Responsibility and boundaries

Subscriptions owns the platform's commercial relationship with each school:
- The school's active subscription and billing cycle.
- Plan upgrades, scheduled downgrades, cancellation and renewal.
- Subscription invoices and payment attempts.
- Saved payment methods and auto-renew.
- Checkout, provider verification, webhooks and manual payment confirmation.
- Grace periods, retries/dunning, reminders, lapsed-to-Free transitions and invoice cleanup.
- Platform subscription management, billing stats and manual support actions.

Plans owns the plan catalog and entitlement grants. Entitlements consumes the subscription's current plan. The payment provider interface handles gateway calls. Shared Webhooks verifies signatures and dispatches provider events. This module's billing engine is the only code path that applies a subscription payment to subscription state.

## Runtime composition and route mounts

Registered in apps/api/src/routes/index.ts:
- /api/v1/subscriptions — school billing.
- /api/v1/platform/subscriptions — platform billing administration.

School routes derive schoolId from the verified tenant host and userId from authentication. Platform routes require platform-realm permissions. Billing is intentionally available to unverified schools so they can pay for a plan.

The subscription container registers SubscriptionRepository, InvoiceRepository, InvoiceService, CouponService, PlanChangeService, BillingEngine, BillingLifecycleService, BillingNotifier, school/platform use cases and the subscription webhook handler.

## HTTP endpoints

### School realm — base /api/v1/subscriptions

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | / | billing.view | Billing summary, plan, entitlements, usage, open invoices and payment method |
| POST | /preview | billing.view | Preview plan change/proration/coupon; creates nothing |
| POST | /change-plan | billing.manage | Start upgrade or billing-cycle change |
| GET | /verify | billing.manage | Verify checkout reference with provider |
| GET | /invoices | billing.view | List own school's invoices |
| GET | /invoices/:id | billing.view | Read own school's invoice |
| POST | /invoices/:id/pay | billing.manage | Start checkout for open invoice |
| POST | /downgrade | billing.manage | Schedule downgrade at period end |
| DELETE | /downgrade | billing.manage | Cancel scheduled downgrade |
| POST | /cancel | billing.manage | Cancel immediately or at period end |
| POST | /resume | billing.manage | Resume a scheduled cancellation |
| PUT | /auto-renew | billing.manage | Enable/disable automatic renewal |
| GET | /payment-methods | billing.view | List saved methods (masked) |
| DELETE | /payment-methods/:id | billing.manage | Remove saved method |

billing.view is ALL/STAFF within the current school. billing.manage is ALL/STAFF and sensitive.

### Platform realm — base /api/v1/platform/subscriptions

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | / | platform.subscriptions.view | Paginated subscriptions |
| GET | /stats | platform.subscriptions.view | MRR/ARR, collections, overdue, status and plan distribution |
| GET | /invoices | platform.subscriptions.view | Platform invoice list/filter |
| PUT | /invoices/:id/void | platform.subscriptions.manage | Void open invoice with reason |
| PUT | /invoices/:id/mark-paid | platform.subscriptions.manage | Confirm offline bank transfer |
| GET | /:schoolId | platform.subscriptions.view | One school's billing detail |
| PUT | /:schoolId/plan | platform.subscriptions.manage | Complimentary/support plan change |
| PUT | /:schoolId/extend | platform.subscriptions.manage | Extend billing period by 1–90 days |

Platform view is read-only; manage is sensitive. The platform can apply a complimentary plan change using a zero-value invoice so the history explains why a school received the plan.

## Plan change and proration

Preview and change call the same PlanChangeService.prepare path so the quote logic is shared.

- Target plan must exist and be active.
- Private plan can only be chosen by the school already on it or restored from lapsedPlanId.
- A paid plan is required for an immediate upgrade/cycle switch; free plans are handled as downgrades.
- Same plan + same cycle is rejected unless the subscription is trialing.
- A change to a cheaper monthly-equivalent plan is not an immediate upgrade.
- Coupon is validated by code, active window and maxUses; discount applies only to plan charge, not setup fee.
- Proration uses current period start/end, target plan price, cycle and setup-fee history.
- Existing open upgrade invoices are voided before a new upgrade invoice is created.
- A zero-total invoice is applied immediately without gateway payment.
- A positive invoice starts provider checkout; callback URL is generated server-side from the school's verified custom domain/subdomain.

Downgrades are scheduled for the current period end. Usage is checked when requested and checked again at renewal time; if the target plan is no longer active or usage exceeds its limits, the scheduled downgrade is cancelled and the school is notified.

## Invoice and payment-attempt lifecycle

Subscription invoices snapshot plan ID, billing cycle, reason, period, subtotal, discount, total, coupon, due date and line items. Existing invoice amounts do not change when a plan's price changes.

Invoice reasons include renewal, upgrade and adjustment. Invoice statuses include open, paid, void and uncollectible.

Payment attempts have a unique provider reference and amount, method (checkout, saved_card, manual), status (pending/success/failed/abandoned), provider status and failure reason.

BillingEngine is the only payment-application path:
1. Start a checkout or saved-card attempt.
2. Verify the provider transaction by reference; never trust browser success.
3. Require provider amount and currency to match the attempt.
4. Lock the invoice row in a transaction.
5. Mark attempt success and, if invoice is still payable, apply invoice to subscription.
6. Update subscription plan/cycle/period/status, save reusable card when authorized, mark invoice paid and void superseded open invoices.
7. After commit, invalidate entitlement cache, audit and notify.

Duplicate success for an already-paid invoice is recorded as duplicate and not applied twice. A success for a void invoice is recorded as paid_on_void and audited but not applied. Amount/currency mismatch is marked failed and audited. These exceptional captured-money paths need an operational recovery/refund process; see remediation register.

## Saved cards and automatic renewal

- Card authorization code is encrypted before storage; API only returns brand, last4, expiry and bank.
- A card can be saved only when provider verification returns a reusable card authorization.
- The current card is set as default; older active methods are unset.
- Enabling auto-renew requires a saved payment method.
- Removing the card used by the subscription selects another saved method if available; otherwise auto-renew is disabled and open renewal invoices stop auto-charging.
- Saved-card charge claims the next attempt number with an atomic invoice attemptCount update before calling the provider.
- A timeout/unknown provider outcome remains pending and is reconciled by reference; it is not charged again blindly.
- Failed saved-card attempts schedule retry offsets within the platform grace period.

## Hourly billing lifecycle

BillingLifecycleService runs nine ordered steps; each step/item catches errors so one school/invoice failure does not stop the batch:

1. Reconcile pending gateway attempts older than the configured recheck interval.
2. Roll Free subscriptions forward; Free plans do not expire.
3. Apply period-end cancellation or scheduled move to Free.
4. Create renewal invoices three days before period end; use a stable idempotency key per subscription/period.
5. Send period reminders once per subscription/period/threshold.
6. Charge saved cards whose nextAttemptAt is due.
7. Mark subscriptions past_due when an open renewal invoice is overdue; plan features remain during grace.
8. After grace expires, move the school to Free, remember the lapsed paid plan for restoration, and mark unpaid invoices uncollectible.
9. Void unpaid upgrade invoices older than seven days.

The default grace period is read from platform settings, not school Finance Settings. The platform billing summary reports standing, graceEndsAt, upcoming/open invoices, card and usage.

## Cancellation, restore and platform support

- Scheduled cancellation disables auto-renew and voids open renewal invoices; the school retains its paid plan until period end.
- Immediate cancellation moves to Free now.
- Lapse moves to Free but stores lapsedPlanId so a school can restore its former plan; data is not touched.
- Restoring a lapsed plan is a normal paid plan change.
- Platform can move a school to a paid plan using a zero-value complimentary adjustment invoice, or to Free using the lifecycle move.
- Platform can extend a period by 1–90 days; open renewal invoices are voided and billing dates updated.
- Platform can void an open invoice or mark an offline bank transfer paid with a unique manual reference.

## Coupon behavior

CouponService validates active state, validity window and maxUses before quote creation. Percentage discount is capped at 100%; fixed discount cannot exceed plan charge. Coupon usage increments only when the invoice is successfully applied. The increment is conditional on maxUses but the current code does not check whether the conditional update changed a row; see remediation item REM-067.

## Persistence and data types

Public models include Plan, PlanEntitlement, FeatureDefinition, Subscription, Coupon, SubscriptionInvoice, SubscriptionInvoiceItem, PaymentAttempt, PaymentMethod and WebhookEvent.

Pricing/invoice/payment-attempt amounts are Prisma Int (32-bit signed integer) in the public schema, not BigInt. The plan DTO currently accepts values up to 10,000,000,000 kobo, above the database Int maximum of 2,147,483,647. See REM-065.

Subscription has a non-unique index on schoolId/status; findActiveBySchoolId selects the newest row among LIVE_STATUSES. There is no database partial unique constraint guaranteeing one live subscription per school. This is a data-integrity watch item for provisioning/retry paths.

## Tests and verification status

No dedicated subscriptions/billing test suite was found in the inspected apps/api/tests tree. No automated test file was found for:
- BillingEngine checkout/verify/apply/mismatch/duplicate behavior.
- BillingLifecycle nine-step scheduler/dunning.
- Coupon maxUses concurrency.
- Plan change/proration and competing invoice behavior.
- Platform manual payment/extension/void.
- Webhook tenant/reference handling.

Not executed: tests, typecheck, build, migrations, provider sandbox, webhook signature flow, lifecycle worker, PostgreSQL concurrency or live HTTP requests.

## Open implementation and verification items

1. **Multiple pending checkout attempts can be created for one invoice.** startCheckout checks invoice status, counts attempts and creates a new reference but does not reuse/claim an existing pending attempt. Repeated/concurrent pay requests can create multiple live checkouts; if both are paid, the second is recorded as duplicate but the gateway money has already been captured.
2. **Lifecycle state changes can race with successful payment application.** past-due updates a subscription based on a previously queried open invoice; lapse/cancel moves subscription to Free and updates invoices without locking/rechecking invoice/subscription state. A payment confirmed concurrently can be overwritten by a stale past-due/lapse transition.
3. **Different invoices for one subscription are not serialized on the subscription row.** applyPaid locks the invoice row, not the subscription. Renewal and upgrade invoices can be paid concurrently and both attempt to update the same subscription period/plan.
4. **Coupon maxUses is not enforced atomically at application.** The conditional usedCount increment's affected-row count is ignored; two invoices can both receive a discount even if only one remaining use exists.
5. **Successful charges that cannot be applied have no recovery workflow.** paid_on_void, duplicate payment and amount mismatch are audited but not refunded or placed into a clearly actionable manual-reconciliation queue. Captured money can remain unmatched while the invoice is void/paid or still open.
6. **Platform overdue query uses z.coerce.boolean.** Query string overdue=false coerces to true because Boolean("false") is true; use explicit true/false parsing.
7. **Plan/invoice amount DTO max exceeds Prisma Int capacity.** Align max to 2,147,483,647 or migrate pricing/invoice/payment-attempt amounts to BigInt consistently.
8. **Plan deactivation with open invoices is not handled.** See REM-064.
9. **No subscription/billing HTTP, lifecycle or database concurrency tests were found.** Add tests for checkout attempts, duplicate success, late success on void, mismatch, coupon limits, lifecycle races, invoice locking and webhook verification.
10. **Verify one-live-subscription-per-school invariant.** Subscription.schoolId is not unique and findActiveBySchoolId returns the newest live row. Confirm all provisioning/bootstrap paths are idempotent and enforce one live subscription at the database boundary.

## Source paths reviewed

- apps/api/src/modules/subscriptions/routes/billing.routes.ts
- apps/api/src/modules/subscriptions/routes/billing.platform.routes.ts
- apps/api/src/modules/subscriptions/controllers/
- apps/api/src/modules/subscriptions/dtos/subscription.dto.ts
- apps/api/src/modules/subscriptions/domain/
- apps/api/src/modules/subscriptions/subscriptions.permissions.ts
- apps/api/src/modules/subscriptions/services/billing-engine.service.ts
- apps/api/src/modules/subscriptions/services/billing-lifecycle.service.ts
- apps/api/src/modules/subscriptions/services/billing-notifier.service.ts
- apps/api/src/modules/subscriptions/services/coupon.service.ts
- apps/api/src/modules/subscriptions/services/invoice.service.ts
- apps/api/src/modules/subscriptions/services/plan-change.service.ts
- apps/api/src/modules/subscriptions/usecases/
- apps/api/src/modules/subscriptions/repositories/
- apps/api/src/modules/subscriptions/webhooks/subscription.webhook-handler.ts
- apps/api/src/modules/plans/services/plan-entitlement.service.ts
- apps/api/src/foundation/entitlements.service.ts
- apps/api/src/routes/index.ts
- apps/api/prisma/public.prisma
- apps/api/prisma/migrations/20261016225920_add_billing_engine/migration.sql
