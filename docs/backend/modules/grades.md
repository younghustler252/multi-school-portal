# Grades Module

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. This guide documents the implementation found in the source paths listed below. It is not a claim that the API has been runtime-tested. Database tests are present but were inspected, not executed during this review.

## Responsibility and boundaries

The grades module owns school grading configuration and subject mark sheets:

- Grading scales: score bands, grade labels, remarks and pass/fail classification.
- Assessment schemes: the score components (for example, continuous assessment and examination) whose maximums total 100.
- Mark sheets: one workflow for one class-subject assignment, with a frozen component scheme, per-student component scores, computed totals/grades/ranks and controlled publication.
- Read-only published grade access for downstream report-card generation.

The report-cards module consumes published grades through `GradeRepositoryImpl`. It does not own score entry or grading configuration.

## Runtime composition and route mounts

The API mounts both grades routers at `/api/v1/grades`:

- `grades-setup.routes.ts`
- `grades-sheets.routes.ts`

The setup and sheet routers are registered separately at the same prefix in `apps/api/src/routes/index.ts`. The module's `registerGradesSetup` container registration supplies both controllers, their use cases and repositories, plus the read-only grade repository. The registration depends on the audit service.

All routes are school-realm routes and require authentication plus tenant context. Permission middleware is applied at the route boundary; use cases perform additional resource/scope checks for sheet access and writes.

## HTTP endpoints

All paths below are relative to `/api/v1/grades`.

### Grading configuration

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/scales` | `grades.view` | Returns default, primary, JSS and SS scales, including effective default fallback |
| PUT | `/scales/:level` | `grades.config` + feature `grading.custom` | Replaces a level's grading bands |
| DELETE | `/scales/:level` | `grades.config` | Removes a non-default level scale so it falls back to default |
| GET | `/schemes` | `grades.view` | Returns default, primary, JSS and SS assessment schemes, including fallback |
| PUT | `/schemes/:level` | `grades.config` | Replaces a level's assessment components |
| DELETE | `/schemes/:level` | `grades.config` | Removes a non-default level scheme so it falls back to default |

Level keys are `default`, `primary`, `jss`, and `ss`. The default scale and scheme cannot be deleted. Custom grading scales require the `grading.custom` plan feature; custom assessment schemes do not.

### Mark sheets and results

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/` | `grades.view` | Paginated results list; family/student visibility is published-only |
| GET | `/sheets` | `grades.view` | Paginated mark-sheet list |
| GET | `/sheets/:classSubjectId` | `grades.view` | Opens one sheet and its students, scores, summary, history and capability flags |
| PUT | `/sheets/:classSubjectId/scores` | `grades.enter` | Batch-save component scores for students |
| POST | `/sheets/:classSubjectId/submit` | `grades.submit` | Submit a complete draft for review |
| POST | `/sheets/:classSubjectId/approve` | `grades.approve` | Approve a submitted sheet |
| POST | `/sheets/:classSubjectId/publish` | `grades.publish` | Recompute using the current scale, rank and publish |
| POST | `/sheets/:classSubjectId/lock` | `grades.publish` | Lock a published sheet against score changes |
| POST | `/sheets/:classSubjectId/reopen` | `grades.approve` or `grades.reopen` | Return a non-draft sheet to draft with a reason |

The sheet identifier in the route is the `ClassSubject.id`, not the `ResultSheet.id`. A sheet row is created lazily when a draft is opened or scores are first saved. A sheet is unique per class-subject assignment; class-subject assignments are term-specific.

### Query and request validation

- Sheet/result list pagination defaults to page 1 and limit 20; maximum limit is 100.
- Sheet filters: `termId`, `classId`, `subjectId`, `status`. Omitted term defaults to the current term.
- Result filters: `studentId`, `classId`, `subjectId`, `termId`.
- Scale writes accept 1–15 strict band objects: `minScore`, `grade`, `remark`, `isPass`.
- Scheme writes accept 1–8 strict component objects: `name`, `kind` (`ca` or `exam`), `maxScore`.
- Score writes accept 1–200 student entries. Each entry contains a UUID `studentId` and 1–8 score-part entries. Each part has a 1-based `position`, optional nullable `score`, and optional `absent`.
- Reopen requires a trimmed reason of at least 5 and at most 500 characters.
- DTOs reject unknown properties. Domain policies perform cross-item validation that Zod DTOs alone cannot express.

## Grading configuration rules

### Grading scales

