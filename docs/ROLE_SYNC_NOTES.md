# Role sync notes

How new permissions reach the roles in existing schools.

## The problem this fixes
Permissions added to the default roles in code (for example `sessions.view`, `classes.view`, `enrolment.view`) only reached brand-new databases. Templates were created once and never updated, and a school copies its roles from the templates when it is provisioned. In existing environments every role except the School Admin got `PERMISSION_DENIED` on those routes.

## Deploy order
1. `npm run migrate:apply-to-existing-schools` (database changes; `:dry-run` only lists what would be applied)
2. `npm run sync:registries` (permissions, then role templates, and the rest)
3. `npm run sync:school-roles` (each school's own roles). Run `npm run sync:school-roles:dry-run` first to preview.

## Rules
- Locked templates / roles are made EXACTLY equal to the code: missing added, wrong scope fixed, extras removed, all-access flag matched.
- Editable templates / roles only GAIN missing permissions. Nothing is changed or removed, except by a named **revocation** (below). `--prune` makes school copies exact too; prefer a revocation, which removes only what you name.
- A template's `version` goes up by 1 whenever its permissions change. A school role records the version it last matched.
- Skipped: custom roles, roles marked `isCustomized` (listed at the end of the run so an admin can add permissions by hand), roles whose template is missing or inactive.
- One transaction per school. A failed school is rolled back and the run continues; the exit code is 1 if any school failed.

## Deliberate revocations (removing a permission from a default role)
The sync above only ever adds to an editable role. To take a permission away, name it in `src/foundation/role-revocations.registry.ts` (an `id`, the template key, the permission keys, and a plain-words reason), AND take it out of that role's list in `role-templates.registry.ts` in the same change (otherwise the additive sync would add it straight back; the sync reports this as a conflict and applies nothing).

What happens:
1. `npm run sync:registries` removes the named permissions from the platform template (its version goes up by 1). Locked templates cannot be revoked from (they already follow the code).
2. `npm run sync:school-roles` removes them from each school's copy of the role, **only where the school has not changed the role** (`isCustomized = false`). A role the school has customised is never touched. It is listed under **PENDING**, with the school, schema and the permissions it still holds, so each school can be handled on purpose (ask the school, or remove by hand).
3. Order is enforced: until the platform template is revoked, school roles are not touched and are listed under **BLOCKED**.
4. Repeating a revocation changes nothing. Leave applied entries in the list as the history of why a default changed.
5. `npm run sync:school-roles:dry-run` shows exactly which roles would lose what, and the pending list, without writing. Read it first: it is also the way to spot a school whose role was edited some other way and still looks untouched.

What marks a role as customised: editing a default role's **permissions** through the roles module (rename or description alone does not). New schools copy from the already-revoked template, so they never receive the permission.

## Known limits
- A role changed in the database by hand (not through the roles module) is not marked customised and would look untouched to the sync. The dry run is the check.
- Pending roles stay pending until someone acts: the sync will not force a removal on a customised role, by design.
- Revocations are not written to the audit log (the report is the record). Add that if you need a per-school trail.

## Tests
- `tests/foundation/role-sync.planner.test.ts`: the pure planners.
- `tests/foundation/role-revocations.test.ts`: the revocation list checks, the planner, the template sync (small pretend database) and the school sync on a real schema (dry run, untouched vs customised vs custom vs other-template roles, repeat, give-back, blocked, empty list). Run `npm run sync:registries` on a copy first: the template sync is not tested against a real public schema here.
- Checked on a scratch Postgres (22 tenant migrations applied to a fresh schema, roles seeded as an old environment): dry run writes nothing; editable role gains permissions and keeps its own extras; locked role made exact; customised role untouched; second run changes nothing; prune removes extras.
- NOT run: the template sync (`syncRoleTemplates`) against a database, because Prisma's engine cannot be downloaded in the sandbox. It compiles with no new errors; run `npm run sync:registries` on a copy first and read the `grantsChanged` line in its output.

## Revocations applied so far
- `2026-11-principal-configuration-to-school-admin`: the principal default role no longer holds `school.update`, `school_settings.manage`, `automation.manage` or `message_templates.manage`. It keeps the matching `.view` permissions, `notifications.send`, grade and report-card sign-off, and the expense and payroll approvals. Approval stays a second pair of eyes: self-approval is off by default (`finance.allow_self_approval`), only `finance.settings.manage` (not held by the principal or bursar) can turn it on, and the principal holds no permission to prepare expenses or payroll.
- Rollout: deploy, then `npm run sync:registries`, then `npm run sync:school-roles:dry-run` (read the PENDING list: schools whose principal role was customised keep the old permissions), then `npm run sync:school-roles`.
