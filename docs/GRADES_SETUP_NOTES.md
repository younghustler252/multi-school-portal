# Grades setup notes (Patch A of the Grades pass)

Setup only: **grading scales** and **assessment schemes**, per level. Mark sheets and the workflow come in the next patch. The old grades module (enter, update, publish, `my-children`) is still switched off and untouched; it is replaced in the next patch. See `GRADES_MODULE_AUDIT.md` for why.

## Levels
`default`, `primary`, `jss`, `ss`. A level with no scale or scheme of its own uses the default. `Class.level` is free text today; `levelOfClass()` maps it (Primary, Nursery, KG, Basic = primary; JSS, Junior = jss; SSS, SS, Senior = ss; anything else = default). The mark-sheet patch uses it to pick the scale and scheme for a class.

## Grading scale
A list of bands `{ minScore, grade, remark, isPass }`. **A band starts at its `minScore` and runs up to the next band's start; the top band reaches 100.** So 74.5 is in the band that starts at 70 (the old inclusive min/max bands turned 74.5 into F9). Rules: 1 to 15 bands, starts are from 0 to below 100 with at most 2 decimals, one band starts at 0, no repeated start or grade, at least one pass, and once a band is a pass every higher band is a pass. Saved in ONE transaction (the old way deleted the bands first, then created them one by one).
Every school gets the standard scale (A1 to F9, F9 below 40 is the only fail) as its default.

## Assessment scheme
The parts a subject score is made of, in order: `{ name, kind: ca | exam, maxScore }`. **Their maximum scores add up to 100**, so every scale works on 0 to 100. 1 to 8 parts, unique names, each above 0 and at most 100 with at most 2 decimals. Default for every school: **CA 40 + Exam 60**. A school can set, for example, CA1 10 + CA2 10 + Assignment 20 + Exam 60.

## Endpoints (`/grades`)
| Route | Permission |
|---|---|
| GET `/grades/scales`, GET `/grades/schemes` | `grades.view` |
| PUT `/grades/scales/:level` `{ bands }` | `grades.config` **and the plan feature `grading.custom`** |
| PUT `/grades/schemes/:level` `{ components }` | `grades.config` (no plan feature: every school may set its split) |
| DELETE `/grades/scales/:level`, DELETE `/grades/schemes/:level` | `grades.config` (puts the level back on the default; the default cannot be removed) |

Reads return every level with `usesDefault` and the scale or scheme it really uses. Band rows carry `upTo` (the next band's start, null for the top). Changes are audited old to new (`grades.scale_updated`, `grades.scale_removed`, `grades.scheme_updated`, `grades.scheme_removed`).
Error codes: `GRADES_LEVEL_INVALID`, `GRADES_SCALE_INVALID` and `GRADES_SCHEME_INVALID` (both list `details.problems` in plain words), `GRADES_DEFAULT_REQUIRED`.

## Permissions
`grades.view` (ALL, BRANCH, ASSIGNED, OWN) and `grades.config` (ALL, STAFF). Default roles: principal view ALL, teacher view ASSIGNED, student and guardian view OWN, school admin everything. The scope only starts to matter with results (next patch).

## Migration `20261103090000_grades_setup`
Creates `GradingScale`, `GradingBand`, `AssessmentScheme`, `AssessmentComponent` and the `AssessmentKind` type. One scale and one scheme per level, enforced by the database (unique index on the level, empty counted as the default). The default scale is **copied from the school's existing `GradingConfig` list when that list is usable** (it must start at 0 with no repeated starting score; a band is a pass from 40 up). An empty list (every new school) or an unusable one gets the standard scale, and a notice is printed for the unusable case. The default scheme is CA 40 + Exam 60. Nothing is deleted: `GradingConfig` stays until the next patch replaces the old module.

**Deploy order:** `git pull`, `git apply grades-setup.patch`, `npm run prisma:generate`, `npm run migrate:apply-to-existing-schools:dry-run`, `npm run migrate:apply-to-existing-schools`, `npm run sync:registries`, `npm run sync:school-roles:dry-run`, `npm run sync:school-roles`. (The last two give existing schools' roles `grades.view`.)

## Frontend
New: the six routes above. The old `/grades/config` routes were never switched on and are not replaced one-for-one: use `/grades/scales` and `/grades/schemes`.

## Tests (`tests/grades/`, 22)
`grades.policy.test.ts` (level mapping, 74.5, every band and scheme rule, request shapes, permissions), `grades-setup.db.test.ts` (real Postgres: defaults in a new school, saving and removing per level, invalid input changes nothing, all-or-nothing replace, audit old to new, database rules), `migration.db.test.ts` (populated schools: usable list copied, empty and unusable lists replaced). Database tests need `TEST_DATABASE_URL`.
**Not run:** HTTP calls to the routes (the app was not started) and the plan-feature gate on `PUT /grades/scales/:level` (it uses the same `requireFeature` as the fees routes).

## Next
Patch B: mark sheets and the workflow (draft, submitted, approved, published, locked), scores per part, positions with ties, parents and students see published sheets only.
