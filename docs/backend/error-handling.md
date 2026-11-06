# API Error Handling

> **Source snapshot:** refactor/modules, reviewed 2026-11-06. This guide documents the shared AppError hierarchy, validation middleware, global Express error handler and current response inconsistencies.

## Error ownership

Use typed domain errors from shared/errors/domain.errors.ts for expected business/API failures. Controllers should pass unexpected errors to next(err); they should not build ad hoc status/message responses unless the route has a documented special protocol.

The global error handler is mounted after API routes and the 404 handler. It is the final Express error boundary.

## AppError contract

AppError contains:
- message: safe client-facing description for operational errors.
- statusCode: HTTP status.
- isOperational: whether the message is safe to expose.
- code: stable machine-readable identifier.
- details: structured, non-secret context.

Common subclasses:
- ValidationError: 400 VALIDATION_ERROR, optional field map.
- BadRequestError: 400 BAD_REQUEST.
- UnauthorizedError: 401 (TOKEN_MISSING, TOKEN_EXPIRED, TOKEN_INVALID, SESSION_INVALID, UNAUTHORIZED).
- ForbiddenError: 403 with a domain code/details.
- PermissionDeniedError: 403 PERMISSION_DENIED with permission key.
- TenantMismatchError: 403 TENANT_MISMATCH.
- NotFoundError: 404 NOT_FOUND.
- ConflictError: 409 CONFLICT.
- UnprocessableError: 422 UNPROCESSABLE.
- RateLimitError: 429 RATE_LIMITED.
- PlanLimitError: 403 PLAN_LIMIT_REACHED.
- FeatureNotAvailableError: 403 FEATURE_NOT_AVAILABLE.
- InternalError: 500 INTERNAL_ERROR, non-operational.

Do not place secrets, tokens, full bank details or private student data in error details. Details are returned to the caller for operational AppErrors.

## Global error response

Global error handler returns:
- success: false.
- message.
- code when available.
- details when available.
- errors for ValidationError field map.

For non-operational 5xx AppErrors, message is replaced with "Internal server error". Unknown exceptions return 500 INTERNAL_ERROR; stack is included only in development.

Unexpected errors are logged and sent to Sentry with request path/method. Expected client errors are logged as warnings and not sent to Sentry. Request correlation is intended through x-request-id, but requestContext is not currently mounted; see REM-112.

## Prisma error mapping

The handler maps:
- P2002 → 409 CONFLICT, generic duplicate-value message.
- P2025 → 404 NOT_FOUND.
- P2003 → 400 INVALID_REFERENCE.

Other Prisma/database errors are treated as unexpected 500 and reported to Sentry. Do not expose raw Prisma errors or constraint names to clients.

## Zod validation

There are two current paths:

1. validate middleware calls schema.safeParse(req[part]). For body, parsed data replaces req.body. For query/params, parsed output is not applied to the request. On failure it responds immediately with HTTP 400:
   { success:false, message:"Validation failed", errors: fieldErrors }
   This response omits code=VALIDATION_ERROR and does not use the global handler.

2. A ZodError thrown later by a use case/controller reaches the global error handler. It returns HTTP 400 with code=VALIDATION_ERROR and flattens issues into a field map.

The two responses differ in shape and sometimes in error value shape (flattened arrays vs single string). See REM-113 and REM-114. Standardize on a single validation response contract and ensure query/params parsed output is passed downstream.

## Authentication and CORS errors

authenticate converts JWT TokenExpiredError to 401 TOKEN_EXPIRED and JsonWebTokenError/NotBeforeError to 401 TOKEN_INVALID. Global handler also has JWT fallback mapping.

CORS callback throws "Not allowed by CORS"; global handler returns 403 CORS_FORBIDDEN. Requests with no Origin are allowed for server-to-server clients; production browser origins must be HTTPS subdomains of BASE_DOMAIN.

## 404 and rate-limit responses

Unknown route currently returns:
{ success:false, message:"Route METHOD URL not found" }
It omits a stable code such as ROUTE_NOT_FOUND and does not use the common error handler. Avoid putting sensitive query strings into the response.

express-rate-limit uses its own message body:
{ success:false, message:"Too many requests..." }
It does not include code=RATE_LIMITED. The webhook limiter has a separate default response shape. See REM-114.

## Error handling rules for new code

- Throw AppError subclasses for expected business states.
- Use ValidationError for domain-level validation with field map.
- Keep HTTP concerns out of repositories/domain policies.
- Never return provider raw payloads or raw database errors.
- Use a stable code that frontend can switch on; do not make the UI parse message text.
- Include only safe, bounded details.
- Use next(err) in controllers; let the global handler decide status/envelope.
- Do not catch and silently swallow errors unless the workflow has a documented durable retry/alert path.
- For background jobs, persist error/status and report through the job's retry/dead-letter policy; there is no HTTP response.

## Open consistency items

1. RequestContext is not mounted, so request IDs and automatic actor/IP/user-agent context are absent (REM-112).
2. Query/params validation parses but discards transformed data (REM-113).
3. Validation middleware, global Zod handling, 404 and rate-limit responses do not share one error envelope/code policy (REM-114).
4. Proxy trust and shared rate-limit store are not configured (REM-115).
5. Entitlement warn-mode decisions are stored in res.locals but never added to responses (REM-116).
6. Audit writes use the public Prisma client independently from tenant transactions; see REM-077.

