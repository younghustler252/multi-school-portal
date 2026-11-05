# Backend Documentation

This section documents the backend implementation for developers building and maintaining CORE.

## Reading order

1. [System and monorepo architecture](../../architecture/system-and-monorepo.md)
2. [Multi-tenancy and database architecture](../../architecture/multi-tenancy-and-database.md)
3. [Authentication and authorization architecture](../../architecture/authentication-and-authorization.md)
4. [Background processing architecture](../../architecture/background-processing.md)
5. [API conventions](api-conventions.md) — planned; create after the response/error middleware audit.

## Module guides

| Module | Guide | Verification |
|---|---|---|
| Auth | [Auth module](modules/auth.md) | Source-reviewed; runtime and integration verification outstanding |

## Documentation contract

Module guides describe implementation responsibilities, dependencies, data ownership, route behavior, DTOs, response shapes, permissions, business rules, background work, errors, tests and frontend integration requirements.

A guide must identify its source snapshot and distinguish:

- **Source-verified:** confirmed in the current implementation.
- **Partially verified:** some relevant implementation paths remain unchecked.
- **Open:** a known defect, design decision or missing verification.
- **Not verified:** no claim should be made until the source or runtime behavior is inspected.

Do not treat a module guide as a replacement for OpenAPI. The API specification should become the canonical cross-team HTTP contract after endpoint coverage has been audited.

## Module audit sequence

Foundation modules are being documented first because other modules depend on their identity and authorization behavior:

1. Auth
2. Users
3. School
4. Roles and permissions

The frontend is intentionally not being documented as the current implementation while it remains behind the backend. Frontend implementation documentation will follow the backend contract audit.
