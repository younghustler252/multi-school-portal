# Fees and payments contract review (web ↔ backend)

Status: review only, no implementation. Sources: `docs/backend/modules/fees.md`, `payments.md`, and the DTOs/mappers on `refactor/api` (read 2026-11-21); web code on `refactor/web`. Route matching and shape verification are kept apart. Nothing was run against a live API. Backend PR #51 (payments applied to one invoice, open, not merged into `refactor/api`) is noted where relevant; payments.md already lists `by-invoice` routes, so confirm whether they are on `refactor/api` before building on them.

## 1. Verdict

The web fees/payments feature was written for the **old, simple model** (unpaid/partial/paid, one payment row per invoice, defaulter "ping", per-class bulk invoice). The backend is now a **ledger-backed receivables workflow** (draft → issued invoices, structures and discounts, approved adjustments, pending/confirmed payments with allocations and credit, refunds). Most web calls miss, and the model differences are larger than path changes: a rebuild, in slices.

## 2. Web calls vs backend (route match)

Fee calls (`features/fees/services/fee.api.ts`):

| Web call | Result |
|---|---|
| `GET /fees/types`, `POST /fees/types` | route exists; DTO differs (needs `incomeAccountId`, optional `code`, `isRefundable`, `sortOrder`; web sends name/description only) |
| `GET /fees/invoices`, `GET /fees/invoices/:id`, `POST /fees/invoices` | routes exist; query, DTO and response differ (section 4) |
| `PUT /fees/invoices/:id` | exists, **draft only**; body is `{version?, dueDate, note, items[]}`; the web sends `discountKobo` (rejected, strict) |
| `GET /fees/my/invoices` | exists (`fees.view`) |
| `GET /fees/invoices/my-children` | **missing**; backend has `GET /fees/my/children` (balance/credit summary) |
| `POST /fees/invoices/bulk`, `/class`, `/copy-from-class` | **missing**. Replaced by `POST /fees/invoices/generate` (structure-driven drafts) |
| `PUT/DELETE /fees/invoice-items/:id` | **missing**. Items are replaced as a whole list on a draft edit |
| `POST /fees/invoices/:id/record-payment` | **missing**. Payments are recorded at `POST /payments` |
| `PATCH /fees/invoices/:id/waive` | **missing**. A waiver is an adjustment request that needs approval (`POST /fees/adjustments`) |
| `GET /fees/invoices/:id/payments` | **missing** in `fees`; the history route is `GET /payments/by-invoice/:invoiceId` (staff) and `/payments/my/by-invoice/:invoiceId` (guardian) |
| `GET /fees/defaulters`, `POST /fees/defaulters/ping` | defaulters moved to `GET /fees/reports/defaulters` (`fees.reports.view`); **ping has no backend route** |

Payment calls (`features/payments/services/payment.api.ts`):

