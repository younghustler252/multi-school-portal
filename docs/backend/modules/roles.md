# Roles and Permissions

> **Verification status:** Source-reviewed for role routes, controller, DTOs, use cases, repository, RBAC middleware, access service, permission registry, role-template synchronization and focused use-case tests. Registry synchronization and database/runtime behavior have not been executed in this documentation pass.
> **Source snapshot:** `refactor/modules`, source snapshot recorded as `23a5e0a5538f747de27ddff29b24a913791eaac2` (2026-11-05).
> **Primary source:** `apps/api/src/modules/roles/` and `apps/api/src/foundation/`
> **Route mounts:** `/api/v1/roles` and `/api/v1/permissions`.

## 1. Responsibility and boundaries

The Roles module manages each school's role definitions and role-to-permission grants. The Foundation layer owns the cross-module authorization model:

- The permission registry defines which permission keys exist, their realm, module, valid scopes and valid personas.
- Role templates define starting/default school roles and their permission grants.
- School schemas contain each school's copy of roles and their grants.
- The Access service resolves the current session's membership, roles, permissions, scopes and branch assignments.
- RBAC middleware enforces permissions at the route boundary; use cases apply scopes to data access.

The permission catalog is platform-owned metadata. A school can read it to build custom roles but cannot create arbitrary permission keys.

## 2. Data ownership

| Data | Location | Owner |
|---|---|---|
| Permission definitions | Public schema `PermissionDefinition` | Foundation permission registry/sync |
| Role templates | Public schema `RoleTemplate` and template grants | Foundation role-template registry/sync |
| School role copies | Tenant `SchoolRole` | School role sync and school role administration |
| School role grants | Tenant `SchoolRolePermission` | School role administration/sync |
| Membership-to-role links | Tenant `MembershipRole` | Membership/role assignment workflows |
| Platform members/roles/grants | Public schema platform membership and role tables | Platform authorization |

A school role is not a global role. The same template is copied into each school's schema, where the school's staff memberships are linked to the local role copy.

## 3. Authorization model

### Realms

- School sessions resolve access from tenant `Membership`, `SchoolRole` and `SchoolRolePermission`.
- Platform sessions resolve access from `PlatformMember`, `PlatformRole` and `PlatformRolePermission`.
- Permission keys beginning with `platform.` belong only to the platform realm. All other keys belong to the school realm.
- A platform session cannot act inside a school tenant; school access requires a school session or an audited impersonation flow.

### Personas

The current persona types are `STAFF`, `STUDENT` and `GUARDIAN`.

Custom roles are STAFF-only. Student and guardian roles are fixed, locked defaults assigned automatically by persona workflows.

### Scopes

Scopes are ordered from narrowest to widest:

| Scope | Meaning |
|---|---|
| `OWN` | Own record; for guardian access, own children |
| `ASSIGNED` | Assigned classes, subjects or students |
| `BRANCH` | Assigned school branches |
| `ALL` | Whole school |

When a membership has several roles, permissions are unioned and the widest scope for each permission key wins. A role with `grantsAll` holds every permission in its realm.

For BRANCH-scoped permissions, the Access service loads branch IDs from the staff member's `StaffBranch` assignments. Students and guardians do not have branch assignments.

**Important:** Access service computes the effective permission/scope. Individual module use cases remain responsible for applying the scope to database queries. A route guard alone does not automatically filter records.

### Access cache

The Access service caches resolved access for 15 seconds by realm and membership ID by default. Role/membership/branch changes must invalidate the cache. Role update and delete use cases explicitly invalidate the Access cache.

## 4. Role kinds and template behavior

The role model distinguishes:

| Kind | Meaning | School-side editing |
|---|---|---|
| `SYSTEM_LOCKED` | Critical platform-defined role | Cannot be edited or deleted |
| `SYSTEM_EDITABLE` | Platform-provided starting role | Can be renamed/described and customized |
| `CUSTOM` | School-created role | Can be edited; delete only when unused |

Current role templates include:

- `school_admin`: locked STAFF role with `grantsAll`.
- `student`: locked STUDENT default for STUDENT persona.
- `guardian`: locked GUARDIAN default for GUARDIAN persona.
- `principal`, `branch_principal`, `teacher`, `bursar`: editable STAFF templates.

The exact starting grants are maintained in `apps/api/src/foundation/role-templates.registry.ts` and should be reviewed there when permissions change.

### Template synchronization semantics

There are two synchronization layers:

1. **Platform template sync** (`syncRoleTemplates`):
   - New templates are created from code.
   - Locked templates have settings and permission grants enforced to match code exactly.
   - Editable templates receive missing grants from code; existing grants are not overwritten or removed by this sync.
   - Invalid permission keys, scopes, personas or realms are reported as conflicts.

