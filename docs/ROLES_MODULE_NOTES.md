# Roles module (RBAC management)

School admins manage who can do what: list the permission catalog, see every role and who holds it,
create/edit/delete custom roles. This module is new — role **assignment** (`staff.roleId` /
`ChangeStaffRolesUseCase`) already existed in `modules/staff`; role **definition** CRUD did not.

## Endpoints (`/roles`, `/permissions`)

| Method | Path               | Permission      | What |
|--------|--------------------|-----------------|------|
| GET    | `/roles`           | `roles.view`    | List roles (+ member count). `?persona=` filter. |
| GET    | `/roles/:id`       | `roles.view`    | One role. |
| GET    | `/roles/:id/members` | `roles.view`  | Who currently holds this role. |
| GET    | `/permissions`     | `roles.view`    | The SCHOOL-realm permission catalog, to build a role form from. |
| POST   | `/roles`           | `roles.manage`  | Create a CUSTOM, STAFF-only role. |
| PUT    | `/roles/:id`       | `roles.manage`  | Rename/describe and/or replace its permission set. |
| DELETE | `/roles/:id`       | `roles.manage`  | Soft-delete, only if unused. |

`roles.manage` is deliberately left out of every role template (including the locked `school_admin`
grants-all role covers it implicitly). A school admin who wants to delegate role-management hands out
a custom role carrying `roles.manage` — same delegation rule as everything else.

## Rules enforced

- **Persona is always STAFF.** Student and guardian roles are fixed, locked, auto-assigned defaults;
  nobody creates one by hand.
- **Never `grantsAll`.** That stays the sole property of the locked `school_admin` template role.
- **`SYSTEM_LOCKED` roles are immutable** — can't be edited or deleted (`ROLE_LOCKED`, 409). These are
  the platform-enforced roles a school must always have.
- **Editing a `SYSTEM_EDITABLE` role's permissions sets `isCustomized=true`.** This is the same flag
  `foundation/sync-school-roles.ts` already reads — a customized role is skipped by future template
  syncs, so hand customization survives a platform template update untouched.
- **Delegation (`canDelegateRole`, `foundation/access.service.ts`) gates both create and update.**
  Every permission in the requested set, at the requested scope, must be something the actor already
  holds (or the actor is the grants-all admin). Can't build or extend a role more powerful than
  yourself.
- **Permission validation** (`validateRequestedPermissions`): every key must exist in the public
  `PermissionDefinition` catalog, be offered at the requested scope, and be open to STAFF.
- **Delete requires zero members** (`ROLE_IN_USE`, 409, carries the count) — move people to another
  role first.
- **Name uniqueness** is case-insensitive per school.
- Every create/update/delete calls `accessService.invalidate()` (whole-cache clear) so a permission
  change is live immediately, not after the 15s TTL, and is audit-logged (`roles.created/updated/deleted`).

## Files

```
modules/roles/
  roles.permissions.ts          roles.view / roles.manage
  domain/roles.errors.ts
  domain/roles.types.ts         RolesActor { userId, access }
  dtos/role.dto.ts
  repositories/roles.repository.ts   tenant SchoolRole/SchoolRolePermission/MembershipRole + public PermissionDefinition catalog
  usecases/roles.usecases.ts
  controllers/roles.controller.ts
  routes/roles.routes.ts        default export mounted at /roles, `permissionsRouter` mounted at /permissions
  roles.container.ts
```

## Tests

`apps/api/tests/roles/roles.usecases.test.ts` — 21 cases covering reads, create (bad key, bad scope,
over-wide delegation, duplicate name, happy path), update (unknown id, locked, customize-on-edit,
rename-only doesn't customize, over-wide delegation, duplicate name), delete (unknown id, locked,
in-use, happy path).

## Not done here (out of scope for this module)

- No contracts/parity entries were added in `packages/contracts` — that package is shared with
  `apps/web`, which is explicitly out of scope right now.
- Branch-scoping of classes/students (so a BRANCH-scoped role like "Branch Principal" actually sees
  only their branch) is separate, in-progress work by another developer — not touched here.
