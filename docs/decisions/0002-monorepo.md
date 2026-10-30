# 0002: One repository for the API and the web app

Status: **done** on branch `refactor/modules` (no open branches existed, so no freeze was needed). Still to do by hand: root `npm install`, move `.env` to `apps/api`, archive the old UI repository, point hosting at `apps/web`.
Date: 2026-10-31

## Why
Today the API (`multi-school-portal`) and the web app (`multi-school-portal-ui`) are two repositories. The web app re-types every API shape by hand (`features/*/types`, `features/*/schemas`), so it can drift from the backend without anyone noticing: error codes such as `ROLE_NOT_ALLOWED`, the shape of `/automations`, permission keys. One repository lets us:
- share one source of truth for request/response shapes, error codes and permission keys (`packages/contracts`);
- change an endpoint and its screen in one pull request;
- keep one CI, one set of docs and one place to run end-to-end checks.

Both sides already use **zod 4** and TypeScript, so sharing schemas is cheap.

## What we found
- API: Express 5, Prisma 7, BullMQ, `src/` + `prisma/` + `tests/` + `scripts/` at the repo root.
- Web: **Next.js 16 / React 19**, in `web/` of its repo, feature folders (`src/features/<name>/{components,hooks,services,schemas,types}`), axios + TanStack Query, shadcn/ui, zod 4. Small repository (about 400 files).
- Code that depends on the working directory: `process.cwd()/prisma/tenant-migrations` (provisioning worker and two scripts), `process.cwd()/public/template-previews`, `process.cwd()/backups`, the env file path in `config/env.ts`. These keep working as long as the API is always started from `apps/api` (npm workspaces do this for `npm -w apps/api run ...`). Starting it from the repo root would break provisioning, so scripts and Docker must set the working directory.

## Proposed layout
```
.
├── apps/
│   ├── api/                 today's src/, prisma/, tests/, scripts/, prisma.*.config.ts, nodemon.json, tsconfig.json
│   └── web/                 today's multi-school-portal-ui/web (Next.js)
├── packages/
│   ├── contracts/           zod schemas + inferred types for requests and responses, error codes, permission keys, enums
│   └── sdk/                 typed API client built on contracts (replaces the hand-written *.api.ts files over time)
├── docs/                    all documentation, plus decisions/ (this folder)
├── docker-compose.yml
├── package.json             npm workspaces: ["apps/*", "packages/*"]
├── tsconfig.base.json       shared compiler options
└── README.md
```
Names inside `apps/api/src` stay as they are (`foundation` already means access, plans and settings here).

## What leaves the repository root
Not moved, cleaned: `project.zip`, `attendance.patch`, `PROJECT_BRIEF (1).md`, `schoolos-api-documentation.md` and `swagger.yaml` (fold into `docs/` or regenerate), `backups/*.sql`, and root `public/` (goes under `apps/api/public`).
Database dumps are committed (`backups/*.sql`). I checked them: they hold the table definitions only, no data rows, so there is nothing secret to scrub from history. They are still clutter; remove them and keep `backups/` in `.gitignore`.
`tsconfig.json` still lists a stale include (`staff-module-v1/shared/context`); drop it during the move.

## Order of work
1. **Freeze.** Everyone with an open branch merges it or rebases first. Nobody pushes during the move (it is one session).
2. **Move the API with `git mv`, in one commit that only renames** (no edits), so history and blame follow the files. Add root `package.json` (workspaces) and `tsconfig.base.json`. Fix the few path assumptions above. Run the whole test suite.
3. **Bring in the web app with history:** `git subtree add --prefix=apps/web <ui-repo> main` (or `git filter-repo --to-subdirectory-filter apps/web` then merge). Move `web/*` up one level so the app sits at `apps/web`. Keep its own `package.json`; remove its lockfile in favour of the root one.
4. **Tooling:** Dockerfile and compose paths, CI (one job per app, path filtered), Vercel (or wherever the web app is hosted) set to root directory `apps/web`, `.gitignore`, editor config.
5. **Archive the old UI repository** with a pointer to the new one.
6. **Start `packages/contracts`** (separate, later pull requests, one feature at a time):
   - first: error codes and the new settings, message-template, automation and provisioning routes;
   - then replace the web app's hand-written types and zod schemas feature by feature;
   - API request validation (`validate(Dto)`) imports the same schemas, so a mismatch fails at compile time.
7. **`packages/sdk`** once two or three features use contracts.

## Risks and answers
| Risk | Answer |
|---|---|
| Open branches conflict with the move | Freeze step; the move commit is pure renames so rebases are mostly automatic |
| Provisioning cannot find tenant migrations | Run the API from `apps/api`; also resolve the migrations folder from the file location instead of `process.cwd()` as part of step 2 |
| Prisma generated client is checked in under `src/generated` | Moves with the API; regenerate once after the move and run tests |
| Two lockfiles | One root lockfile; delete `apps/web/package-lock.json` |
| Deploy of API and web are different | CI path filters; web deploy root `apps/web`; API image builds from `apps/api` with the workspace |
| Shared package is awkward for Next and for CommonJS API | `contracts` compiled to both ESM and CJS (or built with `tsup`); the API is CommonJS today |

## Open questions
- Is the web app deployed on Vercel or elsewhere? (affects step 4)
- Does anyone have an open branch in either repository? (affects step 1)
- Do we want to keep the `schoolos-api-documentation.md` / `swagger.yaml` files, or generate API docs from `contracts` later?
