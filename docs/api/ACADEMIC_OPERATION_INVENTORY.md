# Academic API Operation Inventory

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06.  
> **Status:** First operation-level pass. Routes, middleware, controller behavior and principal DTOs were inspected. This is not the canonical OpenAPI document and does not claim runtime verification.

## Contract boundary and conventions

All paths below are mounted beneath `/api/v1`. These are school-tenant endpoints, except where a route explicitly uses a persona guard. The application globally performs optional authentication, tenant resolution and tenant ownership validation; each route below then applies its own authentication/permission/persona middleware.

The acting user is derived from the verified session (`req.auth`), not accepted from request bodies. Controllers obtain access context through `getAccess(req)` where scope-sensitive use cases require it.

### Success response conventions observed

- `sendSuccess`: HTTP 200, `{ success: true, message, data }`.
- `sendCreated`: HTTP 201 with the same envelope.
- Paginated list controllers in Grades, Report Cards, Enrolment and Students directly return HTTP 200 with `{ success: true, message, data, meta }`.
- Individual report-card PDF and ready class-PDF responses are binary PDF bodies with `Content-Type: application/pdf` and inline content disposition.
- A class-PDF cache miss returns HTTP 202 using the normal success envelope and includes a job ID, filename, card count and poll URL.
- Student CSV template returns HTTP 200 with `text/csv` and attachment disposition.
- Error serialization is handled centrally. The API's cross-cutting error contract remains subject to REM-114 and the API error-handling guide.

The default response helper does not make all endpoints uniform: some controllers construct paginated envelopes directly and PDF/CSV endpoints return non-JSON bodies. Preserve these distinctions in the contract.

## Grades setup

Router mount: `/api/v1/grades`  
Route source: `apps/api/src/modules/grades/routes/grades-setup.routes.ts`

| Method | Path | Permission | Request contract | Success |
|---|---|---|---|---|
| GET | `/scales` | `grades.view` | No declared DTO | 200 success envelope |
| PUT | `/scales/:level` | `grades.config` + feature `grading.custom` | Path level: `default\|primary\|jss\|ss`; strict body `{ bands: [{ minScore, grade, remark, isPass }] }` | 200 success envelope |
| DELETE | `/scales/:level` | `grades.config` | Same level enum; no body DTO | 200 success envelope |
| GET | `/schemes` | `grades.view` | No declared DTO | 200 success envelope |
| PUT | `/schemes/:level` | `grades.config` | Path level enum; strict body `{ components: [{ name, kind: "ca"\|"exam", maxScore }] }` | 200 success envelope |
| DELETE | `/schemes/:level` | `grades.config` | Same level enum; no body DTO | 200 success envelope |

Scale writes are additionally feature-gated; scheme writes are not. Both read operations use `grades.view`. The route layer does not attach a level-parameter validation middleware; use-case/domain validation and the controller's string extraction must be reflected accurately, and route-level invalid-level behavior still needs HTTP verification.

## Grades mark sheets and results

Router mount: `/api/v1/grades`  
Route source: `apps/api/src/modules/grades/routes/grades-sheets.routes.ts`

| Method | Path | Permission | Request contract | Success |
|---|---|---|---|---|
| GET | `/` | `grades.view` | Query: page, limit, studentId, classId, subjectId, termId; UUID filters; page default 1, limit default 20/max 100 | 200 paginated envelope |
| GET | `/sheets` | `grades.view` | Query: page, limit, termId, classId, subjectId, status; page default 1, limit default 20/max 100 | 200 paginated envelope |
| GET | `/sheets/:classSubjectId` | `grades.view` | UUID classSubjectId | 200 success envelope |
| PUT | `/sheets/:classSubjectId/scores` | `grades.enter` | UUID classSubjectId; strict body `{ entries: [{ studentId, scores: [{ position, score?, absent? }] }] }`; entries 1..MAX_SCORE_ENTRIES; positions 1..8; score nullable/optional | 200 success envelope |
| POST | `/sheets/:classSubjectId/submit` | `grades.submit` | UUID classSubjectId; no declared body DTO | 200 success envelope |
| POST | `/sheets/:classSubjectId/approve` | `grades.approve` | UUID classSubjectId; no declared body DTO | 200 success envelope |
| POST | `/sheets/:classSubjectId/publish` | `grades.publish` | UUID classSubjectId; no declared body DTO | 200 success envelope |
| POST | `/sheets/:classSubjectId/lock` | `grades.publish` | UUID classSubjectId; no declared body DTO | 200 success envelope |
| POST | `/sheets/:classSubjectId/reopen` | `grades.approve` OR `grades.reopen` | UUID classSubjectId; strict body `{ reason }`, trimmed length 5..500 | 200 success envelope |

