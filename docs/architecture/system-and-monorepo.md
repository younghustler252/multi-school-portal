# System and Monorepo Architecture

> **Status:** Current source-checked architecture snapshot.
> **Source snapshot:** `refactor/modules`, commit `23a5e0a5538f747de27ddff29b24a913791eaac2` (2026-11-05).
> **Authority:** Application code, workspace configuration, Prisma schemas/migrations, tests and runtime configuration take precedence over this guide.

## System shape

CORE is a multi-school SaaS application implemented as an npm-workspaces monorepo. Its backend is a **modular monolith**, not a collection of independently deployed microservices. The frontend and backend are separate deployable applications; reusable contracts are maintained in a shared package.

```text
/
├── apps/
│   ├── api/                 Express + Prisma + BullMQ backend
│   │   ├── prisma/          public/tenant schemas and migrations
│   │   ├── src/
│   │   │   ├── foundation/  access, permissions, entitlements, settings
│   │   │   ├── infrastructure/ database, middleware, jobs, providers
│   │   │   ├── modules/     feature modules
│   │   │   ├── shared/      cross-module utilities and services
│   │   │   ├── container/
│   │   │   ├── routes/
│   │   │   └── app.ts, server.ts, worker.ts
│   │   └── tests/
│   └── web/                 Next.js 16 / React 19 dashboard
├── packages/
│   └── contracts/           shared frontend/backend contracts
├── docs/
├── package.json             npm workspaces and root scripts
└── tsconfig.base.json
```

The root workspace configuration includes `apps/*` and `packages/*`.

## Technology baseline

| Area | Current implementation |
|---|---|
| API | Node.js 22+, TypeScript, Express 5 |
| Web | Next.js 16, React 19, TypeScript |
| Database | PostgreSQL, Prisma 7 |
| Tenant model | Public schema plus a separate PostgreSQL schema per school |
| Dependency injection | Awilix, proxy injection |
| Background work | Redis + BullMQ; API and worker are separate processes |
| Validation | Zod 4 DTOs |
| Tests | Node test runner through `tsx` |
| Shared contracts | `packages/contracts` |

## Backend module boundaries

Feature modules live under `apps/api/src/modules/<module>/`. The established flow is:

`routes → controllers → use cases/services → repositories`

Cross-cutting concerns belong in `foundation/`, `infrastructure/`, and `shared/`.

This is an established pattern, not an absolute rule: some use cases access Prisma directly for multi-table transactions. The architecture test maintains an explicit allow-list for those files. Do not refactor such access mechanically without understanding the transaction boundary and the architecture test.

## Workspace commands

Root scripts include `build:api`, `build:web`, `typecheck`, `typecheck:web`, `typecheck:all`, `test`, `check`, `db:up`, and development commands. Backend-specific commands belong to `apps/api/package.json`.

Do not assume root scripts named `build`, `sync:registries`, or `prisma:generate` exist. Use the workspace-qualified commands documented in the repository's current package manifests.

## Architectural cautions

- A module being registered does not prove its routes are mounted.
- A route being mounted does not prove its migration is applied.
- A migration existing in Git does not prove it has been applied to every school schema.
- A shared contract package does not imply every API endpoint is already represented there.
- Some architecture tests enforce boundaries, but their existence does not establish that all runtime behavior is covered.

## Related guides

- [Multi-tenancy and database architecture](multi-tenancy-and-database.md)
- [Authentication and authorization](authentication-and-authorization.md)
- [Background processing](background-processing.md)
- [Finance architecture and invariants](finance-architecture.md)
