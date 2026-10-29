# Settings and Automation module: handoff for a new session

Written 2026-10-29 after Phase 6 of finance. Goal: bring school settings, message templates and automation rules up to the same standard as the finance modules, so every school can configure what is hard-coded today.

## What exists today (verified in the repo)
| Piece | State |
|---|---|
| `src/modules/school-settings` (branding, report-card template, letterhead, `allowStudentLogin`, `teachingModel`, stamp/signature upload) | Old style, NOT refactored. Router is commented out in `src/routes/index.ts` (lines ~39 and ~81), so nothing is reachable. No permission keys: PUT only checks `authenticate` + `requireTenant`, so once mounted any logged-in user (even a student or guardian) could change branding. Uses the legacy `requireSchoolAdmin`. No tests. Plan-feature check lives inside the update use case. |
| `src/modules/platform-settings` | Works, super-admin only (`requireSuperAdmin`), single row (name, support contacts, trial/grace days, registrations, maintenance mode, banner). Not refactored to permission keys; fine to leave as is. |
| `src/modules/finance-settings` | DONE, the pattern to copy. Key/value rows in `SchoolSettingValue` (`finance.*`), definitions in `domain/finance-settings.ts` (`FINANCE_SETTING_DEFS`, `settingsOf`), permissions, routes, tests. |
| Automation | NOT BUILT. Only database models exist: `AutomationRule`, `AutomationRunLog`, `SchoolMessageTemplate` (tenant.prisma ~line 1073), plus an inactive feature key `automation.rules.max` in `features.registry.ts`. `sync-registries.ts` says "Settings and automation rules join this list in their own passes". No code reads or writes these tables. |
| Hard-coded background jobs (BullMQ, `src/infrastructure/jobs`) | defaulter reminders, subscription expiry, payment reconciliation, ledger integrity, recurring expenses, report cards, school lifecycle, billing. Schedules and thresholds are fixed in code; a school cannot turn one off or change timing, audience or wording. |
| Notifications module | Sends and lists notifications, delivery service exists. No per-school templates yet. |

## Proposed scope (build in this order, one commit per step, tests each)
1. **Refactor school-settings.** Add permission keys (own module name, e.g. `school_settings`: `school_settings.view`, `school_settings.manage`, `school_settings.branding.manage` if useful), routes with `[authenticate, requireTenant, requirePermission(key)]`, mount the router, tests (DTO, permissions, plan feature check, upload size/type). Add the permission to role templates (admin/principal) and run `npm run sync:registries`. Check report-card code that reads `SchoolSettings` still works.
2. **Generic settings registry.** Move toward one definitions list per module (like `FINANCE_SETTING_DEFS`) behind a small shared service, so attendance, grading, notifications and fees can register their own `module.key` settings with defaults, validation and groups. Keep finance settings working unchanged.
3. **Message templates.** CRUD on `SchoolMessageTemplate` (key + channel + locale), safe placeholder rendering (whitelist of variables, escape output), default templates shipped in code, preview endpoint.
4. **Automation rules.** Rule = `definitionKey` + params + channels + audience + schedule. Definitions live in code (the school only enables and tunes them): start with the hard-coded ones as definitions (defaulter reminder days, attendance absence alert, subscription expiry notice, report-card ready). One scheduler tick finds due rules (`enabled`, `nextRunAt`), runs the definition inside the tenant context, writes an `AutomationRunLog` row (status, matched, notified, error), and sets `nextRunAt`. Enforce `automation.rules.max` per plan (turn the feature key active). Dry-run endpoint that returns who would be notified without sending. Migrate the existing workers onto it without changing behaviour for schools that do nothing (defaults equal today's values).
5. **Docs** (`docs/SETTINGS_AUTOMATION_NOTES.md`) and a route table entry in `docs/PLATFORM_DOCUMENTATION.md`.

## Rules learned in finance (keep following)
- Money is BigInt kobo; dates are YYYY-MM-DD strings; finance timezone Africa/Lagos.
- Module layout: container, permissions, controllers, usecases (deps object, optional `{now, transaction}`), repository interface + impl, mapper, dto (zod 4 `.strict()`), domain, routes with `validate(Dto)`; `sendSuccess`/`sendCreated`.
- New permission module names must be DISTINCT per module (a shared name broke the api-contract permission-count tests twice). Sensitive permissions are not auto-granted to existing roles: grant by hand.
- New features default OFF or equal to today's behaviour; optional dependencies so hand-built test worlds keep old defaults.
- The generated Prisma client in `src/generated` is not regenerated in the sandbox, so new tables are reached with raw SQL via `getTenantClient()`. Add a tenant migration under `prisma/tenant-migrations/` for every schema change.
- Tests: node:test via tsx, in-memory worlds over real services (see `tests/finance/support`). Run: `NODE_PATH=/home/claude/node_modules tsx --import ./tests/setup/env.ts --test <files>`. `books-schema.test.ts` needs Postgres. `npm ci` is blocked in the sandbox (registry not allowlisted): use the global tsx and the zod shim.
- Awilix PROXY injection; `.scoped()` acts like a singleton from the root container. Background jobs must wrap work in `TenantContext.run({ tenantSchema, schoolId }, ...)` (see `defaulter-reminder.worker.ts`).
- Branch `refactor/modules`; run `git pull --rebase origin refactor/modules` before pushing.

## Open questions for the owner
- Which automations do schools actually want first (fee reminders, absence alerts, results ready)?
- Channels: in-app only, or also email and SMS? (SMS provider and cost are not decided.)
- Should templates be editable by every school, or only chosen from a platform list?

## Prompt to paste into the new chat
"Continue SchoolOS (repo younghustler252/multi-school-portal, branch refactor/modules). Read docs/SETTINGS_AUTOMATION_HANDOFF.md and docs/FINANCE_PHASE6_NOTES.md, then start step 1 (refactor school-settings with permissions and mount it). Work in large batches, commit and push after each step, and keep messages short."
