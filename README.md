# CORE — Multi-School Portal

A multi-tenant school-management SaaS, initially focused on Nigerian primary and secondary schools.

## Repository layout

```text
apps/api             Express 5, Prisma 7 and BullMQ backend
apps/web             Next.js 16 dashboard
packages/contracts   shared request/response contracts
docs/                architecture, testing, decisions and workstream handoffs
```

This repository uses npm workspaces (`apps/*` and `packages/*`). Install dependencies once from the repository root:

```bash
npm install
```

## Start here

1. Read [Platform Documentation](docs/PLATFORM_DOCUMENTATION.md) before changing architecture or starting a module.
2. Read [Testing Guide](docs/TESTING_GUIDE.md) before running tests or setting up a database.
3. Read [Documentation Index](docs/README.md) to distinguish current guides, workstream handoffs and historical module notes.
4. For finance work, read [Finance Handoff](docs/FINANCE_HANDOFF.md). For settings/automation work, read [Settings and Automation Handoff](docs/SETTINGS_AUTOMATION_HANDOFF.md).

## Local development

Copy the relevant environment examples into the workspace that consumes them:
- API: `apps/api/.env.development`
- Web: `apps/web/.env.local`

Then start the database services and applications:

```bash
npm run db:up
npm run dev:api
npm run dev:worker
npm run dev:web
```

## Common commands

```bash
npm run build:api
npm run build:web
npm run typecheck:all
npm test
npm run check
```

Backend-specific scripts run through the API workspace, for example:

```bash
npm run prisma:generate -w apps/api
npm run sync:registries -w apps/api
```

Database tests require a dedicated disposable database. Follow the Testing Guide; never run destructive tests against development or production data.

## Architecture rules

A module's files existing does not mean it is registered, routed, migrated, tested or production-ready. Check dependencies, permissions/scopes, entitlements, tenant boundaries, container registration, route mounts, migrations, workers and tests before marking it complete.

Keep changes scoped, follow the established route → controller → use case → repository layering, and update durable documentation with implementation changes.