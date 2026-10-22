# SchoolOS — Multi-School Portal API

A multi-tenant school-management SaaS backend for Nigerian primary and secondary schools.

## Start here

**Before changing code, read [`docs/SCHOOLOS_PLATFORM_DOCUMENTATION.md`](docs/SCHOOLOS_PLATFORM_DOCUMENTATION.md).** It is the current architecture overview, module integration/status map, and AI/developer handoff guide.

Then read the relevant module notes under `docs/` before working in that area. Those notes describe implementation decisions and API contracts, but always compare them against the current source branch before applying historical instructions.

## Current stack

- Node.js + TypeScript
- Express
- PostgreSQL with Prisma
- Separate public and per-school tenant schemas
- Awilix dependency injection
- Redis + BullMQ background jobs
- Shared authorization, plan entitlements, audit, and finance-ledger foundations

## Key code locations

- `src/modules/` — feature modules
- `src/foundation/` — shared access, permissions, entitlements, and registry sync
- `src/container/index.ts` — module dependency-injection registration
- `src/routes/index.ts` — API route mounts
- `prisma/public.prisma` — platform schema
- `prisma/tenant.prisma` — school tenant schema
- `prisma/migrations/` and `prisma/tenant-migrations/` — migration history
- `src/infrastructure/jobs/` and `src/worker.ts` — background jobs and worker startup
- `docs/TESTING_GUIDE.md` — test setup and database-test safety

## Common commands

```bash
npm run build
npm test
npm run sync:registries
npm run prisma:generate
```

Database tests require the separate test database described in `docs/TESTING_GUIDE.md`. Never run destructive tests against development or production data.

## Development rule

A module's files existing does not mean it is registered, routed, tested, or production-ready. Check its use cases, dependencies, permissions, entitlements, tenant boundaries, container registration, route mount, migrations, workers, and tests before marking it complete. Keep changes scoped to the module being worked on and update its documentation as part of the same pass.
