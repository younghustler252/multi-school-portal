# Branches notes

## Switched on
`/branches` was registered in the container and its router was imported, but `routes/index.ts` never mounted it, so every `/branches` call answered 404. It is now mounted next to `/staff`.

| Route | Permission |
|---|---|
| GET `/branches`, GET `/branches/mine`, GET `/branches/:id` | `branches.view` |
| POST `/branches`, PUT `/branches/:id`, PUT `/branches/:id/deactivate`, PUT `/branches/:id/reactivate`, DELETE `/branches/:id`, GET `/branches/:id/members` | `branches.manage` |

All routes need a login, a school host and the permission. Creating a branch is limited by the plan's `branches.max`. Staff are placed in branches from the staff module (`PUT /staff/:id/branches`).

## Not changed
Classes have no branch link yet, so the BRANCH scope still shows nobody. Do the class-to-branch link before turning that scope on (see the hardening backlog).

## Test
`tests/routes/branches-mounted.test.ts` reads `routes/index.ts` and fails if any imported router is not mounted (it fails on the old file). It does not start the app. Not run: a real call to `/branches` (the app needs Redis and a database here).
