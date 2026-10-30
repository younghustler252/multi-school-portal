# CORE — Multi-School Portal API

A multi-tenant school-management SaaS backend, initially focused on Nigerian primary and secondary schools.

## Repository layout

```
apps/api         the API (Express, Prisma, BullMQ): src/, prisma/, tests/, scripts/
apps/web         the web app (Next.js 16): school app, platform admin, marketing pages
packages/contracts   shared request/response schemas, error codes, permission keys (start of the shared contract)
docs/            documentation and decisions (docs/decisions)
```

First time after cloning (or after pulling the move into `apps/`):

1. `npm install` at the repo root (npm workspaces). This creates one root `package-lock.json`; then delete `apps/api/package-lock.json` and `apps/web/package-lock.json`.
2. Move your API `.env` into `apps/api/` (the API reads `.env` from the folder it is started in).
3. `npm run db:up` (Postgres and Redis), then `npm run dev:api`, `npm run dev:worker`, `npm run dev:web`.
4. Tests: `npm test`.

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

- `apps/api/src/modules/` — feature modules
- `apps/api/src/foundation/` — shared access, permissions, entitlements, and registry sync
- `apps/api/src/container/index.ts` — dependency-injection registrations
- `apps/api/src/routes/index.ts` — API route mounts
- `apps/api/src/app.ts` — application middleware and route lifecycle
- `apps/api/prisma/public.prisma` — platform schema
- `apps/api/prisma/tenant.prisma` — school-owned schema
- `apps/api/prisma/migrations/` — public-schema migrations
- `apps/api/prisma/tenant-migrations/` — tenant-schema migrations
- `apps/api/src/infrastructure/jobs/` and `apps/api/src/worker.ts` — background jobs and worker startup
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