2. **School role sync** (`syncSchoolRoles`):
   - Locked school roles are synchronized exactly to their templates.
   - Editable roles gain missing permissions only by default; they are not rescoped or pruned unless `--prune` is used.
   - Customized roles and custom roles are skipped.
   - Each school is processed in its own transaction; a school failure is rolled back and reported without stopping the whole run.

The school-role sync is run after registry/template sync. Review the script and target school set before executing it; do not assume a sync command is safe merely because it is documented.

## 5. API endpoints

All routes require authentication, school tenant context and the appropriate school permission.

### Roles — `/api/v1/roles`

| Method and path | Permission | Purpose |
|---|---|---|
| `GET /` | `roles.view` | List school roles; optional persona filter |
| `POST /` | `roles.manage` | Create a custom STAFF role |
| `GET /:id` | `roles.view` | Get role detail |
| `GET /:id/members` | `roles.view` | List active STAFF members holding the role |
| `PUT /:id` | `roles.manage` | Rename/describe and/or replace role permission set |
| `DELETE /:id` | `roles.manage` | Soft-delete an unused editable/custom role |

### Permission catalog — `/api/v1/permissions`

| Method and path | Permission | Purpose |
|---|---|---|
| `GET /` | `roles.view` | List the non-deprecated SCHOOL-realm permission catalog |

The permissions router is a separate router mounted at `/permissions` alongside the roles router.

## 6. Request DTOs

All role DTOs are strict; unknown fields are rejected.

### ListRolesQuery

- Optional `persona`: `STAFF`, `STUDENT` or `GUARDIAN`.

### CreateRoleDto

- `name`: trimmed, 1–80 characters.
- Optional `description`: nullable, max 500 characters.
- `permissions`: array of up to 200 objects; defaults to an empty array.
  - `key`: trimmed, 1–100 characters.
  - `scope`: `ALL`, `BRANCH`, `ASSIGNED` or `OWN`.
- Custom roles are always STAFF roles and never grants-all.

### UpdateRoleDto

- Optional `name`: trimmed, 1–80 characters.
- Optional `description`: nullable, max 500 characters.
- Optional `permissions`: up to 200 permission objects with `key` and `scope`.
- At least one field must be supplied.
- When `permissions` is supplied, it replaces the entire permission set; it is not merged with the existing set. Omit the property to leave grants unchanged.

### Route parameters

`id` must be a UUID.

## 7. Response contracts

All controller operations use the shared `{ success, message, data }` envelope. Create returns HTTP 201.

### Role summary

Role list and detail return role summaries with:

- `id`, `name`, `description`
- `kind`, `persona`
- `grantsAll`, `isCustomized`, `sourceTemplateKey`
- `editable` (false only for `SYSTEM_LOCKED`)
- `permissions: [{ key, scope }]`
- `memberCount`

### Role members

The members endpoint returns active STAFF membership rows mapped to:

- `membershipId`, `userId`, `assignedAt`
- `staffId`, `name`, `email`

### Permission catalog

Each entry includes:

- `key`, `module`
- `scopes`, `personas`
- `label`, `description`
- `isSensitive`

The catalog returns only SCHOOL-realm permissions that are not deprecated.

## 8. Role administration business rules

### Creating a role

1. Every requested permission key must exist in the public permission catalog.
2. The permission must allow the requested scope.
3. The permission must allow the STAFF persona.
4. The actor must hold every permission at a scope at least as wide as the requested grant.
5. A case-insensitive duplicate role name is rejected.
6. The new role is CUSTOM, STAFF and `grantsAll: false`.
7. Creation is audited.

This prevents a user with `students.view` at OWN scope from creating a role that grants `students.view` at ALL scope.

### Updating a role

- SYSTEM_LOCKED roles cannot be changed.
- Requested permission grants are validated and delegation-checked just as on create.
- A SYSTEM_EDITABLE role is marked `isCustomized` when its permission set is changed; the next school-role sync then skips it.
- Renaming/description changes alone do not mark a SYSTEM_EDITABLE role customized.
- A permission-set update replaces all grants transactionally.
- Access cache is invalidated and the change is audited.

### Deleting a role

- SYSTEM_LOCKED roles cannot be deleted.
- A role with active members cannot be deleted; members must first be reassigned.
- Eligible roles are soft-deleted.
- Access cache is invalidated and the deletion is audited.

### Permission delegation

For every permission in the requested role, the actor must hold that key at a scope that is equal or wider. A missing permission fails delegation. This rule applies to both role creation and permission-set replacement.

## 9. Permission registry and synchronization

The permission registry is assembled from each module's `*.permissions.ts` file in `apps/api/src/foundation/permissions.registry.ts`.

