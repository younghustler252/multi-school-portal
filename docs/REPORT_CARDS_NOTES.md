# Report cards notes (the Report Cards pass)

Replaces the old report-cards module (generate one by one or by queue, PDF at generate time, `my-children`). That module was built on the old grades model and was never switched on. **All paths are under `apps/api`.**

## What a report card is
One student's results for one term, built **only from published or locked mark sheets** (never a draft, submitted or approved sheet). Status: **draft** (built, remarks editable, hidden from families) then **published** (frozen, visible) then **sent** (guardians were told). Taking a card back returns it to draft.
The card keeps a frozen **snapshot** (`ReportCard.snapshot`): subjects with every part score, total, grade, remark and subject position, the totals, the overall grade and position, attendance, and the class, term and student as they were. A mark sheet or scale changed later never changes a card that has been generated; the PDF is drawn from the snapshot.

## Endpoints (`/report-cards`)
| Route | Permission | What it does |
|---|---|---|
| GET `/report-cards?termId&classId&studentId&status&page&limit` | `report_cards.view` | Cards you may see (term defaults to the current term). **Replaces `my-children`**: students and guardians (scope OWN) get published cards only |
| GET `/report-cards/overview?classId&termId` | `report_cards.view` | The build and publish screen for one class: published subjects, every student with their LIVE average and position, card status and `stale` |
| POST `/report-cards/generate` `{ classId, termId?, studentIds? }` | `report_cards.generate` | Build or rebuild DRAFT cards (up to 200 students) |
| GET `/report-cards/:id` | `report_cards.view` | One card with the snapshot; staff also get `stale`, `staleReason`, `unpublishReason`, `can` |
| PUT `/report-cards/:id/remarks` `{ teacherRemark?, principalRemark? }` | `report_cards.generate` (teacher remark) / `report_cards.principal_remark` | Draft only; null or empty clears; 500 characters at most |
| POST `/report-cards/publish` `{ ids, allowMissing? }` | `report_cards.publish` | Publish and tell guardians. The answer lists every card |
| POST `/report-cards/unpublish` `{ ids, reason }` | `report_cards.publish` | Back to draft, hidden at once. Reason of at least 5 characters |
| GET `/report-cards/:id/preview?template=` | `report_cards.view` | The card as HTML, `{ template, fellBack, html }`, for an iframe. Same markup as the PDF. `?template=` (staff only) tries another template without saving |
| GET `/report-cards/:id/pdf?template=` | `report_cards.view` + plan feature `report_cards.pdf` | The PDF |
| GET `/report-cards/templates` | `report_cards.view` or `school_settings.view` (staff) | The picker: the four templates, `current`, `available`, `unavailableReason` |
| GET `/report-cards/template-preview?template=` | same | A SAMPLE card in the school's own name, logo and colours, as `{ template, fellBack, html }`. Nothing to generate first |

## Templates, preview and PDF
One renderer (`infrastructure/pdf/report-card.html.ts`) with four themes: **classic**, **modern**, **minimal**, **custom_letterhead**. The preview and the PDF use the same HTML, so what the admin sees is what prints. Every theme prints the same data (every score part, total, grade, subject position, overall grade and position, attendance, subjects not yet available, remarks, signature and stamp); a draft is marked DRAFT; a failed subject is highlighted.
- **How the admin picks:** the settings screen calls `GET /report-cards/templates` for the options and `GET /report-cards/template-preview?template=modern` for each look (show `html` in `<iframe sandbox srcDoc>`; an iframe cannot send the login header, so it is data and not a URL), then saves the choice with the existing School Settings call (`reportCardTemplate`). On a real card, the same `?template=` works on `/:id/preview` and `/:id/pdf` for staff.
- **Which template prints:** the school's saved one. Families never choose. The letterhead template needs the letterhead image and the plan feature `report_cards.letterhead`: asked for without them it is refused (`REPORT_CARD_TEMPLATE_UNAVAILABLE`, with the reason); saved as the default but no longer available (plan downgrade) it prints as classic and `fellBack` is true, so printing never stops.
- **Safety:** every piece of text is HTML-escaped (the old templates were not: a remark or name could inject markup into the page the browser prints); images must be https; colours must be hex. The print browser cannot run scripts and may only load images from our own storage host (and data: URLs), never `file:`, `http:` or other sites. At most 2 PDFs render at once; the rest wait.
- **Replaced:** the four old 600-line template files. `public/template-previews/*.png` were regenerated from the new renderer (neutral sample school).

