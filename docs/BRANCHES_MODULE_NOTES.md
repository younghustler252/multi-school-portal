# Branches notes

## Switched on
`/branches` was registered in the container and its router was imported, but `routes/index.ts` never mounted it, so every `/branches` call answered 404. It is now mounted next to `/staff`.

| Route | Permission |
|---|---|
| GET `/branches`, GET `/branches/mine`, GET `/branches/:id` | `branches.view` |
| POST `/branches`, PUT `/branches/:id`, PUT `/branches/:id/deactivate`, PUT `/branches/:id/reactivate`, DELETE `/branches/:id`, GET `/branches/:id/members` | `branches.manage` |

All routes need a login, a school host and the permission. Creating a branch is limited by the plan's `branches.max`. Staff are placed in branches from the staff module (`PUT /staff/:id/branches`).

## Classes belong to branches (Patch A)
- Every class has one branch (`Class.branchId`, required). Old classes were moved to the main branch by migration `20261106090000_class_branch`. If a school has classes but no main branch, the migration stops with a clear message.
- The BRANCH scope now works for classes, enrolment lists, attendance (view) and grades (results list, mark sheet list, one sheet). A branch person with no branches sees nobody.
- A branch cannot be deactivated or deleted while it has classes or active staff. The refusal (`BRANCH_IN_USE`) says how many of each.
- Not done yet (Patch B): students and guardians by branch, and the "enrol only in your own branch" rule.

## Test
`tests/routes/branches-mounted.test.ts` reads `routes/index.ts` and fails if any imported router is not mounted (it fails on the old file). It does not start the app. Not run: a real call to `/branches` (the app needs Redis and a database here).
