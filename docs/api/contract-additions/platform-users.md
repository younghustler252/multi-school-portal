# Platform user list: `GET /api/v1/users`

Types and query schema: `packages/contracts/src/platform-users.ts`. Platform realm only; permission **`platform.users.view`** (new, read-only, not sensitive). Writes keep `platform.users.manage` (`POST /users/:id/deactivate`, `/reactivate`, `POST /users/schools/:schoolId/admin/reset-password`). `GET /users/:id` (single summary) is unchanged and still needs `platform.users.manage`.

## The data model behind it
| Thing | Where | Listed here as |
|---|---|---|
| User account | public `User`: login, name, active flag (one per person) | the row |
| School link | public `UserSchool(userId, schoolId)` | `schoolCount`, and the `schoolId` filter |
| School membership (role inside a school) | that school's own schema | **not listed** (cannot be read across schools) |
| Platform operator | public `PlatformMember` + roles | `platformMember` (`null` for ordinary accounts) |

The legacy `role` and `schoolId` columns were dropped (migration `20261107100000`) and are not reintroduced. The list reads the public database only, so one unprovisioned or slow school cannot affect it.

## Query
`page` (1), `limit` (20, max 100), `search` (each word must match email, first or last name, case-insensitive; max 100 chars, 5 words used), `schoolId`, `isActive=true|false`, `platformMember=true|false`, `sort=createdAt|lastLoginAt|email` (createdAt), `order=asc|desc` (asc for email, else desc). Ties are broken by id so pages are stable. With `sort=lastLoginAt`, accounts that never signed in come last.

## Response (`sendPaginated`)
```json
{ "success": true, "message": "Users retrieved successfully",
  "data": [{ "id": "…", "email": "ada@x.com", "firstName": "Ada", "lastName": "Obi", "isActive": true,
             "lastLoginAt": "2026-03-03T00:00:00.000Z", "createdAt": "2026-01-01T00:00:00.000Z", "schoolCount": 2,
             "platformMember": { "id": "…", "status": "active", "roles": [{ "id": "…", "name": "Support" }] } }],
  "meta": { "total": 45, "page": 1, "limit": 20, "totalPages": 3, "hasNext": true, "hasPrev": false } }
```
Never returned: password hash, phone, last login IP, tokens, `role`, `schoolId`.

Errors: 400 invalid query (envelope with field errors), 401, 403 (missing `platform.users.view`, or a school session).

Granting: the permission appears in the registry on the next permission sync; `super_admin` (grants everything) holds it automatically. Custom platform roles must be given it explicitly.

Out of scope: creating or removing platform operators and editing school memberships.
