# CORE API test suite

Branch: `api-test-suite` (based on `refactor/modules`).

## Import
1. Import `CORE.postman_collection.json`.
2. Import `CORE.local.postman_environment.json`.
3. Select **CORE Local API**.

## Local configuration
- `baseUrl`: school host/base URL, normally `http://localhost:5000`.
- `platformBaseUrl`: platform/admin host. Use the same local base URL for development.
- `accessToken`: access token returned by login.
- `schoolId` and `tenantSchema`: development tenant override values.

The tenant resolver only accepts `x-school-id` and `x-tenant-schema` in development and validates the school ID against the public database. The collection currently defines these environment values, but does not automatically add the development headers; add them to the collection's Authorization/Headers configuration when testing locally:
- `x-school-id: {{schoolId}}`
- `x-tenant-schema: {{tenantSchema}}`

For deployed environments, use the school's actual subdomain/custom domain for `baseUrl`; do not use development tenant headers.

## Important execution safety
The collection includes the registered API routes. **Do not run the entire collection in Collection Runner.** POST/PUT/PATCH/DELETE requests can create, publish, issue, transfer, approve, pay, reverse, delete or otherwise mutate real records. Those requests are marked STATE-CHANGING and require valid DTO bodies and test data. Run read-only GET requests first, then execute write workflows deliberately against a disposable test school/database.

## What the request tests assert
- HTTP response is not a 5xx server failure.
- Response time baseline is below 5 seconds.
- JSON responses parse successfully.

These are smoke assertions, not proof of business correctness. A 400/401/403/404 response can be expected when required input, authentication, permissions or records are absent. Add endpoint-specific assertions after supplying known-good fixtures.

## Important route details discovered
- Health check: `GET /api/v1/health` checks both PostgreSQL and Redis and returns 503 if either is unavailable.
- School tenant selection is host-based. In development, the resolver accepts validated `x-school-id` + `x-tenant-schema` headers.
- Access token: `Authorization: Bearer {{accessToken}}`; web cookies are also supported by the API.
- Provider webhook entry is mounted before JSON parsing and uses a raw JSON body for signature verification. Do not send an ordinary JSON body and expect a valid Paystack signature.
- Platform endpoints require platform permissions; school tokens should not be used for those routes.
- File uploads require multipart form-data with the exact field names documented in the route source (e.g. avatar, logo, document, photo, file, stamp, signature).

## Coverage boundary
The collection mirrors the route registry and route files inspected on `refactor/modules`. It does not prove that all handlers execute successfully. Runtime verification requires a running API, PostgreSQL, Redis, a provisioned test school and test identities with the required roles/permissions. DTO-specific request examples should be added from the module DTOs before happy-path workflow automation.
