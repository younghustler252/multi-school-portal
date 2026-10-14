# Plans module pass: apply notes

## 1. Schema (public.prisma), then migrate
`Plan`: add `systemKey String? @unique`; give the two legacy columns defaults so new plans no longer need them:
`studentLimit Int @default(0)`, `staffLimit Int @default(0)` (they and `features` are dropped in the final cleanup; nothing reads them after this pass).

## 2. Apply
1. **Delete** from the old plans module: `domain/plan-features.interface.ts`, `domain/plan.enums.ts`, `usecases/public/`, `usecases/super-admin/`, the old routes file.
2. **Search the codebase** for `studentLimit`, `staffLimit`, `plan.features`, `PlanFeatures`, `FREE_FEATURES` and `PlanErrorMessage`. After this pass nothing should use them (the dashboard and feature gate already use entitlements). Anything left needs converting to entitlements.
3. **Copy** `modules/plans/*` and the two `foundation/` files (`permissions.registry.ts`, `sync-registries.ts`, which replace the versions from the previous update).
4. **Mount routes** in `routes/index.ts`: `/plans` -> `plan.routes` (public), `/platform/plans` -> `plan.platform.routes`.
5. **Run the registry sync once.** It now also seeds the default plans:
   - plans that already exist by name (made before this pass) are ADOPTED: they get the system key and, if they have no features, the default features. Prices are never changed.
   - missing plans are created. Nothing existing is overwritten.
6. Register `platform.plans.view` and `platform.plans.manage` (done automatically by the sync) and give them to the platform roles that need them.

## 3. What changed
- A plan is now prices + identity. What it INCLUDES is a list of feature lines (entitlements): on/off features, numeric limits (null = unlimited) and choices. The old fixed JSON of flags is gone.
- The built-in Free plan is found by its **system key**, not its name, so renaming it in the console can never break registration. It cannot be deactivated or given a price.
- Plans are never hard-deleted. A plan can be **deactivated** (nobody new can choose it) only when no school uses it; it can be reactivated.
- Price rules: a paid plan needs both monthly and yearly prices; yearly can never exceed twelve monthly payments; a free plan has no price.
- A price change tells you how many subscribed schools it affects (`subscribersAffected`).
- The old public `GET /plans/:id` exposed private and custom plans; it now answers "not found" for them.
- Seeds no longer advertise features that do not exist yet (multiple branches, API access, WhatsApp). The guardian portal is on for every plan (see decision below); report-card letterhead is in Standard and above (it was in no plan before). All of it is editable in the console.

## 4. Routes (frontend contract)
Public (`/plans`): `GET /plans` and `GET /plans/:id` return public, active plans with `entitlements[]` (only what the plan grants), `yearlySavingsPercent`, `isFree`.
Platform (`/platform/plans`): `GET /`, `POST /`, `GET /:id` (full feature matrix: every feature with `granted`, `value`, `unlimited`, `isActive`), `PUT /:id`, `PUT /:id/entitlements`, `PUT /:id/deactivate`, `PUT /:id/reactivate`, `POST /:id/clone`.
- `PUT /:id/entitlements` body: `{ entitlements: [{ featureKey, boolValue | limitValue (null = unlimited) | enumValue | remove: true }] }`. Only the lines sent change. Errors: `UNKNOWN_FEATURE`, `INVALID_ENTITLEMENT`.
- Removed: `POST /plans/seed` (the registry sync does it), the `studentLimit` / `staffLimit` / `features` fields on plans.
- New codes: SYSTEM_PLAN_PROTECTED, PLAN_HAS_SUBSCRIBERS, INVALID_PRICE, UNKNOWN_FEATURE, INVALID_ENTITLEMENT.

## 5. Decisions made (change in the console any time)
- Guardian portal on for **all** plans (parents seeing results and fees is core value and drives school adoption). The gate `portal.guardian` still exists, so you can restrict it later.
- Free plan limits 50 students / 5 staff (unchanged); Premium unlimited.

## 6. Notes
- A plan edit reaches schools within the entitlements cache window (30 seconds).
- Docs update (section 0.3): `Plan` +`systemKey`; permissions `platform.plans.view|manage`; plans module Done.
