# Branches foundation: apply notes

## 1. Schema
**Both schemas** (`public.prisma` AND `tenant.prisma`): the enum must match in both.
```prisma
enum PermissionScope { ALL BRANCH ASSIGNED OWN }
```
**`tenant.prisma`**: add
```prisma
model Branch {
  id               String    @id @default(uuid())
  name             String
  code             String    @unique
  isMain           Boolean   @default(false)
  address          String?
  city             String?
  state            String?
  phone            String?
  email            String?
  principalStaffId String?
  isActive         Boolean   @default(true)
  createdById      String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  members MembershipBranch[]

  @@index([isActive])
  @@index([deletedAt])
}

// Which branches a staff member works in. A role held at BRANCH scope only works inside these.
model MembershipBranch {
  membershipId String
  branchId     String
  assignedAt   DateTime @default(now())
  assignedById String?

  membership Membership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  branch     Branch     @relation(fields: [branchId], references: [id])

  @@id([membershipId, branchId])
  @@index([branchId])
}
```
and add `branches MembershipBranch[]` to the existing `Membership` model.
Then create the **tenant migration** (new schools get it automatically) and the public migration (enum value).

**Schools that already exist in dev** do not get a new tenant migration by themselves. Easiest: delete the dev schools and register again. If you want to keep one, run the new migration SQL in its schema, plus:
```sql
DO $$ DECLARE s text; BEGIN
  FOR s IN SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'school_%' LOOP
    EXECUTE format('ALTER TYPE %I."PermissionScope" ADD VALUE IF NOT EXISTS ''BRANCH''', s);
  END LOOP; END $$;
-- and for each existing school: create its Main Campus and put its staff in it
-- INSERT INTO school_x."Branch"(id,name,code,"isMain","isActive","updatedAt") VALUES (gen_random_uuid(),'Main Campus','MAIN',true,true,now());
```

## 2. The plan limit (feature `branches.max`)
Add this entry to `FEATURE_REGISTRY` in `foundation/features.registry.ts` (same shape as the others; leave the old inactive `branches.multiple` entry as it is):
```ts
{ key: "branches.max", kind: "LIMIT", module: "branches", meterKey: "branches.active", unit: "branches",
  name: "Branches", description: "How many branches (campuses) the school can run",
  enforcement: "BLOCK", upsellMessage: "Upgrade your plan to add more branches.", isActive: true },
```
Run the registry sync. New plans get the seed (1 branch; Premium 3). **Existing plans** are never overwritten by the sync, so grant the limit once:
```sql
INSERT INTO "PlanEntitlement" ("planId","featureKey","limitValue")
SELECT id, 'branches.max', CASE "systemKey" WHEN 'premium' THEN 3 ELSE 1 END FROM "Plan"
WHERE "systemKey" IN ('free','starter','standard','premium') ON CONFLICT DO NOTHING;
```
(or set it from the plans console: `PUT /platform/plans/:id/entitlements`).

## 3. Apply
- New module `modules/branches/*`; add `registerBranches` after `registerFoundation` and mount `/branches` -> `branch.routes`.
- Replace: `foundation/access.service.ts`, `foundation/foundation.container.ts`, `foundation/permissions.registry.ts`, `foundation/role-templates.registry.ts`, `infrastructure/middleware/feature-gate.middleware.ts`, `infrastructure/repository/base.repository.ts`, `infrastructure/jobs/workers/provision-schema.worker.ts`, `modules/auth/services/membership.service.ts`, `modules/subscriptions/services/usage.service.ts`, `modules/plans/plans.seed.ts`.
- Run the registry sync. It creates `branches.view`, `branches.manage` and the new **Branch Principal** role template. The sync never edits an existing editable role, so add `branches.view` (scope ALL) to **Principal** in the console.

## 4. How it works
- Every school gets a **Main Campus** (code MAIN) when it is built. It cannot be deactivated or deleted; it can be renamed. While a school has one branch the app should hide branch pickers.
- **Creating a branch** is gated by the plan limit `branches.max` (the main branch counts as one): a plan with room for one answers `PLAN_LIMIT_REACHED` with the real limit. Reactivating a branch needs room too.
- A branch **code** (2 to 6 letters or digits) is permanent; it is made from the name if not given. Names are unique ignoring case.
- A branch **cannot be deactivated or deleted while active staff are assigned** (`BRANCH_IN_USE`). Each records module adds its own check to `BranchUsageService` (classes, students, fees) as it is built. Delete is a soft delete (hidden, history kept) and only for an inactive, unused, non-main branch.
- **Assigning staff**: `PUT /branches/assignments/:membershipId` `{ branchIds: [...] }` replaces the staff member's branches (staff only, branches must be active). New staff (invited, or the founding admin) start in the main branch automatically.
- **Scope BRANCH**: a role can hold a permission at BRANCH scope. The person then acts only in the branches they are assigned to. Inside any use case:
  ```ts
  const scope = access.branchScope("students.view");     // "ALL" | string[] | null
  const where = scope === "ALL" ? {} : Array.isArray(scope) ? { branchId: { in: scope } } : /* ASSIGNED or OWN: use that scope */ ...;
  access.canActInBranch("fees.view", branchId);            // yes/no for one branch
  ```
  `GET /branches` returns all branches for ALL scope, only the person's own for BRANCH scope; `GET /branches/mine` is the switcher list.
- Plan downgrade: the usage check now counts active branches, so a school cannot drop below the number of branches it runs.

## 5. Routes (school host, `/branches`)
`GET /` (`?includeInactive=true`), `GET /mine`, `GET /:id`, `GET /:id/members` (ids only; names come from the staff module), `POST /`, `PUT /:id`, `PUT /:id/deactivate`, `PUT /:id/reactivate`, `DELETE /:id`, `PUT /assignments/:membershipId`.
Permissions: `branches.view` (ALL or BRANCH), `branches.manage`. Codes: `MAIN_BRANCH_PROTECTED`, `BRANCH_IN_USE`, `INVALID_PRINCIPAL`, `INVALID_MEMBERSHIP`, `INVALID_BRANCHES`, `BRANCH_FORBIDDEN`, plus `PLAN_LIMIT_REACHED`.

## 6. Other changes in this drop
- `base.repository.ts` now supports **soft delete** (a repository sets `protected readonly softDelete = true`; reads hide deleted rows, `delete()` marks the row, `restore()` brings it back). Repositories that do not opt in behave exactly as before. This closes defect D10.
- `feature-gate`: the limit message had wrong plurals ("staffs"); fixed, and `branch` is a limit type.

## 7. Rules for the records modules (so nothing leaks between branches)
Every table that belongs to a place gets a `branchId` (classes first; students, attendance, invoices follow through their class or branch); every list query applies `access.branchScope(key)`; every create stores the branch of the thing it belongs to. A record with no branch is a leak waiting to happen.

## 8. Docs update (section 0.3)
Tenant tables: Branch, MembershipBranch. Enum PermissionScope + BRANCH (both schemas). Feature: `branches.max` (meter `branches.active`). Permissions: `branches.view|manage`. Role template: `branch_principal`. Defect D10 closed. Module status: branches Done.