| Web call | Result |
|---|---|
| `GET /payments` | exists; filters differ (`from/to` not `startDate/endDate`, `studentId`, `status` uppercase enum) |
| `POST /payments/initialize` | **missing**; it is `POST /payments/online/initialize` |
| `GET /payments/verify/:reference` | **missing**; it is `GET /payments/online/verify/:reference` |
| `GET /payments/my-payments` | **missing**; it is `GET /payments/my` |
| `GET /payments/banks`, `POST /payments/verify-bank-account` | not payments routes; moved to `/schools/banks` and `/schools/payment-setup/verify` (web PR #54, open) |

Everything under `/fees` and `/payments` also needs the plan feature `modules.fees` (route-level), so a school without it gets a feature error, not an empty list.

## 3. Money: a cross-cutting rule

- Requests: whole kobo as a safe integer **or a digit-string up to 18 digits**.
- Responses (`koboOut`): a number when safe, otherwise a **digit string**. The web types all say `number`; every money field must go through one parse helper (`koboToNumber`/formatting from string), never `+x` scattered around.
- Dates are `YYYY-MM-DD` strings (`dayOut`); "today" for payments is the **finance timezone**, not the browser's. Use the same Lagos-day helper as attendance until a finance timezone is exposed (question F6).

## 4. Fees: shapes and workflow

Permissions: `fees.setup.view`, `fees.types.manage`, `fees.structures.manage`, `fees.discounts.manage`, `fees.invoices.view/create/issue/void`, `fees.adjustments.request/approve`, `fees.reports.view`, `fees.view` (family). All scope ALL for staff; family reads derive the student ids from the session.

- **Invoice summary (list):** `{id, invoiceNumber|null, type (TERM_FEES|ADMISSION|ADHOC|OPENING_BALANCE), status, student{id,name,admissionNumber}, sessionId, termId, classId, branchId, issueDate, dueDate, subtotalKobo, discountKobo, adjustmentsKobo, totalKobo, paidKobo, balanceKobo, createdAt}`. No `className`/`termName`/items in a list row: names for class and term come from the sessions/classes modules.
- **Invoice detail** adds `sourceStructureId, journalId, note, version, voidedAt, voidReason, items[{id,feeTypeId,description,amountKobo,sortOrder}], discounts[{id,ruleId,feeTypeId,label,amountKobo}]`. The web has `feeTypeName`, `className`, `termName`, `studentName`: all gone/renamed.
- **Status set:** `draft, unpaid, partial, paid, waived, void`. The web has no `draft` and no `void`. **Drafts are invisible to families and not journalled.**
- **Lifecycle:** structures (`/fees/structures`: term, optional class/branch, student type ALL/NEW/RETURNING, 1–40 items, scope immutable) → `POST /fees/invoices/generate` makes drafts (skips existing and students with no matching structure) → edit draft (version check) → `POST .../issue` or batch `POST /fees/invoices/issue` (independent outcomes: issued vs failed) → `POST .../void` `{reason}` only before payments/approved adjustments. Issue assigns `INV-YYYY-000001`, posts the journal and **auto-applies available student credit**.
- **Adjustments:** `POST /fees/adjustments {invoiceId, type: WAIVER|WRITE_OFF|CREDIT_NOTE|ADDITIONAL_DISCOUNT, invoiceItemId (credit note only), amountKobo, reason}`; approve/reject by another user (self-approval and a second-approver threshold are finance settings). The web's one-click waive must become *request waiver → pending → approval*.
- **Instalments, opening balances, late fees** (`/:id/instalments`, `/opening-balances`, `/late-fees/run` with dry-run) have no web UI at all.
- **Reports:** ageing, defaulters, collections (`from`+`to` required), staff statement, family statement. The defaulter "ping" the web exposes has no route.
- **Family:** `/fees/my/children` (balance, credit, overdue count), `/fees/my/invoices`, `/fees/my/statement/:studentId`.

## 5. Payments: shapes and workflow

- **Record (staff):** `POST /payments {payerType GUARDIAN|STUDENT|OTHER, guardianId (guardian), studentIds (non-guardian), method cash|bank_transfer|cheque|pos|other, amountKobo, accountId?, paidOn?, reference?, note?, proofAttachmentId?, allocations? (cash/POS only), creditStudentId?, clientRequestId?}` (strict). Not invoice-first: a payment is for a payer and is allocated oldest-first across the child's invoices, any remainder becomes student credit. The web's `RecordPaymentDto {invoiceId, amountKobo, method: cash|bank_transfer}` does not fit.
- **Statuses:** `PENDING, AWAITING_CONFIRMATION, CONFIRMED, FAILED, REVERSED`. Cash/POS confirm at once; bank transfer, cheque, other need a **second person** (`POST /payments/:id/confirm|reject`); `POST /:id/reverse` (sensitive). The web has `pending|success|failed|refunded` and treats a recorded payment as final.
- **Preview:** `POST /payments/allocation-preview` (no writes) is what a record dialog should call before submit.
- **Payment row:** `{id,status,method,payerType,guardianId,payerName,amountKobo,unallocatedKobo,reference,branchId,paidOn,receiptNumber,createdAt}`; detail adds `allocations[{invoiceId,invoiceNumber,studentId,studentName,amountKobo,isCredit,reversed}]`, confirm/record metadata, `version`. There is **no `feeInvoiceId`**, `channel`, `webhookVerified` or `receiptUrl`.
- **Receipts:** frozen snapshot at `GET /payments/:id/receipt` (staff) and `/payments/my/:id/receipt` (guardian, reduced). No receipt URL; render from the snapshot.
- **Online (guardian, `payments.pay`):** `POST /payments/online/initialize {invoiceId, callbackUrl?, amountKobo?}` returns `{paymentId, reference, authorizationUrl, amountKobo}` (no `accessCode`); `GET /payments/online/verify/:reference`. The backend verifies with the gateway itself; the browser result is never trusted. Overpayment becomes credit. Amounts above the safe-integer range are refused.
- **Guardian lists:** `/payments/my` and `/payments/my/by-invoice/:invoiceId`; a guardian may see a payment made by someone else for their child as a **partial share** (`isPayer:false`, `partial:true`, reference/method hidden). The UI must not assume `reference` is present.
- **Credit and refunds:** `GET /payments/credit/:studentId`, `POST /payments/credit/apply`, `/payments/refunds` (request, approve (maybe two approvers), reject, pay). Not in the web.
- **Retired:** `POST /payments/online/settlements` returns 410; settlements live in the finance module (out of this review).

## 6. Permission map (who sees what)

| Persona | Fees | Payments |
|---|---|---|
| Bursar/finance staff | setup, invoices (create/issue/void), adjustments request/approve, reports | view, record, confirm, reverse, refunds |
| Guardian | `fees.view` OWN: `/fees/my/*` | `payments.pay`: initialize/verify, `/payments/my*`, own receipts |
| Student | `fees.view` OWN: `/fees/my/*` | no receipt access, no online pay |
| Principal | reports (`fees.reports.view`) if granted | view if granted |

Use `useAccess().can(key)`; hide, do not disable, what a role can never do (the sensitive keys are not offered to most roles).

## 7. Workflow issues in the current web

1. Invoices are created per student or per class from items typed in the dialog; the backend wants **structures first**, then generated drafts. The "invoice class" dialog and "copy from class" have no counterpart.
2. No draft/issue step: web invoices are live the moment they are created. Staff need a drafts view and issue (single and batch with a result report).
3. Waive is one click, but is an approval workflow now.
4. Recording a payment is invoice-first and instant; the backend is payer-first, with allocation preview, pending confirmation and a second confirmer.
5. Status/amount typing: no `draft`/`void`; amounts typed `number`.
6. `useStudentFees`/student card and guardian "my-children" read removed routes; family fee pages need `/fees/my/children` + `/fees/my/invoices`.
7. Defaulters page: moved route; the "ping" action has no endpoint (do not build until one exists).
8. The finance dashboard needs the report endpoints (ageing/collections) in place of whatever it derives now.
9. `billing-sections.tsx`/`use-billing.ts` are the school's *platform subscription* billing (different module, already aligned in M6c), not school fees; keep them out of this work.

## 8. Contract gaps / questions for the backend

- **F1.** Family statement and `/fees/my/children` money fields: the repository returns raw `bigint` in places (`adjustments[].amountKobo`, `openBalanceKobo`, `creditKobo`). Confirm they pass through `koboOut` in the controller/mapper, i.e. number-or-string, before the web types them.
- **F2.** Invoice list rows carry ids only (`classId`, `termId`, no names). Fine if the web joins; confirm no `className` is planned.
- **F3.** Is `GET /payments/by-invoice/:invoiceId` on `refactor/api` today, or only in the open PR #51?
- **F4.** Defaulter "ping" (reminder to guardians): is a route planned, or is that moved into the automation/notifications modules?
- **F5.** Fee structures response shape (item list, `studentType`, status) to be read from the structure mapper during slice 2; no gap found yet.
- **F6.** The finance timezone is not exposed to the client. Confirm the paid-on "today" rule can follow Africa/Lagos until it is.
- **F7.** Documented backend defects the UI will surface to staff, not to fix here: statement double-counts approved additional discounts, opening-balance response loses precision above 2^53, late-fee grace days ignore the finance setting (fees.md open items 1–3).
- **F8.** Money accounts: `accountId` on record-payment needs a list of money accounts (a ledger/finance route). Confirm which endpoint and permission a bursar uses to populate it.

## 9. Proposed slices (after this review)

1. **Foundations:** shared `kobo` parsing/format helpers, new types for invoices/payments/adjustments, error codes; tests. No screens.
2. **Family read side** (smallest risk, route-confirmed): `/fees/my/children`, `/fees/my/invoices`, `/fees/my/statement`, `/payments/my`, receipts; student and guardian screens.
3. **Online payment:** `online/initialize` + `online/verify` on the guardian invoice view.
4. **Staff invoicing:** types and structures, generate drafts, edit/issue/void, adjustments requests and approvals.
5. **Staff payments:** record with allocation preview, confirm/reject/reverse, credit, refunds; needs F8.
6. **Reports:** ageing, defaulters, collections, statements; finance dashboard.

Slices 1–3 need no backend answers beyond F1; 4–6 can start on the confirmed contract and pick up F3, F5, F8 as they arrive.