## Permissions
`report_cards.view` (ALL, ASSIGNED = classes you lead as class teacher, OWN = a student's own or a guardian's children's, published only), `report_cards.generate` (ALL, or ASSIGNED = class teacher), `report_cards.principal_remark`, `report_cards.publish` (sensitive). Default roles: **principal** all four; **teacher** view and generate (ASSIGNED); **student** and **guardian** view (OWN); school admin everything.

## Rules
- **Averages and totals:** total = sum of the subject totals; average = total / subjects counted (2 decimals). A subject whose sheet is not published is listed as **missing**, never counted as 0.
- **Overall position:** every student on the class list (active or completed enrolment) is ranked by average, so the position is the real position in the class even when only one card is built. Ties share a position (80, 80, 70 is 1st, 1st, 3rd). A student with no total is not ranked.
- **Stale cards:** each card remembers which sheets (and which publication of each) it came from. If another subject is published later, or a sheet is reopened or published again, the card is **stale**: it cannot be published until it is generated again. Published cards are never changed by regeneration; take them back first.
- **Publish:** a draft that is up to date and has at least one scored subject. Subjects still unpublished block it unless `allowMissing: true` (audited). One card's problem never stops the others.
- **Remarks:** teacher remark by the class teacher or an administrator; principal remark by `report_cards.principal_remark`; draft only. Rebuilding a draft keeps its remarks.
- **Guardians are told** on publish through the school's `report_card.ready` message template (editable in Message Templates), over in-app plus email and SMS when the plan and the school's preferences allow them. Each message has an idempotency key (card, publication, guardian, channel). A failure here never undoes publishing (`notifyError` in the answer).
- **Audit:** `report_cards.generated`, `.remarks_saved` (old and new), `.published` (count, ids, allowMissing, guardians told), `.unpublished` (reason).
- Error codes: `REPORT_CARDS_NOTHING_PUBLISHED`, `REPORT_CARD_NOT_EDITABLE`, `REPORT_CARDS_NO_TERM`, `REPORT_CARD_EMPTY`.

## Migration `20261105090000_report_cards`
Adds `ReportCard.classId`, `snapshot`, `generatedById`, `publishedAt`, `publishedById`, `unpublishReason` (+ indexes). Old cards have no snapshot, so any that were published or sent go back to **draft** (nothing is deleted; generate them again). The `generated` status value stays in the database enum but is no longer used.

## Removed
The old report-cards use cases, controller, routes, mapper, `report-card` and `report-card-generation` queues and worker (generation is now a synchronous database-only step; the PDF is made on request). `/report-cards/template-previews` (static) is unchanged.

## Deploy order (from the repo root, then `apps/api`)
1. `git pull`, `npm install`.
2. **`npm run prisma:generate` and commit `apps/api/src/generated`.** The committed tenant client is older than the schema (it does not know the grades mark sheets either), so grades and report cards only type-check once it is regenerated. CI now regenerates and fails if the committed copy differs. `npm run build` regenerates too.
3. `npm run migrate:apply-to-existing-schools:dry-run`, then `npm run migrate:apply-to-existing-schools`.
4. `npm run sync:registries`, then `npm run sync:school-roles:dry-run`, then `npm run sync:school-roles` (gives existing roles the new permissions).
5. Sync the message templates catalog if your setup needs it (the catalog is code; nothing to run), and make sure the plan feature `report_cards.pdf` is on for plans that should print PDFs.

## Tests (`apps/api/tests/report-cards/`, 43)
`policy.test.ts` (9: totals, average, ties, missing subjects, absent, staleness, publish blockers, status moves, attendance), `generate.test.ts` (6), `publish.test.ts` (12: publish, stale, missing, partial failures, notifier failure, permissions, take back, remarks, DTOs, notifier messages and channels), `read-scope.test.ts` (4: who sees what, overview, detail), `render.test.ts` (13: escaping of hostile text, https-only images and hex colours, every theme prints every field, draft mark, template choice and fallback, the picker, sample preview, PDF arguments). They use in-memory fakes. Contract parity tests are in `tests/contracts/`.
**Not run:** the Prisma queries against a real database (sheet reads, the card table, attendance and guardian lookups), HTTP calls to the routes, a real PDF render through the app (the four themes were rendered to PDF and checked by eye in a browser; the app's own print path needs puppeteer's Chromium install script approved), real email or SMS delivery.

## Frontend changes
`my-children`, `bulk`, `bulk-status`, `send` and `PUT /:id` are gone. Use the table above. A card response has `snapshot.result.subjects[{ parts, ca, exam, total, grade, remark, isPass, position, outOf }]`, `missing`, `totalScore`, `averageScore`, `overallGrade`, `position`, `outOf`, and `snapshot.attendance`. Types are in `packages/contracts/src/report-cards.ts`.

## Not in scope
Caching PDFs in storage (they are rendered on request; the snapshot makes a cache key easy: card id plus snapshot time plus template). A whole-class PDF in one file. Automatic publishing when all sheets are published. Student photos on cards. A school editing its own template layout beyond the four themes and its colours, logo, stamp, signature and letterhead.