A band begins at `minScore` and extends to the next band's starting score; the highest band reaches 100. This avoids gaps between bands. Validation requires:

- 1–15 bands.
- Every start is finite, from 0 inclusive to below 100, with at most two decimal places.
- No duplicate starting scores or duplicate grade labels (case-insensitive).
- A band starting at zero.
- At least one pass band; once a pass band begins, every higher band must also be a pass.

The configured scale is sorted for presentation and grade selection. The standard seeded scale is A1–F9, with the lowest band beginning at zero.

### Assessment schemes

A scheme contains 1–8 uniquely named components. Each component has a positive maximum no greater than 100 and at most two decimal places. Component maxima must total exactly 100. The standard scheme is CA 40 + Exam 60.

### Level selection

The class's free-text `level` is mapped to primary, JSS or SS using name-prefix recognition. Unrecognized or empty values use the default configuration. A level-specific configuration overrides the default only for that level.

## Mark-sheet workflow and invariants

The workflow is:

`draft → submitted → approved → published → locked`

A reopen returns any non-draft state to draft. The implementation currently has `REQUIRE_APPROVAL = true`; the policy function supports a no-approval path, but that value is a constant rather than a school setting.

- Scores are editable only while the sheet is draft.
- The subject teacher may enter and submit scores for their assigned subject. A class teacher may view the sheet but cannot enter or submit unless they also teach that subject.
- Submission and publication both require every student currently on the class list to have every component scored or marked absent.
- Withdrawn and transferred enrolments are excluded from the mark-sheet register; active and completed enrolments are included by the shared enrolment status set.
- A score cannot exceed its component maximum, be negative, or have more than two decimal places. A student cannot be both absent and have a numeric score for the same component.
- A missing component is not zero. An absent component contributes zero. A total, grade and rank are unavailable until every component is entered or marked absent.
- Class positions are subject-specific. Tied totals share a position and the next position skips accordingly. Students with no total are not ranked.
- Saving a batch skips duplicate student entries after the first, students not on the class list, and invalid score entries; each skip includes a reason. Valid entries in the same batch can still be saved.
- A sheet row is locked with `SELECT ... FOR UPDATE` while score writes and state transitions run. Sheet creation handles a concurrent unique-key collision by loading the winning row.
- The sheet snapshots its component scheme. A draft with no saved component scores can adopt a changed current scheme; once scores exist, its components remain fixed.
- Publishing recomputes totals/grades with the school's current grading scale, recomputes class positions, sets grades published and stores the scale snapshot on the sheet.
- Locked sheets remain visible to families. Reopening hides the grades immediately and clears the previous submission/approval/publication/lock metadata while retaining reopen metadata and reason.
- Every successful transition is audited. Score changes are audited with student/component names; the event stores at most the first 100 component changes.

## Authorization and visibility

| Permission | Declared scopes/personas | Effective behavior |
|---|---|---|
| `grades.view` | ALL, BRANCH, ASSIGNED, OWN; staff, student, guardian | ALL sees all; ASSIGNED staff sees subjects they teach and subjects in classes they lead; OWN student sees own published results; OWN guardian sees linked children's published results |
| `grades.enter` | ALL, ASSIGNED; staff | ALL or assigned subject teacher |
| `grades.submit` | ALL, ASSIGNED; staff | ALL or assigned subject teacher |
| `grades.approve` | ALL; staff | Approves or sends a submitted/approved sheet back to draft |
| `grades.publish` | ALL; staff | Publishes or locks |
| `grades.reopen` | ALL; staff; sensitive | Reopens published/locked sheets with a reason |
| `grades.config` | ALL; staff | Changes scales and schemes |

The scope service explicitly resolves BRANCH and unsupported scope/persona combinations to an empty result because classes are not branch-linked in the grades scope implementation. This behavior is important for frontend expectations and is recorded as a remediation item below.

The route-level `grades.view` permission also protects scale/scheme reads. The route does not separately restrict those reads to staff, even though the setup is primarily an administrative capability; OWN users can therefore reach the read-only configuration endpoints if their permission is granted. No write access follows from that read permission.

## Persistence and migrations

Tenant Prisma models include:

- `GradingScale` and `GradingBand`
- `AssessmentScheme` and `AssessmentComponent`
- `ResultSheet` and `GradeScore`
- `Grade`, now linked to a required `ResultSheet`

Relevant tenant migrations:

