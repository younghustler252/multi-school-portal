# Staff module + audit upgrade: apply notes

## 1. Schema (tenant.prisma only; no public change)
Replace `Staff`, add `EmploymentType` and `StaffBranch`, remove `MembershipBranch` (and `branches` on `Membership`), and on `Branch` replace `members MembershipBranch[]` with `staff StaffBranch[]`.
```prisma
enum EmploymentType { full_time part_time contract volunteer }

model Staff {
  id             String         @id @default(uuid())
  userId         String?        @unique          // the portal login, set when an invitation is accepted
  employeeId     String?        @unique
  firstName      String
  lastName       String
  middleName     String?
  email          String?
  phone          String?
  photoUrl       String?
  gender         Gender?
  dateOfBirth    DateTime?
  address        String?
  department     String?
  designation    String?
  qualification  String?
  category       StaffCategory  @default(non_teaching)
  employmentType EmploymentType @default(full_time)
  joinDate       DateTime?
  exitDate       DateTime?
  exitReason     String?
  role           StaffRole      @default(other)  // legacy; dropped in the final cleanup
  isActive       Boolean        @default(true)
  createdById    String?
  updatedById    String?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  deletedAt      DateTime?

  classSubjects         ClassSubject[]
  classesAsClassTeacher Class[]
  subjectDefaults       Subject[] @relation("SubjectDefaultTeacher")
  branches              StaffBranch[]

  @@index([isActive])
  @@index([category])
  @@index([email])
  @@index([deletedAt])
}

// Where a staff member works. This one table also decides where their BRANCH-scoped roles may act.
model StaffBranch {
  staffId      String
  branchId     String
  isPrimary    Boolean  @default(false)
  assignedAt   DateTime @default(now())
  assignedById String?

  staff  Staff  @relation(fields: [staffId], references: [id], onDelete: Cascade)
  branch Branch @relation(fields: [branchId], references: [id])

  @@id([staffId, branchId])
  @@index([branchId])
}
```
Existing dev schools do not match this shape (new required name columns). Delete the dev schools and register again.

## 2. Apply
- **Replace** `modules/staff` completely (delete the old files: `usecases/create-staff*`, `update-staff*`, `deactivate*`, `get-*`, old controller/routes/dtos/domain). New: `shared/services/number-sequence.service.ts`.
- **Replace**: `foundation/access.service.ts`, `foundation/permissions.registry.ts`, `foundation/role-templates.registry.ts`, `infrastructure/middleware/auth.middleware.ts`, the `modules/branches` files in this zip (the assign-branches use case is deleted), `modules/school/usecases/get-dashboard.usecase.ts`.
- **Auth files** (needed by staff): `services/membership.service.ts`, `usecases/send-invite.usecase.ts`, `usecases/accept-invite.usecase.ts`, `repositories/refresh-token.repository(.impl).ts` (`revokeForMembership`), `repositories/user.repository(.impl).ts` (`findByIds`).
- **Audit module**: replace with the files here; delete `usecases/get-audit-logs.usecase.ts`, `get-my-org-activity.usecase.ts`, `get-school-activity.usecase.ts`, `routes/audit.routes.ts` (old).
- **Mount** in `routes/index.ts`: `/staff` -> staff routes, `/audit` -> `audit.routes`, `/platform/audit` -> `audit.platform.routes`.
- **app.ts**: add `app.use(requestContext)` FIRST (right after `trust proxy`, before `resolveTenant`). It gives every request an id (returned as the `x-request-id` header).
- **Container**: `registerStaff` after `registerAuth`, `registerFoundation`, `registerBranches`.
- `shared/constants/system-actors.ts`: make sure it has labels for `SYSTEM_BILLING` ("Billing system") and `SYSTEM_AUTO_VERIFICATION` ("Automatic verification"), plus the older SYSTEM_* ones you use.
- Run the registry sync (new keys `staff.view`, `staff.manage`, `audit.view`, `platform.audit.view`; the old `users.view` becomes "orphaned", which is fine). In the console give **Principal** `staff.manage` (scope ALL) if principals should manage staff (the seed gives them view only); the new Branch Principal template gets `staff.view` and `staff.manage` at BRANCH scope.