The controller parses list query schemas directly because the shared validation middleware does not write parsed/defaulted query values back to the request. The list endpoints therefore return `data` and `meta` as sibling properties rather than nesting metadata in `data`.

The sheet workflow is stateful: save scores, submit, approve, publish, lock and reopen are distinct operations. The frontend must not infer that publishing and locking are interchangeable.

## Report cards

Router mount: `/api/v1/report-cards`  
Route source: `apps/api/src/modules/report-cards/routes/report-card.routes.ts`

| Method | Path | Permission / feature | Request contract | Success |
|---|---|---|---|---|
| GET | `/` | `report_cards.view` | Query: page, limit, termId, classId, studentId, status; page default 1, limit default 20/max 100 | 200 paginated envelope |
| GET | `/templates` | `report_cards.view` OR `school_settings.view` | No declared DTO | 200 success envelope |
| GET | `/template-preview` | `report_cards.view` OR `school_settings.view` | Optional query `template`: classic, modern, minimal, custom_letterhead | 200 success envelope containing preview data |
| GET | `/overview` | `report_cards.view` | Required UUID classId; optional UUID termId | 200 success envelope |
| GET | `/class-pdf` | `report_cards.view` + feature `report_cards.pdf` | Required UUID classId; optional UUID termId/template; include=published (default) or all | 200 binary PDF on cache hit; 202 queued envelope on cache miss |
| GET | `/class-pdf/status/:jobId` | `report_cards.view` | jobId: 16 lowercase hexadecimal characters | 200 success envelope with job status |
| POST | `/generate` | `report_cards.generate` | Strict body: classId UUID; optional termId UUID; optional studentIds UUID array (1..MAX_CARDS_PER_REQUEST) | 200 success envelope |
| POST | `/publish` | `report_cards.publish` | Strict body: ids UUID array (1..MAX_CARDS_PER_REQUEST); optional allowMissing boolean | 200 success envelope |
| POST | `/unpublish` | `report_cards.publish` | Strict body: ids UUID array; reason trimmed length UNPUBLISH_REASON_MIN..500 | 200 success envelope |
| GET | `/:id` | `report_cards.view` | UUID id | 200 success envelope |
| GET | `/:id/preview` | `report_cards.view` | UUID id; optional template query | 200 success envelope containing HTML/template data |
| GET | `/:id/pdf` | `report_cards.view` + feature `report_cards.pdf` | UUID id; optional template query | 200 binary PDF |
| PUT | `/:id/remarks` | `report_cards.generate` OR `report_cards.principal_remark` | UUID id; strict body with optional teacherRemark/principalRemark (nullable, max REMARK_MAX); at least one supplied | 200 success envelope |

The class-PDF operation is deliberately asynchronous on a cache miss. The client should poll the returned `pollUrl`; after the job reports completion, it repeats the original `GET /class-pdf` request to receive the cached PDF. The status operation currently authorizes using `report_cards.view`; its job-ownership boundary is recorded in the remediation register.

Template-preview routes are not equivalent to family-facing card previews. The route accepts either report-card view or school-settings view, while the use case applies staff/family restrictions. Document effective access from both layers, not route middleware alone.

## Enrolment

Router mount: `/api/v1/enrolments`  
Route source: `apps/api/src/modules/enrolment/routes/enrolment.routes.ts`

| Method | Path | Permission | Request contract | Success |
|---|---|---|---|---|
| GET | `/` | `enrolment.view` | Query: page, limit, classId, termId, studentId, status, search; page default 1, limit default 20/max 100 | 200 paginated envelope |
| POST | `/` | `enrolment.manage` | Strict body: studentId, classId, termId (UUIDs) | 201 created envelope |
| POST | `/bulk` | `enrolment.manage` | Strict body: studentIds UUID array (1..200), classId UUID, termId UUID | 200 success envelope |
| GET | `/promotion-preview` | `enrolment.promote` | Required UUID termId; optional UUID newTermId | 200 success envelope |
| POST | `/promote` | `enrolment.promote` | Strict body: currentTermId UUID, newTermId UUID, overrides array (max 500, default []); each override action promote/repeat/graduate/exclude; classId required only for promote | 200 success envelope |
| PUT | `/:id` | `enrolment.manage` | Path id; strict body has status (active/withdrawn/transferred/completed) OR classId, never both; optional reason max 300 | 200 success envelope |

Promotion is a preview-then-execute workflow. The server derives default destinations from the saved class order; the client submits only student-specific overrides. A promotion override must include classId exactly when action is `promote`.

## Students

Router mount: `/api/v1/students`  
Route source: `apps/api/src/modules/students/routes/student.routes.ts`

