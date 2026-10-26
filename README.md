# CORE — Multi-School Portal API

A multi-tenant school-management SaaS backend, initially focused on Nigerian primary and secondary schools.

## Start here

Read [Platform Documentation](docs/PLATFORM_DOCUMENTATION.md) before changing architecture or starting work in a module. It describes the observed application architecture, active container registrations, API mounts, tenant boundaries, and development rules.

Use [Testing Guide](docs/TESTING_GUIDE.md) for test commands and database-test safety. Remaining module notes are interim references; verify their claims against the current source before relying on them.

## Stack

- Node.js + TypeScript
- Express 5
- PostgreSQL + Prisma 7
- Separate public and per-school tenant schemas
- Awilix dependency injection
- Redis + BullMQ background jobs
- Shared authorization, subscription entitlements, audit, and finance-ledger foundations

## Key code locations

- `src/modules/` — feature modules
- `src/foundation/` — shared access, permissions, entitlements, and registry sync
- `src/container/index.ts` — dependency-injection registrations
- `src/routes/index.ts` — API route mounts
- `src/app.ts` — application middleware and route lifecycle
- `prisma/public.prisma` — platform schema
- `prisma/tenant.prisma` — school-owned schema
- `prisma/migrations/` — public-schema migrations
- `prisma/tenant-migrations/` — tenant-schema migrations
- `src/infrastructure/jobs/` and `src/worker.ts` — background jobs and worker startup
- `tests/` — automated tests

## Common commands

```bash
npm run build
npm test
npm run sync:registries
npm run prisma:generate
```

Database tests require a dedicated disposable database as described in [Testing Guide](docs/TESTING_GUIDE.md). Never run destructive tests against development or production data.

## Development rules

A module's files existing does not mean it is registered, routed, tested, or production-ready. Check dependencies, permissions, scopes, entitlements, tenant boundaries, container registration, route mounts, migrations, workers, and tests before marking it complete.

Keep changes scoped, follow the established route → controller → use case → repository layering, and update durable documentation in the same change set as the implementation.
