# API Contract Documentation

This directory will contain the canonical, versioned HTTP API contract for the multi-school portal.

## Current status

<badge>Not yet canonical</badge>

There is **no complete, trustworthy OpenAPI contract** in this repository at this source snapshot. The mounted route-file inventory is now documented, but operation-level request/response coverage is still outstanding.

- `docs/swagger.yaml` is an obsolete starter document wrapped in Markdown, not a valid canonical OpenAPI YAML file. Its sample paths and request shapes do not match the current route tree.
- `apps/api/src/config/swagger.ts` constructs a Swagger JSDoc object, but the application does not import it, mount Swagger UI, expose a JSON document endpoint, or otherwise consume the exported `swaggerSpec`.
- The configured JSDoc glob points at `./modules/**/routes/*.ts`; its path resolution has not been verified against the workspace's actual API process working directory.
- No `@openapi` or `@swagger` route annotations were found in the audited source.
- `packages/contracts` contains shared Zod request schemas and response types for selected areas only. The API does not import this package; parity tests compare selected shared schemas against API DTOs. This is not full endpoint coverage and does not describe every response.
- Route files, DTOs, controllers, use cases and tests remain the source of truth until the canonical contract is built and verified.

Do not generate frontend clients, publish Swagger UI as an authoritative reference, or claim complete endpoint coverage from the existing starter file.

## Documents

- [Mounted API route inventory](ROUTE_INVENTORY.md) — route-file and mount composition for the current Express API.
- [Academic API operation inventory](ACADEMIC_OPERATION_INVENTORY.md) — first operation-level pass for Grades, Report Cards, Enrolment and Students; source-reviewed, not runtime-verified.
- [Finance API operation inventory](FINANCE_OPERATION_INVENTORY.md) — 190 route operations across Fees, Payments, Ledger, Expenses, Payroll, Salary Transfers, Finance Settings, Bank Reconciliation, Gateway Settlements and Finance Reports; source-reviewed, not runtime-verified.
- [OpenAPI migration plan](OPENAPI_MIGRATION_PLAN.md) — source-of-truth rules, authoring decision and acceptance criteria.
- [Backend API conventions](../backend/api-conventions.md) — actual route, middleware, validation and response conventions.
- [Backend error handling](../backend/error-handling.md) — current error classes and response behavior.
- [Backend remediation register](../backend/BACKEND_REMEDIATION_REGISTER.md) — cross-cutting issues to resolve while implementing the contract.

## Canonical file target

The target is `docs/api/openapi.yaml`. It will be created only after the route/DTO/response inventory is sufficiently complete to avoid publishing a misleading partial specification as the full API.

Each operation must document its actual mount path, method, authentication mechanism, realm/persona/permission requirements, tenant context, request parameters/body, success response, error responses and relevant idempotency/side-effect behavior.