| Method | Path | Permission / persona | Request contract | Success |
|---|---|---|---|---|
| GET | `/import/template` | `students.import` | No body | 200 CSV attachment |
| POST | `/import/preview` | `students.import` + upload limiter | multipart/form-data, file field `file`, max 2 MB | 200 success envelope; preview only, saves nothing |
| POST | `/import` | `students.import` + upload limiter | multipart/form-data, file field `file`, max 2 MB | 200 success envelope |
| GET | `/me` | authenticated STUDENT persona | No body | 200 success envelope |
| GET | `/` | `students.view` | Query: page, limit, search, gender, status, branchId; page default 1, limit default 20/max 100; status default active | 200 paginated envelope |
| POST | `/` | `students.manage` | Strict body; firstName/lastName required; optional admissionNumber, demographics, address, branchId and duplicate confirmation | 201 created envelope |
| GET | `/:id` | `students.view` | Path id | 200 success envelope |
| PUT | `/:id` | `students.manage` | Strict partial body; at least one mutable field; blank/null handling is field-specific | 200 success envelope |
| POST | `/:id/deactivate` | `students.manage` | Strict body with optional reason; DTO defaults to empty object | 200 success envelope |
| POST | `/:id/reactivate` | `students.manage` | No declared body DTO | 200 success envelope |
| POST | `/:id/undo-graduation` | `students.manage` | Strict body: reason length 5..500; reopenEnrolment boolean default false | 200 success envelope |
| POST | `/:id/transfer` | `students.transfer` | Strict body: toBranchId UUID, optional classId UUID, reason length 5..500 | 200 success envelope |
| POST | `/:id/photo` | `students.manage` + upload limiter | multipart/form-data, file field `photo`, max 2 MB | 200 success envelope |

Photo and CSV uploads use in-memory Multer storage. Their route order includes tenant-context re-establishment after multipart parsing. Upload failures are translated to module-specific 400 errors (`INVALID_IMAGE` and `IMPORT_FILE_INVALID`); missing-file failures are handled by controller/use-case domain errors.

The student self-profile endpoint uses an explicit STUDENT persona guard rather than `students.view`. Student lifecycle fields are not client-writable through the general update DTO; graduation reversal has a dedicated reason-bearing endpoint.

## Contract issues and verification requirements

1. **Query parsing must be explicit.** The inspected list controllers parse Zod query schemas themselves because validation middleware does not persist parsed values/defaults. This must remain true in the OpenAPI contract and client expectations until REM-113 is resolved.
2. **Response shapes are not uniform.** Paginated lists use top-level `meta`; ordinary JSON operations use `data`; PDF and CSV routes return non-JSON payloads; class-PDF cache misses return 202. Model each response explicitly.
3. **Route middleware is not the whole authorization policy.** Scope-aware use cases further constrain classes, subjects, students, guardians and published visibility. Document permission keys and scopes, then verify effective behavior with integration tests.
4. **No route-level HTTP tests were established by this source pass.** Existing module tests are largely policy/use-case/repository tests. Add HTTP tests for middleware, parameter/query/body validation, status codes, content types, envelopes and tenant context.
5. **Report-card class-PDF status ownership and cross-tenant job ID behavior** remain remediation items; do not imply that a job ID alone proves school ownership.
6. **The grades setup routes do not attach DTO validation to level path parameters.** Add route-level invalid-parameter tests and decide whether to validate the level at the boundary.
7. **Multipart upload contracts need integration coverage**, including size limit, wrong field, missing file, tenant context restoration and successful storage.
8. **This document records source behavior only.** Unit tests, DB/migration tests, worker/storage integration, typecheck, build and live HTTP requests were not executed as part of this pass.

## Source files inspected

- `apps/api/src/app.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/src/shared/utils/api-response.ts`
- `apps/api/src/modules/grades/routes/grades-setup.routes.ts`
- `apps/api/src/modules/grades/routes/grades-sheets.routes.ts`
- `apps/api/src/modules/grades/controllers/grades-setup.controller.ts`
- `apps/api/src/modules/grades/controllers/grades-sheets.controller.ts`
- `apps/api/src/modules/grades/dtos/grades-setup.dto.ts`
- `apps/api/src/modules/grades/dtos/grades-sheets.dto.ts`
- `apps/api/src/modules/report-cards/routes/report-card.routes.ts`
- `apps/api/src/modules/report-cards/controllers/report-card.controller.ts`
- `apps/api/src/modules/report-cards/dtos/report-card.dto.ts`
- `apps/api/src/modules/enrolment/routes/enrolment.routes.ts`
- `apps/api/src/modules/enrolment/controllers/enrolment.controller.ts`
- `apps/api/src/modules/enrolment/dtos/enrolment.dto.ts`
- `apps/api/src/modules/students/routes/student.routes.ts`
- `apps/api/src/modules/students/controllers/student.controller.ts`
- `apps/api/src/modules/students/dtos/student.dto.ts`
