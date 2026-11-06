# Mounted API Route Inventory

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. This is a route-composition inventory derived from `apps/api/src/routes/index.ts`, `apps/api/src/app.ts` and the 46 module route source files. It is not the OpenAPI contract and does not enumerate every operation's request/response schema.

## API entry points outside the module router index

| Mount | Source | Purpose | Exposure |
|---|---|---|---|
| `/api/v1/health` | `apps/api/src/app.ts` | API, PostgreSQL and Redis health check | Public |
| `/api/v1/webhooks` | `modules/webhooks/routes/webhook.routes.ts` | Provider event ingress, raw-body signature verification | Provider signature |
| `/api/v1/report-cards/template-previews` | `apps/api/src/app.ts` | Static report-card template preview assets | Public static files |
| `/admin/queues` | `apps/api/src/app.ts` | Bull Board queue administration | Platform permission `platform.queues.view` |

## Versioned module router mounts

Every path below is prefixed by `/api/v1`. The path column is the router mount; operation paths are relative to the listed mount and remain defined in the source route file.

| Router mount | Module route source | Notes |
|---|---|---|
| `/auth` | `modules/auth/routes/auth.routes.ts` | Authentication, sessions, invitations and persona switching |
| `/users` | `modules/user/routes/user.routes.ts` | Global user profile, access and sessions |
| `/schools` | `modules/school/routes/school.routes.ts` | School profile, documents, payment setup and dashboard |
| `/platform/schools` | `modules/school/routes/school.platform.routes.ts` | Platform school verification, provisioning and administration |
| `/plans` | `modules/plans/routes/plan.routes.ts` | Public plan catalogue |
| `/platform/plans` | `modules/plans/routes/plan.platform.routes.ts` | Platform plan and entitlement management |
| `/subscriptions` | `modules/subscriptions/routes/billing.routes.ts` | School subscription and billing |
| `/platform/subscriptions` | `modules/subscriptions/routes/billing.platform.routes.ts` | Platform subscription and invoice administration |
| `/audit` | `modules/audit/routes/audit.routes.ts` | School audit log |
| `/platform/audit` | `modules/audit/routes/audit.platform.routes.ts` | Platform audit log |
| `/staff` | `modules/staff/routes/staff.routes.ts` | Staff directory, assignments and lifecycle |
| `/roles` | `modules/roles/routes/roles.routes.ts` | School role administration |
| `/permissions` | `modules/roles/routes/roles.routes.ts` | Permission catalogue router exported by the roles route module |
| `/branches` | `modules/branches/routes/branch.routes.ts` | Branch administration |
| `/finance/settings` | `modules/finance-settings/routes/finance-settings.routes.ts` | School finance policy settings |
| `/finance/reconciliation` | `modules/bank-reconciliation/routes/bank-reconciliation.routes.ts` | Bank statement reconciliation |
| `/finance/settlements` | `modules/gateway-settlements/routes/settlement.routes.ts` | Gateway settlement reports and reconciliation |
| `/finance` | `modules/ledger/routes/ledger.routes.ts` | Chart of accounts, journals, periods and ledger reports |
| `/finance` | `modules/finance-reports/routes/report.routes.ts` | Finance report catalogue, dashboard and exports |
| `/students` | `modules/students/routes/student.routes.ts` | Student records, import, transfer and lifecycle |
| `/guardians` | `modules/guardians/routes/guardian.routes.ts` | Guardian records, invitations and student links |
| `/classes` | `modules/classes/routes/class.routes.ts` | Classes, subjects and teaching assignments |
| `/enrolments` | `modules/enrolment/routes/enrolment.routes.ts` | Enrolment and promotion |
| `/attendance` | `modules/attendance/routes/attendance.routes.ts` | Registers, marks and summaries |
| `/grades` | `modules/grades/routes/grades-setup.routes.ts` | Grading scales and assessment schemes |
| `/grades` | `modules/grades/routes/grades-sheets.routes.ts` | Mark sheets, score entry and publication |
| `/sessions` | `modules/sessions/routes/session.routes.ts` | Sessions, terms and calendar |
| `/report-cards` | `modules/report-cards/routes/report-card.routes.ts` | Report cards, PDFs and publication |
| `/fees` | `modules/fees/routes/fee-setup.routes.ts` | Fee types, structures and discounts |
| `/fees/invoices` | `modules/fees/routes/fee-invoice.routes.ts` | Fee invoices, instalments and opening balances |
| `/fees/adjustments` | `modules/fees/routes/fee-adjustment.routes.ts` | Fee adjustment requests and approvals |
| `/fees` | `modules/fees/routes/fee-report.routes.ts` | Fee statements and reports |
| `/expenses` | `modules/expenses/routes/expense.routes.ts` | Expenses, approvals and outgoing payments |
| `/vendors` | `modules/expenses/routes/vendor.routes.ts` | Vendor directory |
| `/budgets` | `modules/expenses/routes/budget.routes.ts` | Budgets and budget lines |
| `/recurring-expenses` | `modules/expenses/routes/recurring.routes.ts` | Recurring expense schedules and runs |
| `/payroll` | `modules/payroll/routes/payroll.routes.ts` | Payroll setup, runs, payslips, loans and remittances |
| `/my/payslips` | `modules/payroll/routes/my-payslips.routes.ts` | Current user's payslips |
| `/payroll/transfers` | `modules/payroll-transfers/routes/transfer.routes.ts` | Salary transfer execution and reconciliation |
| `/payments` | `modules/payments/routes/payment.routes.ts` | Fee payments, allocations, refunds and online payments |
| `/notifications` | `modules/notifications/routes/notification.routes.ts` | School and platform notification inboxes/delivery |
| `/school-settings` | `modules/school-settings/routes/school-settings.routes.ts` | School branding and preferences |
| `/message-templates` | `modules/message-templates/routes/message-template.routes.ts` | Message template catalogue and overrides |
| `/automations` | `modules/automation/routes/automation.routes.ts` | Automation rules, dry-run and manual run |
| `/platform/settings` | `modules/platform-settings/routes/platform-settings.route.ts` | Global platform settings |
| `/platform/webhooks` | `modules/webhooks/routes/webhook.routes.ts` | Platform webhook event review and retry |
| `/feedback` | `modules/feedback/routes/feedback.routes.ts` | User feedback and platform review |

## Composition observations relevant to OpenAPI

1. The route index mounts both the ledger router and finance reports router at `/api/v1/finance`. OpenAPI paths must be composed from mount plus relative path; do not assume one router file per prefix.
2. The roles route file exports two routers, mounted separately at `/roles` and `/permissions`.
3. The webhook route file exports provider ingress and platform console routers. Provider ingress is mounted in `app.ts` before the global JSON parser; platform console is mounted through the versioned route index.
4. The public plan and school billing routers are separate from their platform administration counterparts.
5. Static report-card template previews and the queue dashboard are not ordinary business-router operations.
6. The route inventory proves route composition only. It does not prove every path's authorization, DTO behavior, response schema, status code or runtime success.

## Required next step

Build the OpenAPI document by composing each route file with its mount, then inspect each operation's middleware, DTO, controller, response helper and use case. Use the [OpenAPI migration plan](OPENAPI_MIGRATION_PLAN.md) acceptance criteria. The module guides are implementation context, not substitutes for the HTTP-level contract.
