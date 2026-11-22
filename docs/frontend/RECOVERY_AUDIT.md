# Deferred-work recovery audit

Date: 2026-11-22. Commits audited: `refactor/api` = `ff41ba2fe1b7a9a9c9ba69d07d9bdf5b83021674` (tip of `origin/refactor/api` fetched 2026-11-22; contains the merges of #47, #48, #49, #51, #55 and #56, checked by history); `refactor/web` = `e2c80d6151cb040ba0a2a4607d96cf1b8810f98e` (merge of #32). Compares `refactor/api` (tip at that date, includes #47, #48, #49, #51, #55, #56) with `refactor/web` (tip, **without** the open PRs #45, #46, #54, #61, #62, #67, #68, #69 and the UI/UX branch #63). Backend PRs #52 (platform user list) and #53 (letterhead + school billing history) are open and not merged; #50 (teaching-assignment ownership integration) is open too.

## How this was checked, and its limits

Three levels of evidence are kept apart throughout this document. A feature is never promoted from one level to the next by assumption.

1. **Route existence.** `tools/audit-web-endpoints.py` re-run against both commits above (203 web calls, 465 backend routes). It proves a route exists, nothing more.
2. **Contract verification.** Reading DTOs, mappers/use cases, permissions and plan gates. Done for: attendance, grades, report cards, fees, payments, staff, schools, plans/billing, branches, message templates, automations, audit, webhooks. For the large finance modules (expenses/vendors/budgets/recurring, payroll, transfers, ledger, reconciliation, settlements, reports) only routes, permissions, plan gates, role templates, backend open items and documentation were checked, **not every DTO and mapper**; those are marked "ready after contract review" and get a review slice first.
3. **Runtime verification.** Nothing in this audit was exercised against a running API or browser. No row below is runtime-verified.

**Checks not executed in my sandbox** (no `node_modules`, no network): full `tsc` over `.tsx`, the real vitest run, `next build`, `npm audit`, Prisma client generation. Instead I ran `tsc --strict` on pure TypeScript files, the pure unit tests via esbuild and the Node test runner with a vitest shim, and parse checks. These are partial stand-ins, not equivalents.

**Checks executed by GitHub CI that currently fail** (CI runs; per the owner): the Prisma generated-client check, the frontend typecheck and `npm audit`. I have not reproduced or diagnosed these failures, so no PR listed here should be read as CI-green, and the frontend typecheck failure in particular may affect the open web PRs until it is understood.

- Classes: **1** ready to implement, **2** partly implemented, needs completion, **3** implemented, needs review/verification, **4** blocked by a named backend dependency, **5** not required now / lower priority.

## A. Existing features

| # | Feature | Class | Backend (routes, permissions) | Web state, mismatches | Next action |
|---|---|---|---|---|---|
| A1 | **Grades** | **1** (rebuild) | `/grades/scales,schemes` (`grades.view/config`), `/grades/sheets…` (`enter/submit/approve/publish/reopen`), `GET /grades`. #55: BRANCH scope for staff view, students/guardians read-only on scales/own published grades | Every call in `features/grades` targets removed routes (`/grades/bulk`, `/publish`, `/config`, `/me`, `/my-children`). Teacher, school, insights, student, guardian pages all affected | Implement per #61: contracts + services + hooks (slice 1), teacher sheet, approver/publisher, student/guardian/principal views, setup tab. Only B3 (draft grade timing) and B5 (schemes envelope) are open and do not block slices 1 to 4 |
| A2 | **Report cards** | **1** | `GET /report-cards` (+`/templates /template-preview /overview /class-pdf /class-pdf/status/:jobId /:id /:id/preview /:id/pdf`), `POST /generate /publish /unpublish`, `PUT /:id/remarks`. `report_cards.view/generate/publish/pdf/principal_remark`; sensitive `publish_incomplete` for `allowMissing` (#55). Scope: ALL, BRANCH (staff), ASSIGNED (class teacher), OWN (published/sent only) | All nine web calls miss: `POST /report-cards`, `/bulk`, `/bulk-status/:jobId`, `PUT /:id`, `/:id/send`, `/me`, `/my-children`. Needs: generate by class, remarks per card (teacher/principal), publish/unpublish with reason, class PDF with 202 job polling, per-card PDF/preview, families via `GET /report-cards` (OWN) | Implement after grades slice 1 (cards read only published/locked sheets, so testing needs it). `custom_letterhead` template depends on #53 (class 4 for that one option only) |
| A3 | **Fees: family read side** | **3** (awaiting review, not merged) | `/fees/my/*`, `/payments/my*` | Implemented in #67 (foundation) and #68 (family), both open and unreviewed; not merged or accepted. Merge order #67 → #68 → #69 | Owner review; retarget #68 after #67 |
| A3b | **Fees: online payment** | **3** (awaiting review, not merged) | `/payments/online/initialize`, `/verify/:reference` (guardian) | Implemented in #69, open, stacked on #68 (#67 → #68 → #69); not merged or accepted | Owner review |
| A3c | **Fees: family invoice line items** | **4** | None. `GET /fees/invoices/:id` is staff-only (`fees.invoices.view`); the family list row has no items; statement has descriptions only | Not built, deliberately not exposing the staff endpoint | Backend question F9: add an items route for family (or confirm the row is the intended view) |
| A3d | **Fees: staff invoicing, adjustments, payments, reports** | **1** (after review slice) | `/fees/types,structures,discounts,invoices(generate,issue,void,instalments,opening-balances,late-fees),adjustments`, `/payments` (record, confirm, reject, reverse, allocation-preview, credit, refunds), `/fees/reports/*`, `/fees/statements`. F8 resolved: money accounts from `GET /finance/accounts` (`finance.accounts.view`, bursar has it), filter `isMoneyAccount`; `accountId` is optional on record-payment (default cash/bank) | Staff screens (`school/fees`, `finance/fees`, `finance/payments`, `school/payments`, finance dashboard) are all on the removed model (`/fees/invoices/bulk|class|copy-from-class`, `invoice-items`, `record-payment`, `waive`, defaulter ping) | Slices per #62: types/structures, generate drafts + issue/void + adjustments, record payment with allocation preview + confirm/reverse + credit + refunds, reports. F4 (defaulter ping) has no route; do not build |
| A4 | **Students** | **2** | `GET/POST /students`, `/:id`, `PUT /:id`, `POST /:id/deactivate|reactivate|undo-graduation|transfer|photo`, `GET /import/template`, `POST /import/preview`, `POST /import`, `GET /students/me` | Web has list/create/get/update/photo/`/me`/`/import`. Misses: `DELETE /students/:id` (no route: it is deactivate), `POST /students/batch` and `/bulk-create` (no routes: it is import preview then import), no UI for deactivate/reactivate/transfer/undo-graduation, no import template/preview step | Path corrections plus lifecycle actions and the two-step import. Verify DTOs (import row shape, transfer body) at slice start |
| A4b | **Guardians** | **2** | `GET/POST /guardians`, `/:id`, `PUT /:id`, `POST /:id/invite|link`, `POST /invite/bulk`, `PUT/DELETE /:id/students/:studentId`, `GET /me/children` | Web matches list/create/get/update/invite/link/bulk invite. No unlink, no per-link update (relationship/primary) | Add link management; verify link DTO |
| A4c | **Family portal access** | **3** | `GET /guardians/me/children`, OWN-scoped attendance/grades/report cards/fees/payments | Children page done in #46/#68; grades and report cards pending A1/A2 | Covered by A1, A2 |
| A5 | **Enrolment** | **3** | `GET/POST /enrolments`, `POST /bulk`, `PUT /:id`, `GET /promotion-preview`, `POST /promote` | Promotion merged (#30) and paths match. Core enrolment list/create/bulk/update paths match; **request/response shapes not yet verified** by me | Short verification pass (DTOs vs `enrolment.types.ts`); no new screen needed |
| A6 | **Attendance** | **3** (awaiting review, not merged) | `/attendance` register/submit/update/list/summaries (#48 merged: dashboard counts scoped, existence leak closed) | #46 (open): register workflow, summaries, student/guardian views, subject-teacher class picker. Route audit on the `refactor/web` tip still lists 4 attendance misses; they are fixed by #46 | Owner review of #46. No gaps found that need new work; do not duplicate |
| A7 | **School administration** | **2** | `/schools` (get/put/logo/documents/payment-setup/banks/payment-setup/verify/setup-checklist/dashboard), `/school-settings` (get/put/preferences/stamp/signature) | Settings, documents, checklist, dashboard, logo match. Payout bank routes corrected in #54 (open, awaiting review, **3**; not merged). `POST /school/settings/letterhead` has no route (`/school-settings/letterhead` is #53, open): **4**. `GET/PUT /school-settings/preferences` not used by web | Review #54; verify dashboard and checklist response shapes against the mappers; add preferences screen (**1**); letterhead waits for #53 |
| A8 | **Platform administration** | mixed | `/platform/schools…` (create requires `admin`; verify/reject/suspend bodies `{reason}`; impersonate = one-time ticket), `/platform/plans`, `/platform/subscriptions`, `/platform/audit`, `/platform/settings`, `/platform/webhooks`, `/feedback`, `/notifications/platform*` | Plans and billing done (M6c). Still on removed routes: `/super-admin/schools/:id/activity`, `/impersonate`, `/reset-admin-password`, `/super-admin/stats`, `/stats/mrr-trend`, `/super-admin/users` list/delete; feedback `GET feedback` and `PUT /feedback/:id` (backend: `PATCH /:id/status|respond`); notifications `PATCH /notifications/:id/read` (backend: `PATCH /notifications/me/:recipientId/read`) | See A8 rows below |

### A8 detail

| Item | Class | Notes and next action |
|---|---|---|
| School list/detail/create/verify/suspend/documents | 2 | Several screens call `/super-admin/*`. Re-point to `/platform/schools` (`platform.schools.view/create/manage/verify/suspend/documents`). Create needs the `admin` object (firstName, lastName, email, optional phone); reason-only bodies for reject/suspend |
| Impersonation | 1 | Backend: `POST /platform/schools/:id/impersonate` (`platform.schools.impersonate`), one-time ticket. Web has the `impersonate-entry` page but posts to the old route. Read the ticket exchange in the auth module first |
| Activity feed, stats, MRR trend | 1 | Activity: `GET /platform/audit?schoolId=` (`platform.audit.view`). Overview: `GET /platform/schools/overview` (`platform.overview.view`); MRR/ARR already come from `/platform/subscriptions/stats` (done). Verify shapes |
| Reset school admin password | 1 | Backend route is under `/users/schools/:id/admin/reset-password` (per backend answer #2); confirm DTO/permission before building |
| Feedback console and notifications read | 1 | Pure path/verb corrections (`PATCH /feedback/:id/respond|status`; `PATCH /notifications/me/:recipientId/read`, `/me/read-all`). Small, user-visible bug fix; recommended early |
| Platform user management | **4** | Needs backend PR #52 (`GET /users`, `platform.users.view`), open and unmerged. Keep the screen pending; do not build on the proposal |
| Platform settings, logo | 3 | `/platform/settings` (GET/PUT, logo POST/DELETE) exists; web has `platform-settings.api.ts`. Verify only |
| Letterhead, school billing history | **4** | Need #53 |

## B. Backend modules with little or no frontend coverage

The web has **no** call to any of these (searched the whole web source). All are plan-gated (`modules.expenses`, `finance.budgets`, `modules.payroll`, `modules.fees`, `finance.bank_reconciliation`): since #49 merged the web can read `entitlements` from `/users/me/permissions` to hide what a plan does not include (the web copy of the contracts package must be synced first).

| Module | Mount, permissions | Class | What the code shows | Recommendation |
|---|---|---|---|---|
| **Branches** | `/branches` (list, `/mine`, get, `/:id/members`, create, update, deactivate/reactivate, delete); `branches.view`, manage for write | **1** (small) | DTO clear (`name` 2-100, optional address/city/state/phone, branch `code` 2-6 A-Z0-9). Branch pickers already use `schoolHasSeveral` | Settings > Branches screen. Smallest module; also makes the staff branch pickers meaningful |
| **Message templates** | `/message-templates` (list, `/:key`, `PUT/DELETE /:key/:channel`, `POST …/preview`); `message_templates.view/manage` | **1** (small) | `SaveTemplateDto {subject?, body 1-6000, isActive?}`; preview takes subject/body. Open item: rendered subject length is not re-checked after substitution | Editor with live preview; per channel reset |
| **Automations** | `/automations` (list, get, `PATCH /:id`, `POST /:id/dry-run`, `/:id/run`, `GET /:id/runs`); `automation.view/manage` | **1** (small) | `UpdateAutomationDto {enabled, channels IN_APP/EMAIL/SMS, params, schedule{daily/weekly/interval}}`. Schedules are fixed to Africa/Lagos (backend item 3); plan limits on enabled rules race (item 5) | Rule list, toggle, dry-run, run history. Show the Lagos-time note |
| **School audit** | `GET /audit` (`audit.view`); platform: `GET /platform/audit` (`platform.audit.view`) | **1** (small) | Filters `userId, action (exact or prefix "x."), module, entity, entityId, from/to, page, limit<=100`. End-date handling already fixed (`auditRangeEndExclusive`). Open: no central PII redaction (backend item 3) | Read-only table with filters; build once, reuse for the platform and the school activity feed |
| **Platform webhooks** | `/platform/webhooks` (list, `/summary?hours`, `/:id`, `POST /:id/retry`); `platform.webhooks.view/retry` | **1** (small) | Query `provider, status, reference, type, page, limit`. Failed events are retried only manually (backend item 2) | Super-admin console: summary tiles, event list, detail, retry |
| **Expenses, vendors, budgets, recurring** | `/expenses`, `/vendors`, `/budgets`, `/recurring-expenses`; `expenses.view/create/approve/pay/void`, `vendors.manage`, `budgets.view/manage`; bursar holds most | **1 after a contract review slice** | Large (about 38 routes). Backend risks the UI must not hide: run-now can auto-approve with only `expenses.create` (item 1), budget block mode race (item 2), budget lines replaced non-atomically (3), recurring has no tests (6) | Review doc first (DTOs, response shapes, approval workflow). Then vendors, expenses with submit/approve/pay, budgets vs actual, recurring |
| **Payroll** | `/payroll` (components, profiles, runs, payslips, loans, remittances), `/my/payslips`; `payroll.runs.*`, `payroll.payslips.view`; `modules.payroll` | **1 after review** (medium priority) | About 34 routes. Backend: second-approval threshold double-counts employer cost (item 2), profile replacement non-atomic (3), remittance race (5) | Review doc first. `/my/payslips` (every staff member) is a small, separate and valuable first slice |
| **Payroll transfers** | `/payroll/transfers` (7 routes) | **4 / 5** | Backend items: start response converts BigInt total with `Number()` (4), a reversed transfer leaves the run PAID (6), provider-sandbox tests missing (7) | Do not build until payroll is done and items 4 and 6 are settled |
| **Finance: ledger and settings** | `/finance/accounts, journals, periods, integrity…`; `/finance/settings` | **1 after review** | `GET /finance/accounts` needed for money-account pickers (F8). Grace-days setting is ignored by late fees (REM-020) | Read-only accounts + settings first; journals/periods later |
| **Finance reports** | `/finance/reports…`, dashboard; `finance.reports.view/export/accountant` | **1 after review** | No backend tests (item 2); accountant reports gated by feature `finance.reports.accountant` | Part of the staff-finance stage (A3d) |
| **Reconciliation** | `/finance/reconciliation` (16 routes); `finance.bank_reconciliation.*` | **5** | CSV statement import and matching; several correctness caveats (typed balance override, greedy matching) | After core finance |
| **Gateway settlements** | `/finance/settlements` (7 routes) | **5** | Replaced the old payments settlement route (now 410) | After core finance |

## C. Recommended implementation order

The owner's order is kept. Two adjustments, with reasons:

1. **A small path-fix batch is pulled forward** (feedback respond/status, notifications read path, `/super-admin` -> `/platform` for the screens whose routes exist, student `DELETE`/`batch`/`bulk-create` -> real routes). These are live bugs (the calls 404 today), each is a few lines, and they need no new design. One PR per area, not one big PR.
2. **Small backend-ready modules (audit, webhooks, templates, automations, branches) are used as fillers** while a large PR (grades, finance) waits for review. They are independent, have clear DTOs and permissions, and avoid idle time. They stay after steps 1 to 5 in priority.

| Step | Work | Reason / dependency |
|---|---|---|
| 1 | Owner review of #67, #68, #69 (stack), #46, #54, #45, #61, #62 | Nothing here is merged by me |
| 2 | **Grades implementation** (#61 slices 1 to 4, then setup tab) | Biggest stale feature; permissions settled by #55 |
| 3 | **Report cards** (A2) | Reads published sheets from step 2 |
| 4 | Path-fix batch (adjustment 1) | Cheap, fixes live 404s; can run during any review wait |
| 5 | Fees: staff finance (A3d): types/structures, invoices, adjustments, payments, reports | After the #62 review is accepted; F9 and F4 stay open |
| 6 | Students/guardians completion (A4), enrolment verification (A5), school admin (A7: preferences, shape checks) | Mostly small |
| 7 | Platform admin (A8) except user management | Impersonation, school management, activity feed |
| 8 | Backend-ready modules, small first: audit, webhooks console, message templates, automations, branches; then expenses, payroll (with `/my/payslips` first), ledger/settings/reports | Contract review slice before each large one |
| 9 | Platform user management | **Only after #52 is merged and reviewed** |
| later | Reconciliation, settlements, payroll transfers, letterhead (#53), billing history (#53) | Low priority or blocked |

## D. Backend dependencies (current)

| Dependency | Blocks | Status |
|---|---|---|
| #52 platform user list | Platform user management | Open, not merged |
| #53 letterhead upload + school billing history | `custom_letterhead` report template, school billing-history tab | Open, not merged |
| F9 family invoice line items | Family invoice detail | Question to backend, no PR |
| F4 defaulter reminder route | Defaulters "ping" action | Question to backend, no PR |
| Verify-return error mapping (provider failure during `GET /payments/online/verify` probably surfaces as 500, not 502) | Nothing (web treats it as retryable) | Observation in #69 |
| Grades B3 (draft grade timing), B5 (schemes envelope) | Grading setup tab, provisional grade display | In #61 |
| Web copy of `packages/contracts` lacks `entitlements` | Plan-aware menus | Web-side sync, no backend work |

## E. Status of the PRs this audit refers to

All open and unmerged at the time of writing: #45, #46, #54, #61, #62, #67 (base `refactor/web`), #68 (base #67 branch), #69 (base #68 branch), and backend #52 and #53. Stack order #67 → #68 → #69; #68 and #69 are retargeted to `refactor/web` only after their base merges, and I merge none of them.