## 3. How staff works now
- **A staff record is the school's own record of a person** (name, contact, employment). A portal **login is optional**: cooks, drivers and guards are staff too. The login is linked only when an invitation is accepted.
- **Create** (`POST /staff`): checks the plan's staff limit; places the person in one or more branches (default: the main branch, or the creator's own branch); refuses a duplicate email or employee id; asks for confirmation when the same name AND phone already exist; makes the employee number automatically (STF-0001...) inside the same transaction. Optional `invite: { roleId }` also sends the portal invitation (if it fails, the staff member is still created and the response says so).
- **Invite to the portal** (`POST /staff/:id/invite`): the person chooses their own password. **No password is ever emailed** (the old version emailed a temporary one). The invitation always goes to the staff member's own email.
- **Branches** (`PUT /staff/:id/branches`): the first (or `primaryBranchId`) is the primary branch. A manager limited to their branch can only add or remove their own branches; the person's other branches stay.
- **Roles** (`PUT /staff/:id/roles`): you cannot change your own role; you can only grant roles you could grant yourself; the only administrator cannot lose the administrator role.
- **Deactivate** (`POST /staff/:id/deactivate`): the record is marked inactive, ONLY THIS school's access is switched off and its sessions ended, waiting invitations are cancelled. The old version switched off the person's whole login, locking a teacher out of every school they work in. Refused for your own record and for the only administrator; the response warns how many class/subject assignments need a new teacher. Reactivate needs room in the staff limit.
- **List/search/export**: filters (search, category, employment type, department, branch, status), scoped to what the viewer's role allows. The list is one query (the old one made a database call per row). `GET /staff/export` gives a CSV (spreadsheet-safe).
- **Scope**: `staff.view` at ALL, BRANCH or OWN; `staff.manage` at ALL or BRANCH.
- Staff records are never erased (soft delete).

## 4. Routes (school host, `/staff`)
`GET /` (query: page, limit, search, category, employmentType, department, branchId, status=active|inactive|all), `GET /export`, `GET /me`, `GET /me/classes`, `POST /`, `GET /:id`, `PUT /:id`, `PUT /:id/branches`, `PUT /:id/roles`, `POST /:id/invite`, `POST /:id/deactivate` `{exitDate?, exitReason?}`, `POST /:id/reactivate`, `GET /:id/assignments`.
Removed: `DELETE /:id` (now `POST /:id/deactivate`), `/branches/assignments/:membershipId` (now `PUT /staff/:id/branches`), `PUT /:id/reset-password` style actions (a new password is set by the person; support can still reset an admin's password through the user module).
Response: `fullName`, `branches[{id,name,code,isPrimary}]`, `portal { status: none|invited|active|suspended, roles[] }`.
Codes: POSSIBLE_DUPLICATE_STAFF, LAST_ADMINISTRATOR, STAFF_HAS_ASSIGNMENTS, NOT_A_PORTAL_USER, STAFF_HAS_NO_EMAIL, BRANCH_FORBIDDEN, INVALID_BRANCHES, INVALID_ROLES, CANNOT_CHANGE_OWN_ROLE, ROLE_NOT_ALLOWED, PLAN_LIMIT_REACHED.

## 5. Audit upgrade
- Entries now automatically record the **module**, the **request id**, the caller's **address and device**, their **membership**, and, when a platform person is impersonating, **`impersonatedBy`** (an action during impersonation is never recorded as the school user's own). Explicit values still win. Closes the impersonation audit gap.
- A failed audit write is no longer silent: the reason is printed.
- The platform log (`GET /platform/audit`, permission `platform.audit.view`) now actually uses its filters (user, action, module, entity, entity id, dates, school). The school's own activity log is now exposed: **`GET /audit`** (permission `audit.view`), only that school's entries; add `entity=Staff&entityId=<id>` for the history of one record; an action ending in "." matches a family (`staff.`).
- Defect D13 closed. The enricher needed `userRepository.findByIds` (the new auth interface has no `findMany`); added.

## 6. Not built yet (planned)
Bulk import of staff from CSV/Excel (built once with students, one shared import engine), staff documents with expiry dates, leave records, assignment history (comes with the classes module), payroll (with finance).

## 7. Docs update (section 0.3)
Tenant: Staff redesigned; StaffBranch added; MembershipBranch removed; EmploymentType enum. Permissions: staff.view, staff.manage, audit.view, platform.audit.view (users.view retired). Modules done: staff, audit (D13 closed).
