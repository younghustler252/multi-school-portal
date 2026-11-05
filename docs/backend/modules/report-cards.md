# Report Cards Module

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. This guide documents source behavior; no report-card tests, migrations, typecheck, build or runtime requests were executed during this review.

## Responsibility and boundaries

The report-cards module builds a term report for one student from the class's published subject mark sheets. It owns:

- Building/rebuilding draft report-card snapshots.
- Combining published subject totals, grades, remarks, subject positions and attendance summaries.
- Overall totals, averages, grade and class position.
- Teacher and principal remarks.
- Draft/published/sent lifecycle and guardian notification dispatch.
- HTML previews, single-card PDFs, whole-class PDFs and private PDF caching.

The grades module remains the source of truth for subject scores and publication. Report cards consume only mark sheets in `published` or `locked` status through the grades repositories. A report-card snapshot is immutable presentation input; PDF rendering uses the snapshot and saved remarks, not live grade rows.

## Runtime composition and route mount

The router is mounted at `/api/v1/report-cards`. The report-card container registers the repository, builder, notifier, renderer, PDF cache, use cases and controller. It depends on audit, grades, notifications, message templates, school, school settings, entitlements and shared storage services. The class-PDF queue is lazy-loaded and the worker resolves a separate job runner.

The school realm route guards require authentication, tenant context and the declared report-card permission. The class PDF feature additionally requires `report_cards.pdf`; the custom letterhead renderer checks `report_cards.letterhead`.

## HTTP endpoints

All paths below are relative to `/api/v1/report-cards`.

| Method | Path | Permission / feature | Behavior |
|---|---|---|---|
| GET | `/` | `report_cards.view` | Paginated cards visible to the caller |
| GET | `/templates` | `report_cards.view` or `school_settings.view` | Template catalog; use case restricts to staff |
| GET | `/template-preview` | `report_cards.view` or `school_settings.view` | Sample HTML preview; use case restricts to staff |
| GET | `/overview` | `report_cards.view` | Class build/publish overview |
| GET | `/class-pdf` | `report_cards.view` + `report_cards.pdf` | Cached PDF or 202 queued job |
| GET | `/class-pdf/status/:jobId` | `report_cards.view` | Queue status: queued, done, failed or unknown |
| POST | `/generate` | `report_cards.generate` | Generate/rebuild draft cards |
| POST | `/publish` | `report_cards.publish` | Publish a batch of cards and notify guardians |
| POST | `/unpublish` | `report_cards.publish` | Return published/sent cards to draft with a reason |
| GET | `/:id` | `report_cards.view` | Read one card |
| GET | `/:id/preview` | `report_cards.view` | Render one card as HTML data |
| GET | `/:id/pdf` | `report_cards.view` + `report_cards.pdf` | Render/download one PDF |
| PUT | `/:id/remarks` | `report_cards.generate` or `report_cards.principal_remark` | Update teacher and/or principal remark |

Fixed paths are registered before `/:id`. Template previews return JSON containing `html` and `template`; the frontend should display the HTML in a sandboxed iframe using `srcdoc`, rather than navigating the iframe to an authenticated URL.

## DTOs and request constraints

- List pagination defaults to page 1 and limit 20; maximum limit is 100. Filters: `termId`, `classId`, `studentId`, `status` (`draft`, `published`, `sent`). Omitted term uses the current term.
- Overview requires `classId`; `termId` is optional and defaults to current term.
- Generate requires `classId`; optional `termId`; optional `studentIds` must contain 1–200 UUIDs. Omitted IDs means all students on the class list.
- Remarks accepts optional nullable `teacherRemark` and/or `principalRemark`; at least one must be supplied; maximum length is 500. Null/blank clears the field.
- Publish accepts 1–200 card IDs and optional `allowMissing`.
- Unpublish accepts 1–200 card IDs and a reason of 5–500 characters.
- Template query accepts `classic`, `modern`, `minimal`, or `custom_letterhead`.
- Class PDF requires `classId`, optional term/template, and `include=published|all` (default published).
- Job ID is a 16-character lowercase hexadecimal content hash.
- DTO objects reject unknown fields where declared strict.

## Report-card calculation and snapshot semantics

The builder loads a class, term, active/completed enrolments on the class list, all class-subject assignments for that term, and the class-level grading scale. It reads grades only for published/locked sheets.

For each student:

