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
- Editable templates / roles only GAIN missing permissions. Nothing is changed or removed. `--prune` makes school copies exact too.
- A template's `version` goes up by 1 whenever its permissions change. A school role records the version it last matched.
- Skipped: custom roles, roles marked `isCustomized` (listed at the end of the run so an admin can add permissions by hand), roles whose template is missing or inactive.
- One transaction per school. A failed school is rolled back and the run continues; the exit code is 1 if any school failed.

## Known limits
- Until the platform role console records deliberate removals, an editable template cannot keep a grant the code lists (the next deploy adds it back).
- Nothing in the app marks a school role `isCustomized` yet. The flag is only honoured by the sync; set it where school role editing is built.

## Tests
- `tests/foundation/role-sync.planner.test.ts`: the pure planners.
- Checked on a scratch Postgres (22 tenant migrations applied to a fresh schema, roles seeded as an old environment): dry run writes nothing; editable role gains permissions and keeps its own extras; locked role made exact; customised role untouched; second run changes nothing; prune removes extras.
- NOT run: the template sync (`syncRoleTemplates`) against a database, because Prisma's engine cannot be downloaded in the sandbox. It compiles with no new errors; run `npm run sync:registries` on a copy first and read the `grantsChanged` line in its output.
