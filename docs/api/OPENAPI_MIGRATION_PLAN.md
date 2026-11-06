# OpenAPI Migration Plan

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. This is a plan and readiness assessment, not an API specification.

## Objective

Create one version-controlled OpenAPI 3.1 contract that frontend developers, API developers, QA and external integrators can rely on. It must describe the API that is actually mounted and implemented—not the historical SchoolOS starter endpoints and not assumptions inferred from DTO names.

## Current-state findings

1. `docs/swagger.yaml` is a Markdown document containing a fenced OpenAPI 3.0 starter snippet. It is not valid standalone YAML and describes obsolete paths such as `/school/me`, `/school/update` and a legacy registration payload.
2. `apps/api/src/config/swagger.ts` imports `swagger-jsdoc` and exports `swaggerSpec`, but repository search found no consumer of that export, no Swagger UI mount and no OpenAPI JSON route.
3. The Swagger JSDoc config uses `./modules/**/routes/*.ts`. The path's resolution under the API workspace and its actual matched files have not been tested.
4. No `@openapi` or `@swagger` annotations were found in the route source inventory.
5. `packages/contracts` currently exports selected shared Zod schemas/types: errors, automation, message templates, provisioning, school settings, platform, report cards and permission information. Its package comment says the API does not import it; parity tests compare selected shared schemas with selected API DTOs.
6. The current parity test is a finite list of request schema pairs plus selected registry checks. It does not establish full API endpoint or response parity.
7. API success and error responses are not perfectly uniform today. See [API conventions](../backend/api-conventions.md), [Error handling](../backend/error-handling.md) and REM-113/REM-114/REM-116.

## Source-of-truth rules

Until the canonical OpenAPI document is complete:
- Mounted route composition in `apps/api/src/routes/index.ts` and `apps/api/src/app.ts` determines whether an endpoint exists.
- Route files determine HTTP method, relative path and middleware sequence.
- DTOs determine request validation (subject to the parsed-query/params middleware issue REM-113).
- Controllers and shared response helpers determine the actual success envelope/status.
- AppError classes and error middleware determine actual error status/code/envelope (subject to REM-114).
- Permission declarations, route guards and AccessService determine actual authorization.
- Module use cases/repositories determine business effects, transaction boundaries and idempotency.
- Tests provide evidence for behavior only within the cases they execute.

Do not infer response schemas solely from request DTOs or TypeScript interfaces.

## Recommended implementation approach

### Phase A — stabilize cross-cutting API behavior

Resolve or explicitly accept the following before freezing the OpenAPI response contract:
- REM-112: mount RequestContext so request correlation and actor context work.
- REM-113: ensure parsed query/parameter data reaches controllers.
- REM-114: standardize validation, 404 and rate-limit error envelopes and stable codes.
- REM-115: configure trusted proxy behavior and shared rate-limit storage for the actual deployment topology.
- REM-116: decide whether entitlement warnings belong in standard success responses.
- Decide whether 204 responses, empty list responses, nullable values, BigInt money fields and date-only values have one consistent serialization rule.

### Phase B — build a complete route inventory

For every mounted route record:
- API base path and router mount composition.
- Method and path, including path parameters.
- Authentication requirement and token/cookie behavior.
- Realm, persona, permission key and supported scopes.
- Tenant requirement and host/subdomain behavior.
- Feature and plan-limit gates.
- Request path/query/body schemas and multipart/file constraints.
- Success status and complete response schema.
- Error statuses and stable codes.
- Pagination/filter/sort behavior.
- Idempotency, external side effects and asynchronous job behavior.
- Whether the operation is deprecated, internal-only or platform-only.

Include health, webhook and queue-admin endpoints in separate tagged groups. The queue dashboard is mounted outside `/api/v1`; do not accidentally present it as a normal public business API.

### Phase C — choose and prove the authoring pipeline

The repository currently has Swagger JSDoc installed, but the existing config is unused and route annotations are absent. Do not assume Zod-to-OpenAPI generation is configured.

Recommended decision:
- Keep Zod DTOs as runtime request validators.
- Author the canonical OpenAPI document explicitly at `docs/api/openapi.yaml` initially, using reusable schemas and shared response components.
- Add CI linting and structural validation for the OpenAPI file.
- Add contract tests for high-risk routes and representative response shapes.
- Only adopt schema generation where a small proof proves that the installed Zod version and chosen generator preserve the API's actual constraints and output. Avoid making a second, divergent schema system.
- If generated output is eventually selected, keep its source annotations/schema definitions versioned and deterministic; CI must fail when committed output is stale.

### Phase D — implement incrementally by domain

Recommended sequence:
1. Auth, users, school provisioning and tenant resolution.
2. Roles, permissions, branches and staff.
3. Students, guardians, classes, enrolment, sessions and attendance.
4. Grades, report cards and graduation.
5. Fees, payments, ledger, expenses, payroll and reconciliation.
6. Subscriptions, plans, platform administration, settings and automation.
7. Notifications, message templates, webhooks and feedback.
8. Health and operational endpoints.

Do not mark the document complete until every mounted route is either described or explicitly excluded with a reason.

### Phase E — validate and publish

Required checks:
- OpenAPI 3.1 parser/linter passes.
- Every operation ID is unique and stable.
- Every mounted route has a matching operation or explicit exclusion.
- No OpenAPI operation points to a route absent from the route index.
- Auth/security definitions match bearer/cookie behavior.
- Permission/realm/persona requirements are documented as extensions or descriptions.
- Request schemas match API DTO behavior; parity tests cover the high-risk schemas.
- Success/error response examples match actual HTTP integration tests.
- Multipart and raw-body webhook endpoints are represented correctly.
- CI checks spec validity and route inventory drift.
- Swagger UI, if enabled, serves the committed canonical document and is protected appropriately for internal/admin operations.

## Acceptance criteria

The OpenAPI phase is complete only when:
- `docs/api/openapi.yaml` is valid OpenAPI 3.1.
- 100% of mounted business API routes are covered or explicitly excluded.
- All auth, tenant, permission, feature and limit requirements are documented.
- All success and error response shapes are verified against integration tests.
- Pagination, money, BigInt, date/time, file upload, webhook and async job conventions are documented.
- CI validates syntax and route coverage.
- Frontend can generate or safely consume types from the contract without relying on undocumented backend behavior.

## Related remediation items

- REM-112 through REM-116: cross-cutting API middleware and response behavior.
- Module-specific findings in the [backend remediation register](../backend/BACKEND_REMEDIATION_REGISTER.md) must be reflected where they affect endpoint behavior or authorization.