- `20261103090000_grades_setup`: creates scale/scheme tables, constraints, one-default-per-level expression indexes, and seeds a default scale/scheme. Existing legacy grading configuration is copied only when it is usable; otherwise the standard A1–F9 scale is seeded.
- `20261104090000_grades_sheets`: creates mark-sheet and component-score tables, migrates legacy grades into sheets and per-component scores, and makes `Grade.sheetId` required. The migration intentionally stops when old grades cannot be converted without guessing (term mismatch, incompatible default scheme, or scores outside component maximums).

The SQL migration contains constraints for unique band starts per scale, unique component positions per scheme, valid score ranges, and absent/numeric-score exclusivity. Application-level validation enforces additional rules such as the scheme sum being 100 and the scale starting at zero.

## Downstream integration

`GradeRepositoryImpl.findByStudentAndTerm(studentId, termId)` is read-only and returns only rows whose sheet is published or locked. Report-card generation depends on this boundary rather than reading draft/in-review results. The grade entity exposes the legacy CA/exam aggregate fields alongside total, grade, remark, subject position and ranked-student count.

## Tests and verification status

Test source inspected:

- `apps/api/tests/grades/grades.policy.test.ts`
- `apps/api/tests/grades/grades-setup.db.test.ts`
- `apps/api/tests/grades/migration.db.test.ts`
- `apps/api/tests/grades/sheet.policy.test.ts`
- `apps/api/tests/grades/sheets.db.test.ts`
- `apps/api/tests/grades/sheets-migration.db.test.ts`

The tests cover scale/scheme validation, default seeding, legacy migration, sheet creation, score validation and aggregation, rankings/ties, concurrent first writes, scope behavior, workflow transitions, publication visibility, reopen behavior and read-only downstream grade access.

**Not executed in this review:** unit tests, database tests, migration tests, typecheck, build, HTTP-level route tests, or live API requests. Database tests are conditional on `TEST_DATABASE_URL` and a test database name containing `test`.

## Open implementation and verification items

1. **BRANCH scope is declared but not implemented for grades.** `grades.view` advertises BRANCH, while the scope service returns an empty predicate for it. Confirm intended branch semantics and either implement them after class/branch ownership is defined or remove the unsupported grant.
2. **Approval requirement is hard-coded.** `REQUIRE_APPROVAL` is always true. Decide whether approval is always mandatory or should be backed by a school setting, and remove the misleading unused configurable policy path if it is not configurable.
3. **No HTTP route contract tests were found in the inspected grades test folder.** Existing tests exercise policies and use cases/repositories directly. Add route-level tests for middleware, path params, validation and response envelopes.
4. **Execute the conditional DB/migration tests and full typecheck/build** in a disposable test environment before treating the migration and transaction behavior as runtime-verified.
5. **Review whether setup reads should be staff-only.** Student/guardian roles may have OWN `grades.view`; the current read routes expose scale/scheme configuration to any principal with that permission. Decide whether this is intentional.
6. **Audit behavior after committed writes.** Several use cases write to the database and then call the audit service outside the transaction. Confirm the intended failure semantics if audit persistence fails after the domain change has committed.

## Source paths reviewed

- `apps/api/src/modules/grades/routes/grades-setup.routes.ts`
- `apps/api/src/modules/grades/routes/grades-sheets.routes.ts`
- `apps/api/src/modules/grades/controllers/grades-setup.controller.ts`
- `apps/api/src/modules/grades/controllers/grades-sheets.controller.ts`
- `apps/api/src/modules/grades/dtos/grades-setup.dto.ts`
- `apps/api/src/modules/grades/dtos/grades-sheets.dto.ts`
- `apps/api/src/modules/grades/domain/grades.policy.ts`
- `apps/api/src/modules/grades/domain/sheet.policy.ts`
- `apps/api/src/modules/grades/domain/grades.errors.ts`
- `apps/api/src/modules/grades/grades.permissions.ts`
- `apps/api/src/modules/grades/grades-setup.container.ts`
- `apps/api/src/modules/grades/usecases/`
- `apps/api/src/modules/grades/services/`
- `apps/api/src/modules/grades/repositories/`
- `apps/api/src/routes/index.ts`
- `apps/api/prisma/tenant.prisma`
- `apps/api/prisma/tenant-migrations/20261103090000_grades_setup/migration.sql`
- `apps/api/prisma/tenant-migrations/20261104090000_grades_sheets/migration.sql`
- `apps/api/tests/grades/`
