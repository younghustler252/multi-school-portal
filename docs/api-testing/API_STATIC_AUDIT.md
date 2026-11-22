# CORE API static audit — refreshed

- Source: latest `refactor/modules` (head `b71c52f9cada620d9b243061fb4ac8767f49169c`).
- Test branch: `api-test-suite-refresh`.
- API prefix: `/api/v1`.
- Runtime tests: **not run**.

## Scope reviewed
Current route registry and module route files for auth, users, school, plans, subscriptions, branches, staff, roles/permissions, students, guardians, classes, enrolment, attendance, grades, report cards, fees, finance, expenses, payroll, payments, sessions, notifications, settings, automation, messaging, platform administration, webhooks and feedback.

## Collection counts
- Full collection: 473 requests.
- Read-only smoke collection: 189 GET requests.
- 33 current method/path entries were missing from the old collection's normalized inventory and have been added.

## Added current routes
- `GET /api/v1/users/me/permissions`
- `POST /api/v1/students/:id/undo-graduation`
- `POST /api/v1/students/:id/transfer`
- `PUT /api/v1/classes/subjects/:id/default-teacher`
- `POST /api/v1/classes/:id/subjects/bulk-assign`
- `PATCH /api/v1/classes/:id/subjects/:classSubjectId/clear-override`
- `GET /api/v1/attendance/classes/:classId/summary`
- `POST /api/v1/grades/sheets/:classSubjectId/lock`
- `GET /api/v1/report-cards/class-pdf/status/:jobId`
- `PUT /api/v1/fees/invoices/:id/instalments`
- `GET /api/v1/fees/invoices/:id/instalments`
- `DELETE /api/v1/fees/invoices/:id/instalments`
- `GET /api/v1/payments/online/verify/:reference`
- `POST /api/v1/expenses/:id/payments/:paymentId/reverse`
- `GET /api/v1/finance/periods/:id/close-checklist`
- `POST /api/v1/finance/periods/:id/reopen`
- `GET /api/v1/payroll/transfers/runs/:runId`
- `POST /api/v1/payroll/transfers/runs/:runId/start`
- `POST /api/v1/payroll/transfers/runs/:runId/send`
- `PATCH /api/v1/notifications/me/:recipientId/read`
- `PATCH /api/v1/notifications/platform-inbox/:recipientId/read`
- `GET /api/v1/automations/:id/runs`
- `GET /api/v1/platform/schools/overview`
- `GET /api/v1/platform/schools/provisioning`
- `POST /api/v1/platform/schools/:id/provisioning/retry`
- `PUT /api/v1/platform/schools/documents/:documentId/approve`
- `PUT /api/v1/platform/schools/documents/:documentId/reject`
- `GET /api/v1/platform/subscriptions/stats`
- `GET /api/v1/platform/subscriptions/invoices`
- `PUT /api/v1/platform/subscriptions/invoices/:id/void`
- `PUT /api/v1/platform/subscriptions/invoices/:id/mark-paid`
- `GET /api/v1/platform/webhooks/summary`
- `POST /api/v1/webhooks/:provider`

## Runtime and safety observations
- `GET /api/v1/health` checks both PostgreSQL and Redis.
- Tenant selection is host-based; development may use validated `x-school-id` and `x-tenant-schema`.
- Platform endpoints require platform permissions and a separate platform token.
- Provider webhooks are mounted before the JSON parser and use raw request bytes for signature validation.
- Upload endpoints require multipart form-data with exact field names.
- Financial, payroll, fee, attendance, academic and platform mutations must be run only against a disposable test school.

## Known limitations
1. No HTTP requests were executed in this refresh.
2. Existing DTO examples were not all revalidated against every current DTO file.
3. Added write requests use empty JSON placeholders and must be completed with current DTO payloads.
4. Happy paths need valid users, roles, permissions, plan features, tenant data and dependent records.
5. Webhook signatures, payment provider callbacks, multipart uploads and asynchronous jobs require dedicated fixtures.
