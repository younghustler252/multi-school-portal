# Multi-Tenancy and Database Architecture

> **Status:** Current source-checked architecture snapshot.
> **Source snapshot:** `refactor/modules`, commit `23a5e0a5538f747de27ddff29b24a913791eaac2` (2026-11-05).
> **Authority:** Prisma schemas/migrations and tenant-context implementation are authoritative.

## Tenant model

CORE uses a **public PostgreSQL schema plus a separate PostgreSQL schema for each school**. It does not use a shared tenant table model with `tenant_id` as the isolation boundary, and it does not provision a separate database per school.

| Concern | Location |
|---|---|
| Public schema | `apps/api/prisma/public.prisma` |
| Public migrations | `apps/api/prisma/migrations/` |
| Tenant schema | `apps/api/prisma/tenant.prisma` |
| Tenant migrations | `apps/api/prisma/tenant-migrations/` |
| Public Prisma config | `apps/api/prisma.public.config.ts` |
| Tenant Prisma config | `apps/api/prisma.tenant.config.ts` |

## Tenant context and data access

Tenant-owned operations must execute inside the active tenant context and use the tenant Prisma client, normally obtained through `getTenantClient()`.

The tenant context is established by the application's tenant-resolution and request lifecycle. Background jobs that access school-owned data must establish the appropriate tenant context themselves; they cannot rely on an HTTP request having done it.

**Never use a client-supplied school ID as the tenant isolation boundary.** A school identifier in a request may be useful input for a validated platform operation, but it must not determine which tenant database context an ordinary school request can access.

## Identity versus school membership

Public identity and school membership/persona are separate concepts. Do not reintroduce legacy role or school ownership fields as authorization authority. Access must be derived through the current membership/persona and permission model.

## Migration operations

Treat these as separate operational concerns:

1. Creating or provisioning a new school's schema.
2. Applying new tenant migrations to already-provisioned school schemas.
3. Applying public-schema migrations.

A migration present in the repository proves only that the migration source exists. It does **not** prove the migration has been applied to every existing school schema. Before a release, inspect the actual migration workflow, target environment, provisioning path and migration results.

## Database change checklist

For a tenant-owned schema change, review:

- `apps/api/prisma/tenant.prisma` and generated migration contents.
- New-school provisioning behavior.
- Existing-school migration application behavior.
- Tenant client/context requirements for affected use cases and jobs.
- Tests covering both the schema change and the affected tenant workflow.

For public identity, school registry, subscription or platform data, review the public schema and public migration path separately.

## Related guides

- [System and monorepo architecture](system-and-monorepo.md)
- [Authentication and authorization](authentication-and-authorization.md)
- [Background processing](background-processing.md)
