# Branches Module

> **Verification status:** Partially source-verified. Routes, controller, DTOs, command/query use cases, mapper, repository, permission declarations and DI registration were inspected. Prisma migration history, focused test coverage and runtime behavior were not inspected in this pass.
> **Source snapshot:** `refactor/modules`, source snapshot recorded in the foundation guides as `23a5e0a5538f747de27ddff29b24a913791eaac2` (2026-11-05).
> **Primary source:** `apps/api/src/modules/branches/`
> **Route mount:** `/api/v1/branches`, registered in `apps/api/src/routes/index.ts`.

## 1. Responsibility and boundaries

The Branches module manages a school's physical/organizational branches:

- List branches visible to the current staff member.
- Resolve the active branches available to the current user (`/mine`).
- Read a branch and list its active staff members.
- Create, update, deactivate, reactivate and soft-delete branches.

Staff-to-branch assignment is owned by the Staff module, through `PUT /api/v1/staff/:id/branches`. Branch management does not replace that workflow.

## 2. Data ownership and dependencies

Branch records are tenant-schema data. `BranchRepositoryImpl` extends `BaseTenantRepository`, uses the tenant Prisma model `branch`, and enables soft deletion. A branch is retained because historical school records may continue to reference it.

The module uses:

- `BranchMapper` for domain and response projection.
- `BranchRepositoryImpl` for tenant persistence.
- `BranchUsageService` to determine whether a branch is still referenced.
- `AuditService` for create/update/status/delete events.
- The plan feature gate for the school's branch allowance.
- Tenant Prisma access to validate a proposed principal against an active staff record.

The container registers the mapper as a singleton and the repository, usage service, use cases and controller as scoped dependencies. The container comment identifies Audit as a required registration dependency.

## 3. Authorization and scope

All routes require authentication and tenant context.

| Permission | Supported scope | Behavior |
|---|---|---|
| `branches.view` | `ALL`, `BRANCH` | Read all branches or only branches assigned to the staff member |
| `branches.manage` | `ALL` | Create and administer branches |

Both permissions are declared for the `STAFF` persona. The query use case independently applies branch visibility: `ALL` returns all branches; otherwise results are restricted to `access.branchIds`. The single-branch query also checks membership in that branch set.

The branch-members endpoint uses the `branches.manage` route guard and returns staff assigned to the requested branch. The use case checks that the branch exists; the route permission is the access boundary for this endpoint.

## 4. API endpoints

All paths are under `/api/v1/branches`.

| Method and path | Access | Purpose |
|---|---|---|
| `GET /` | Authenticated, tenant, `branches.view` | List visible branches; query `includeInactive=true` includes inactive rows |
| `GET /mine` | Authenticated, tenant, `branches.view` | List active branches visible to the caller |
| `POST /` | Authenticated, tenant, `branches.manage`; CreateBranchDto | Create a branch |
| `GET /:id` | Authenticated, tenant, `branches.view` | Get one visible branch |
| `GET /:id/members` | Authenticated, tenant, `branches.manage` | List active staff assigned to a branch |
| `PUT /:id` | Authenticated, tenant, `branches.manage`; UpdateBranchDto | Update branch details |
| `PUT /:id/deactivate` | Authenticated, tenant, `branches.manage` | Deactivate branch |
| `PUT /:id/reactivate` | Authenticated, tenant, `branches.manage` | Reactivate branch |
| `DELETE /:id` | Authenticated, tenant, `branches.manage` | Soft-delete an eligible branch |

## 5. Request contracts

### CreateBranchDto

Strict object; unknown properties are rejected.

| Field | Type and constraints | Required |
|---|---|---|
| `name` | Trimmed string, 2–100 characters | Yes |
| `code` | Trimmed, uppercased, 2–6 alphanumeric characters | No; generated from name |
| `address` | String, max 200 | No |
| `city` | String, max 100 | No |
| `state` | String, max 100 | No |
| `phone` | String, 7–30 characters | No |
| `email` | Shared email validator | No |
| `principalStaffId` | Non-empty string, max 64 | No |

### UpdateBranchDto

Strict object; at least one property is required. `name` is 2–100 characters. Address, city, state, phone, email and `principalStaffId` may be nullable to clear them. The code is deliberately not editable. Phone, email and ID constraints match the create DTO where applicable.

## 6. Response projection

The branch mapper returns:

`id`, `name`, `code`, `isMain`, `address`, `city`, `state`, `phone`, `email`, `principalStaffId`, `isActive`, `createdAt`.

The branch-members use case returns rows containing `staffId`, `employeeId`, `name`, `category`, `designation`, `isPrimary` and `assignedAt`.

The controller uses the shared `sendSuccess` and `sendCreated` response helpers. Exact envelope serialization is owned by the shared API response utility.

## 7. Business rules and lifecycle

- Branch names are compared case-insensitively.
- Branch codes are unique. If omitted, a code is derived from the branch name and suffixed to find an available value.
- The main branch is created by the school's provisioning/setup path; this module creates additional branches with `isMain: false`.
- Creating a branch checks the school's `branch` plan limit.
- A supplied principal must identify an active staff record in the same tenant.
- The branch code is permanent.
- Deactivation is refused for the main branch and for any branch with usage reported by `BranchUsageService`.
- Reactivation checks the plan limit again.
- Deletion is permitted only for a non-main, inactive, empty branch. Repository deletion is soft deletion.
- No-op updates and repeated active/inactive transitions return the existing mapped branch without writing another change.
- Mutations emit audit events: `branch.created`, `branch.updated`, `branch.deactivated`, `branch.reactivated`, `branch.deleted`.

## 8. Frontend integration requirements

- Obtain the school context from the school host/session; do not send a school ID in branch request bodies.
- Use `GET /mine` for the caller's active branch choices, not a locally inferred list.
- Treat branch codes as read-only after creation.
- Support nullable update values to clear optional contact/location/principal fields.
- Display plan-limit and branch-in-use errors as actionable domain failures; do not assume deactivation is always allowed.
- Staff assignment is a separate Staff-module operation. Do not implement branch membership by editing the Branch resource.
- A branch-limited staff member sees only their assigned branches. Do not assume every authenticated staff account can enumerate the entire school.

## 9. Tests and verification gaps

The test suite and migration history were not inspected for this guide. No tests, migrations, build or runtime requests were executed. Before marking this guide fully verified, inspect branch use-case/repository tests, tenant schema constraints and the `BranchUsageService` dependency inventory.

## 10. Source files reviewed

- `routes/branch.routes.ts`
- `controllers/branch.controller.ts`
- `dtos/branch.dto.ts`
- `usecases/branch-queries.usecases.ts`
- `usecases/branch-commands.usecases.ts`
- `mappers/branch.mapper.ts`
- `repositories/branch.repository.impl.ts`
- `services/branch-usage.service.ts` (registered dependency; implementation review remains outstanding)
- `branches.permissions.ts`
- `branches.container.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/src/container/index.ts`