- A published sheet contributes its subject result; an unpublished/missing sheet appears in `missing` and is never treated as zero.
- Subject totals are summed. Average is total divided by subjects with a non-null total, rounded to two decimals.
- The overall grade/remark/pass flag is calculated from the class-level current grading scale and the average.
- Overall position ranks every student on the class list by average; ties share a position. Students with no average are unranked.
- Attendance summary counts marked, present, absent, late and excused records for that term. It is null when no attendance rows are supplied.
- A card snapshot stores version, generation timestamp, a fingerprint of published class-subject sheets, session/term/class/student identity, calculated results and attendance.

A fingerprint contains each published/locked class-subject ID and its `publishedAt` timestamp. A card is stale if a sheet is reopened, republished, or another subject is published after generation. Staff see staleness metadata; families do not.

Generation creates or rebuilds draft cards. Rebuilding an editable card preserves its remarks. Published cards are skipped. A request can target selected students, but overall rank is still computed against the entire class list.

## Card lifecycle, remarks and publication

The active lifecycle is:

`draft → published → sent`

The `generated` status remains in the type/policy as a legacy editable status. Publishing/unpublishing rules treat it as editable where appropriate.

- Only draft/generated cards are editable or regenerable.
- Teacher remarks require the class teacher or an administrator with `report_cards.generate`.
- Principal remarks require `report_cards.principal_remark`.
- Publishing requires `report_cards.publish`, a non-stale snapshot, at least one scored subject, and no missing subjects unless `allowMissing=true`.
- Publishing updates each eligible card individually; one card's failure does not stop other cards in the batch. The response reports per-card outcomes.
- After publication, the card is visible to students and linked guardians.
- Guardian notifications are dispatched using the school's `report_card.ready` message template and the channel policy/plan. Idempotency keys include card ID, publication timestamp, guardian ID and channel.
- Successful notification dispatch marks the card `sent`. Notification failure does not undo publication; the response includes `notifyError`.
- Unpublishing returns published/sent cards to draft, clears publication metadata and stores the reason. A later publication is a new notification event.

The `allowMissing` bypass is currently supplied by the request, not read from a persisted school setting. Whether every publisher should be able to make that choice is a product/authorization decision recorded in the remediation register.

## Authorization and visibility

| Permission | Declared scopes/personas | Effective behavior |
|---|---|---|
| `report_cards.view` | ALL, ASSIGNED, OWN; staff, student, guardian | ALL sees all; ASSIGNED staff sees cards for classes they lead; OWN student/guardian sees only published/sent own/linked-child cards |
| `report_cards.generate` | ALL, ASSIGNED; staff | ALL or the class teacher may generate and write teacher remarks |
| `report_cards.principal_remark` | ALL; staff | Writes principal remark |
| `report_cards.publish` | ALL; staff; sensitive | Publishes or unpublishes cards |

BRANCH and unsupported scope/persona combinations resolve to no records. Students and guardians do not receive draft cards, stale metadata or staff capability flags. The class overview is staff-only in the use case and requires ALL or the class teacher. Whole-class PDF generation is also restricted to staff with class visibility.

The individual PDF/preview endpoints use the same card visibility predicate as the card detail. Families always use the school's configured template; only staff can request a different template. The template catalog and sample preview use cases explicitly reject family access.

## PDF rendering, cache and background jobs

- Single-card PDF rendering uses the frozen snapshot and current saved remarks.
- HTML rendering uses a fixed template catalog. Custom letterhead requires an uploaded letterhead and the `report_cards.letterhead` feature. If a saved default becomes unavailable after a plan downgrade, the renderer falls back to classic; explicitly requesting the unavailable template returns a clear error.
- The renderer allows only the configured Supabase storage hostname for image loading.
- PDF files are cached in private storage under school/term/card or class paths. The content hash includes renderer version, template, rendered data and school/settings updated timestamps.
- A single-card PDF cache miss renders synchronously; identical concurrent renders are deduplicated within the process.
- A whole-class PDF cache miss queues a BullMQ job and returns HTTP 202 with a job ID. The worker re-queries the cards in tenant context and writes the PDF to the cache. The client polls the status endpoint, then repeats the original class-PDF request to receive the cache hit.
- `include=published` is the default for class PDFs. `include=all` includes cards with content, including drafts with a DRAFT watermark.
- Old cache versions in a folder are evicted best-effort. Cache upload failures are non-fatal and rendering still returns the generated PDF.

## Persistence and migration

