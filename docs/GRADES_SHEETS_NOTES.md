# Grades notes: mark sheets and the workflow (Patch B of the Grades pass)

Replaces the old grades module (enter, bulk enter, update, publish, `my-children`, the global grading list). See `GRADES_MODULE_AUDIT.md` for what was wrong with it. Setup (scales and schemes) is in `GRADES_SETUP_NOTES.md`. **All paths below are under `apps/api`.**

## What a mark sheet is
One subject, in one class, for one term (one per class-subject). Its status moves **draft, submitted, approved, published, locked**, and back to draft by "reopen". Scores can only change while it is a **draft**. `Grade.isPublished` is kept in step with the sheet and is never set on its own: a grade is visible to students and guardians only through a **published or locked** sheet.

## Endpoints (`/grades`)
| Route | Permission | What it does |
|---|---|---|
| GET `/grades/sheets?termId&classId&subjectId&status&page&limit` | `grades.view` | The sheets you may see (term defaults to the current term), with status, students on the list and how many are complete |
| GET `/grades/sheets/:classSubjectId` | `grades.view` | One sheet: the parts, every student on the class list with scores per part, total, grade, remark, position; `can` says what the viewer may do now |
| PUT `/grades/sheets/:classSubjectId/scores` | `grades.enter` | `{ entries: [{ studentId, scores: [{ position, score?, absent? }] }] }` (1 to 200 students) |
| POST `.../submit` | `grades.submit` | draft to submitted |
| POST `.../approve` | `grades.approve` | submitted to approved |
| POST `.../publish` | `grades.publish` | approved to published |
| POST `.../lock` | `grades.publish` | published to locked |
| POST `.../reopen` `{ reason }` | `grades.approve` (while submitted or approved) or `grades.reopen` (published or locked) | back to draft; reason of at least 5 characters |
| GET `/grades?studentId&classId&subjectId&termId&page&limit` | `grades.view` | The results list (page at most 100). **Replaces `my-children`.** |

**Removed:** the old `/grades/*` routes (they were never switched on): enter, bulk, update, publish, config, my-children.

## Permissions
`grades.enter` and `grades.submit` (ALL, or ASSIGNED = **the teacher of that subject**; the class teacher may look but not enter), `grades.approve`, `grades.publish`, `grades.reopen` (sensitive), plus `grades.view` and `grades.config` from the setup patch. Default roles: **teacher** enter + submit (ASSIGNED); **principal** approve + publish (ALL); school admin everything. `grades.view` ASSIGNED sees the subjects you teach and every subject of a class you lead; OWN (student, guardian) sees **published results only**.

## Rules
- **Scores:** one per part of the sheet's scheme (default CA 40 + Exam 60). Each is from 0 to the part's maximum with at most 2 decimals. A part left empty is **not entered, never 0**. `absent: true` counts 0 in the total and shows as ABS. The total, grade and remark appear only when **every part is entered**; until then they are empty and the student is not ranked.
- **Save is per student:** a student whose entry is not valid is skipped with a reason (`not_on_class_list`, `duplicate_entry`, `invalid_score` with the message) and the rest are saved. Students must be on the class list (active or completed enrolment in that class that term).
- **The sheet keeps its parts:** copied from the school's scheme for the class's level when the sheet is created. A draft with **nothing entered yet** follows the school's current scheme; once scores exist the sheet keeps what it started with.
- **Positions** are per subject, recomputed in the same transaction as every save. **Ties share a position** (80, 80, 70 is 1st, 1st, 3rd). `outOf` is how many were ranked. The overall class position and the average across subjects belong to the Report Cards pass.
- **Submit and publish need a complete sheet:** everyone on the class list has every part entered or is absent. The answer (`GRADES_SHEET_INCOMPLETE`) names who and which part. An empty class list is `GRADES_SHEET_EMPTY`.
- **Publish** applies the school's **current scale** to every grade, ranks the class, shows the grades, and **freezes the scale used** on the sheet (`scale`). A scale changed afterwards does not change published results. Approval is required before publishing (constant `REQUIRE_APPROVAL`; a school setting can come later).
- **Reopen** needs a reason, hides the grades from students and guardians at once, clears the review and publish stamps and the frozen scale, and keeps the reason. The history is in the audit trail.
- **Two people at once:** the sheet row is locked while it is saved or moved, so changes happen one after the other. Two people opening the same new sheet get the same sheet.
- **Audit:** `grades.scores_saved` (old to new per part, with names, up to 100), `grades.sheet_submitted`, `_approved`, `_published` (with how many grades were recomputed and the scale), `_locked`, `_reopened` (with the reason).
- Error codes: `GRADES_SHEET_NOT_EDITABLE`, `GRADES_ILLEGAL_TRANSITION`, `GRADES_SHEET_INCOMPLETE`, `GRADES_SHEET_EMPTY`.

## Report cards
The old repository is now `gradeRepository`, **read-only**, and returns **published or locked grades only**, so a report card can never read a draft. It still reads the first subject's position as the student's overall position: fix in the Report Cards pass (compute the overall position and average from published sheets).

## Migration `20261104090000_grades_sheets`
Creates `ResultSheet`, `GradeScore`; `Grade.sheetId` becomes required. **Existing grades are converted exactly or the migration stops with a clear message** (nothing is guessed): each class-subject with grades becomes a sheet (published only if EVERY grade in it was published, otherwise a draft, and in that case its grades are hidden); each CA / exam score becomes a part score. It stops if a grade's term differs from its class-subject's term, if a score is above the default scheme's maximum or below 0, or if the default scheme is not exactly one CA part and one exam part while grades exist. Published sheets converted this way have no frozen scale (it was not recorded). The old `GradingConfig` table is no longer used; it is left in place for now (provisioning still fills it) and can be dropped in a later clean-up.

## Deploy order (from the repo root, then `apps/api`)
1. **Apply `grades-setup-fix.patch` first** if it is not on your branch yet (the setup migration was in the wrong folder), then this patch: `git pull`, `git apply grades-sheets.patch`.
2. `npm run prisma:generate` (the generated client is not in the patch).
3. `npm run migrate:apply-to-existing-schools:dry-run`, then `npm run migrate:apply-to-existing-schools`.
4. `npm run sync:registries`, then `npm run sync:school-roles:dry-run`, then `npm run sync:school-roles` (gives existing teacher and principal roles the new permissions).

## Frontend changes
New routes above; old ones gone. A sheet response has `parts`, `students[{ student, scores[{ position, score, absent }], total, grade, remark, position }]`, `status`, `history`, and `can{ enter, submit, approve, publish, lock, reopen }`. Results list rows: `{ student, class, subject, term, status, scores[{ name, kind, maxScore, score, absent }], total, grade, remark, position, outOf }`.

## Tests (`apps/api/tests/grades/`)
`sheet.policy.test.ts` (12: workflow, scores, totals, positions), `sheets.db.test.ts` (20, real Postgres: who may look and enter, totals and ranks, ties, absent, skipped reasons, audit, incomplete submit, two people at once, each workflow step and what students and guardians see, frozen scale, lock, reopen, regrading on publish, lists, scheme snapshot), `sheets-migration.db.test.ts` (5: populated schools, every refusal). Database tests need `TEST_DATABASE_URL`.
**Not run:** HTTP calls to the routes (the app was not started); the report-card module (switched off).

## Not in scope
Overall class position and averages, report card layout (Report Cards pass); alerts to guardians when results are published (Notifications pass); automatic locking after the term ends; importing scores from a spreadsheet.
