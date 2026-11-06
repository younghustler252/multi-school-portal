# Plans Module

> **Source snapshot:** refactor/modules, reviewed 2026-11-06. This guide documents platform plan catalog management and per-plan feature/limit entitlements. Test sources were not found in the inspected test tree; no runtime checks were executed.

## Responsibility and boundaries

Plans owns the platform subscription catalog:
- Free/default and paid plan records.
- Monthly/yearly/setup pricing, visibility and activation.
- Platform CRUD, clone, status and ordering.
- Per-plan feature grants, booleans, limits and quotas.
- Public plan listing/detail for school onboarding and upgrade UI.
- Default system plan synchronization.

Subscriptions owns a school's active subscription, billing invoices, payment attempts, renewals, dunning and plan changes. Entitlements consumes plan grants to enforce route features and limits. Plan changes can affect renewal pricing; existing invoices retain their amount snapshot.

## Runtime composition and route mounts

Registered in apps/api/src/routes/index.ts:
- /api/v1/plans — public plan catalogue.
- /api/v1/platform/plans — platform plan administration.

Platform routes require platform-realm permissions. Public routes expose only active/public plans. Plan entitlement updates are applied in a tenant-independent platform transaction and become visible to school entitlement checks after the EntitlementsService cache window (30 seconds).

## HTTP endpoints

### Public — base /api/v1/plans

| Method | Path | Behavior |
|---|---|---|
| GET | / | List active, public plans with public feature descriptions |
| GET | /:id | Read one active, public plan |

### Platform — base /api/v1/platform/plans

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | / | platform.plans.view | List plans |
| POST | / | platform.plans.manage | Create plan |
| GET | /:id | platform.plans.view | Read plan and entitlements |
| PUT | /:id | platform.plans.manage | Update plan metadata/pricing |
| POST | /:id/clone | platform.plans.manage | Clone plan and entitlements |
| POST | /:id/deactivate | platform.plans.manage | Deactivate if no active/trialing/past-due subscribers |
| POST | /:id/reactivate | platform.plans.manage | Reactivate plan |
| PUT | /:id/entitlements | platform.plans.manage | Add/update/remove plan feature grants |
| PUT | /reorder | platform.plans.manage | Update display order |

## Plan fields and pricing rules

Plan records include name, unique slug/system key, description, monthly/yearly/setup price in kobo, trial days, active/public flags, sort order and optional custom/system-plan metadata.

- Prices are non-negative whole kobo.
- Yearly price cannot exceed 12× monthly price.
- A zero-price plan must be free on both monthly and yearly cycles.
- System Free plan is protected from deactivation and price changes.
- System plans are not deleted; deactivate custom plans when no current subscribers remain.
- Existing subscribers are not automatically migrated when a plan is deactivated.
- Price changes affect future invoices/renewals; already-issued subscription invoices retain their amount.

The default system plans are Free, Starter, Standard and Premium. Seed synchronization preserves existing platform plan edits and only repairs the baseline when appropriate; it does not overwrite a customized system plan.

## Entitlement model

Each plan can grant a feature as:
- BOOLEAN: enabled/disabled.
- LIMIT: numeric capacity; null means unlimited, zero means no capacity.
- QUOTA: numeric allowance; null means unlimited, zero means no allowance.

Feature definitions are separate platform records with key, type, description, category, unit, active state and optional default value. Plan grants reference a feature definition and store boolean/limit values.

The Plans module normalizes writes against the feature definition type:
- BOOLEAN requires boolean value.
- LIMIT/QUOTA requires a non-negative integer or null for unlimited.
- Unknown keys and mismatched value types are rejected.
- remove=true deletes a grant.
- Changes are written transactionally; a single audit event records changed grants.

The EntitlementsService resolves the current school's subscription plan and grants. It caches plan entitlements for 30 seconds. A missing grant denies active features; a feature definition marked inactive is treated as not yet enforced by the current entitlement service. Limits are enforced against usage meters by the corresponding feature/limit checks.

## Public plan presentation

Public endpoints include only active/public plans. The public entitlement description is intended to expose only active feature definitions and plan grants. Platform endpoints include inactive definitions for administration.

The public mapper returns feature labels and granted/value/unlimited metadata. There is a source mismatch for LIMIT/QUOTA grants with limitValue=0: the public description currently treats any grant row as granted, while EntitlementsService denies zero-limit access. See REM-062.

## Deactivation and subscription relationship

Deactivation checks the number of subscriptions in trialing, active or past_due states and refuses while any exist. The plan remains in the database for historical invoices/subscriptions. Public listing excludes it after deactivation.

The deactivation check does not account for open plan-change invoices targeting that plan. Subscription payment application later uses the plan ID stored on the invoice and does not revalidate that the target plan remains active. A plan may therefore be deactivated after an upgrade invoice is issued but before that invoice is paid; a later payment can activate the inactive plan. See REM-064.

## Tests and verification status

No dedicated plans test suite was found in the inspected apps/api/tests tree. Plan CRUD, public catalogue, entitlement matrix, clone/deactivation and cache behavior therefore have no module-specific automated test evidence in this review.

Not executed: tests, typecheck, build, migrations, public/platform HTTP requests, plan-entitlement cache timing or subscription lifecycle integration.

## Open implementation and verification items

1. **Zero-limit grants are shown as granted publicly.** A LIMIT/QUOTA grant with limitValue=0 is denied by entitlement enforcement but displayed as granted by PlanEntitlementService.describe. Align public grant metadata with enforcement; add public-plan and enforcement parity tests.
2. **Plan create/clone and entitlement copy are separate writes.** If entitlement normalization/application or clone copying fails after plan creation, an incomplete plan can remain. Make plan + initial grants one transaction or implement explicit rollback/repair.
3. **Deactivation can race with open plan-change invoices.** An invoice can target a plan that is later deactivated; payment application does not recheck plan active status. Decide whether open invoices reserve plan availability or whether payment should reject/refund/convert the invoice after deactivation.
4. **No dedicated plan/entitlement tests were found.** Add tests for public visibility, pricing rules, system-plan protections, clone atomicity, zero-limit presentation, feature type validation, deactivation with active subscriptions/open invoices and cache expiry.
5. **Verify system plan/feature seeds against production database.** The source seed is conservative and does not overwrite custom edits; drift from the expected baseline needs an explicit migration/repair procedure.

## Source paths reviewed

- apps/api/src/modules/plans/routes/plan.routes.ts
- apps/api/src/modules/plans/routes/plan.platform.routes.ts
- apps/api/src/modules/plans/controllers/
- apps/api/src/modules/plans/dtos/plan.dto.ts
- apps/api/src/modules/plans/domain/plan.policy.ts
- apps/api/src/modules/plans/services/plan-entitlement.service.ts
- apps/api/src/modules/plans/usecases/
- apps/api/src/modules/plans/repositories/
- apps/api/src/modules/plans/plans.permissions.ts
- apps/api/src/modules/plans/plans.seed.ts
- apps/api/src/modules/subscriptions/services/billing-engine.service.ts
- apps/api/src/modules/subscriptions/services/plan-change.service.ts
- apps/api/src/foundation/entitlements.service.ts
- apps/api/src/routes/index.ts
- apps/api/prisma/public.prisma