Tenant model: `ReportCard`, related to Student, Term and optionally Class. The report-card migration `20261105090000_report_cards` adds `classId`, JSONB `snapshot`, generator/publisher identity and publication/unpublish metadata. Existing published/sent cards without snapshots are returned to draft; records are retained for regeneration rather than deleted. The class foreign key uses SET NULL so deleting a class does not delete historical cards.

The repository currently uses a hand-typed `CardTable` adapter for columns introduced by that migration. Its source comment says this was used to compile against the generated Prisma client available at the time; after Prisma client regeneration it can be replaced with the generated delegate types. This is a maintainability and schema-drift watch item, not proof of a runtime defect.

## Tests and verification status

Test source inspected:

- `apps/api/tests/report-cards/policy.test.ts`
- `apps/api/tests/report-cards/generate.test.ts`
- `apps/api/tests/report-cards/publish.test.ts`
- `apps/api/tests/report-cards/read-scope.test.ts`
- `apps/api/tests/report-cards/render.test.ts`
- `apps/api/tests/report-cards/helpers.ts`

The suite covers calculation, average/ranking, missing subjects, stale fingerprints, visibility scopes, generation, remarks, publishing/unpublishing, notification failure, templates, PDF caching and class-PDF queue behavior. The tests use policy tests and in-memory fake repositories/queue/cache. No report-card-specific database migration test or HTTP router test was found in the inspected test tree.

**Not executed in this review:** tests, typecheck, build, Prisma generation, migration execution, PDF provider/storage calls, worker processing against Redis, or live HTTP requests.

## Open implementation and verification items

1. **Cross-school class-PDF job ID collision risk:** the queue uses a global BullMQ queue and the job ID is the content hash. The hash covers rendered data/template/branding version but not school ID or tenant schema; the storage folder is school-specific. Two schools with identical render payloads can therefore produce the same job ID. If one job is already queued/completed and retained, the second school's enqueue may deduplicate against the first job while its own cache remains empty. Include tenant identity in the queue job ID (while keeping the PDF content hash for cache addressing) and add a two-school collision test.
2. **Publication can race with grade-sheet changes:** the use case checks the current fingerprint, then updates cards to published without locking the relevant sheets or rechecking the fingerprint in the same transaction. A sheet could be reopened/republished after the fingerprint check and before the card update. Confirm whether the product requires strict snapshot consistency; if so, recheck/lock sheet publication state transactionally before publishing.
3. **Class-PDF status is keyed only by a content hash:** the status use case checks the shared queue by job ID and does not bind the poll to school/class ownership. It returns only a four-state status, not file contents, but cross-tenant job-existence disclosure and job-ID scoping should be reviewed.
4. **`allowMissing` is caller-controlled:** decide whether the override is an intentional per-publication choice, a school setting, or a separate sensitive permission. Add an authorization and audit test for the selected policy.
5. **No report-card HTTP tests or DB migration tests were found in the inspected suite.** Add router-level coverage and populated-schema migration coverage; current tests largely use in-memory fake repositories.
6. **CardTable uses hand-written delegate types.** Regenerate Prisma client and replace/verify the adapter types so migration/schema changes are caught by compile-time checks.
7. **Audit writes occur after card writes.** Generation, remark updates and publish/unpublish operations commit domain changes before calling audit. Align failure semantics with the shared audit policy (see remediation register).
8. **Run the full report-card policy/use-case/render tests, typecheck and build** and verify the class-PDF worker with a disposable Redis/storage environment.

## Source paths reviewed

- `apps/api/src/modules/report-cards/routes/report-card.routes.ts`
- `apps/api/src/modules/report-cards/controllers/report-card.controller.ts`
- `apps/api/src/modules/report-cards/dtos/report-card.dto.ts`
- `apps/api/src/modules/report-cards/domain/`
- `apps/api/src/modules/report-cards/report-cards.permissions.ts`
- `apps/api/src/modules/report-cards/report-cards.container.ts`
- `apps/api/src/modules/report-cards/usecases/`
- `apps/api/src/modules/report-cards/services/`
- `apps/api/src/modules/report-cards/repositories/`
- `apps/api/src/modules/grades/repositories/grade.repository.impl.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/prisma/tenant.prisma`
- `apps/api/prisma/tenant-migrations/20261105090000_report_cards/migration.sql`
- `apps/api/src/infrastructure/jobs/queues/class-pdf.queue.ts`
- `apps/api/tests/report-cards/`