The registry validates:
- No duplicate keys.
- Lowercase dotted permission-key format.
- Platform keys must use the `platform.` prefix; school keys must not.
- Every permission must declare at least one scope and persona.
- Platform permissions are STAFF-only.

Permission sync:
- Creates missing definitions from code defaults.
- Updates code-owned fields such as module, scopes, personas and feature requirements.
- Refuses realm changes for an existing key.
- Does not overwrite platform-owned label, description, sensitivity, deprecation or sort order on existing rows.
- Reports database keys missing from code as orphaned; it does not delete them.

The registry sync sequence runs feature definitions, permission validation/sync, role-template sync, auth message templates, default plans and ledger account templates. It exits non-zero on conflicts. Role-template sync depends on permission sync having run first.

## 10. Authorization enforcement

RBAC middleware's `ensureAccess()`:

1. Requires authenticated `req.auth`.
2. Checks token school ID against the host-resolved tenant.
3. Rejects a platform session attempting to access a school tenant.
4. Requires a membership ID.
5. Loads Access using the correct realm and membership.
6. Stores Access on the request for subsequent permission/scope checks.

Available guards include:
- `requirePermission(key)`
- `requireAnyPermission(...keys)`
- `requirePersona(...personas)`
- `loadAccess`

There are no role-name route guards. Use cases may inspect role template keys for narrow business rules (for example, the school-admin-only grants-all invitation rule), but general authorization is permission/scope-based.

## 11. Errors

Stable role error codes include:

- `ROLE_PERMISSIONS_INVALID` — unknown key, unsupported scope or disallowed persona.
- `ROLE_LOCKED` — attempt to modify/delete locked role.
- `ROLE_NAME_TAKEN` — duplicate name.
- `ROLE_IN_USE` — active memberships still hold the role.
- `ROLE_PERSONA_NOT_ALLOWED` — custom role persona is not STAFF.
- `FORBIDDEN` — requested permissions exceed the actor's delegation authority.

The shared RBAC layer can also return `TOKEN_MISSING`, `SESSION_INVALID`, `TENANT_MISMATCH`, `PLATFORM_SESSION_IN_SCHOOL`, `MEMBERSHIP_INACTIVE` or permission-denied errors.

## 12. Tests and coverage

The inspected Roles test directory contains:

- `apps/api/tests/roles/roles.usecases.test.ts`: focused tests for role listing/detail/members/catalog, permission key and scope validation, delegation, duplicate names, custom role creation, locked-role protection, customized template behavior, cache invalidation, in-use deletion and soft deletion.

The Auth test directory also contains `role-delegation.test.ts`, which exercises scope ordering and invite-time role delegation.

**Verification performed for this documentation:** source inspection only. Tests, registry sync, school-role sync, database migrations and live permission enforcement were not run.

## 13. Frontend integration requirements

1. Load the catalog from `GET /api/v1/permissions`; do not hard-code a permission list in the UI.
2. Group permission options by `module` and show their supported `scopes` and `personas`.
3. Create/update forms must submit complete permission objects with `key` and `scope`.
4. For updates, submit the full intended permission set when changing grants; omission means no grant changes.
5. Explain that the actor can only grant permissions/scopes they already hold; the backend is authoritative.
6. Treat `SYSTEM_LOCKED` roles as read-only and `SYSTEM_EDITABLE` roles as customizable.
7. Show member counts and prevent delete actions when the role is in use; backend remains authoritative.
8. Do not offer STUDENT/GUARDIAN custom role creation; those personas use fixed default roles.
9. Use the `editable`, `kind`, `isCustomized` and `sourceTemplateKey` response fields to explain role behavior.
10. Treat a successful permission update as effective after cache invalidation; no client-side token/role reconstruction is required.

## 14. Outstanding verification

| Item | Status |
|---|---|
| Role/permission route mounts and guards | Source-verified |
| DTO and response summary shapes | Source-verified |
| Scope ordering and delegation logic | Source-reviewed; tests not run |
| Permission registry includes Auth/User/School/Roles definitions | Source-verified |
| Platform vs school access loading | Source-reviewed; runtime not tested |
| Role template and school-role sync semantics | Source-reviewed; sync not executed |
| Permission registry validity against all module definitions | Not executed |
| Deployed permission rows and role grants | Not verified |
| All membership/branch changes invalidate Access cache correctly | Not yet audited across every module |
| End-to-end RBAC enforcement for all modules | Not yet verified |

## Related documentation

- [Auth module](auth.md)
- [Users module](users.md)
- [School module](school.md)
- [Authentication and authorization architecture](../../../architecture/authentication-and-authorization.md)
- [Multi-tenancy and database architecture](../../../architecture/multi-tenancy-and-database.md)
