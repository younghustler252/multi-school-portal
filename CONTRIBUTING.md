# Working in this repository

One repository, three parts: `apps/api` (backend), `apps/web` (Next.js), `packages/contracts` (what they agree on). Read `README.md` for setup and `docs/PLATFORM_DOCUMENTATION.md` before starting a module.

## Every day
1. `nvm use` (Node 22), `npm install` at the root (never inside an app folder), `npm run db:up`.
2. Branch from `main` (or the agreed integration branch): `feature/<module>-<what>`, `fix/<what>`.
3. Before you push: `npm run check` (API types and tests). While the web app is being brought up to date with the API, web checks are report-only: run `npm run typecheck:web` when you change the web app, and do not add new errors. CI runs the same.
4. Small pull requests, one module at a time. Say in the description what you ran and what you did **not** run (database tests skipped, no provider keys, and so on).

## Owning a module
Each module has one owner who reviews changes to it. Do not edit another owner's module without telling them; add a small, clearly named hook instead.

| Area | Owner |
|---|---|
| Finance (ledger, fees, payments, payroll, reconciliation), school settings, message templates, notifications, automation, provisioning visibility | @younghustler252 |
| Attendance, graduation and other modules named in `docs/*_NOTES.md` as someone else's | the developer who wrote the notes (add the name here) |

## Adding or changing an API route
1. Module layout: `controllers/ dtos/ domain/ repositories/ services/ usecases/ routes/` plus `<module>.container.ts` and `<module>.permissions.ts`. Copy a small existing module (message-templates is a good one).
2. Every route: `authenticate` → `requireTenant` → `requirePermission(key)` before any body parsing or file upload. New permission keys go in the module's permissions file **and** the registry; sensitive ones are not given to existing roles automatically (`npm run sync:registries -w apps/api`, then `sync:school-roles`).
3. Money is integer kobo (BigInt); calendar days are `YYYY-MM-DD` strings; school time is Africa/Lagos.
4. Anything that sends a message goes through `NotificationDispatchService` (never straight to email or SMS) and uses an idempotency key.
5. Background work runs inside `TenantContext.run` and one school failing must not stop the others.
6. Tests with in-memory fakes in `apps/api/tests/<module>/`; database tests use `TEST_DATABASE_URL` (see `docs/TESTING_GUIDE.md`).
7. **Contracts:** if a request or response shape changes, change `packages/contracts` in the same pull request. The web app builds against it.
8. Add a short note to `docs/` (route table and decisions) for anything another developer will need.

## Adding or changing a screen
- Feature folders: `apps/web/src/features/<name>/{components,hooks,services,schemas,types}`. Pages stay thin.
- Call the API through the service files; take types and zod schemas from `@schoolos/contracts` when they exist there.
- Branch on the error `code`, never the message text.
- UI components: add with `npx shadcn@latest add <component>` (the CLI is not a dependency of the project).

## Dependencies and security
- Install packages with `npm install <pkg> -w apps/api` (or `apps/web`).
- `npm run audit:deps` shows known vulnerabilities in what ships. Dependabot opens weekly update pull requests; merge security ones quickly.
- Secrets live only in `.env.*` files that are not committed (`*.example` files list the names).

## Type check baseline
`npm run typecheck` (the API) must pass. The one unfinished module that is not mounted (`super-admin`) is excluded in `apps/api/tsconfig.json`. When it is finished and registered, delete its line so the compiler checks it again.
The Prisma clients in `apps/api/src/generated` are checked in. After you change a `.prisma` schema run `npm run prisma:generate -w apps/api` and commit the regenerated files in the same pull request, or the next person's type check fails.
