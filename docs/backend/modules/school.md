# School Module

> **Verification status:** Source-reviewed for school and platform routes, controllers, DTOs, permission declarations, container registration, workspace activation, document approval, payment setup, provisioning operations and lifecycle behavior. Runtime/provider/database verification has not been performed in this documentation pass.
> **Source snapshot:** `refactor/modules`, source snapshot recorded as `23a5e0a5538f747de27ddff29b24a913791eaac2` (2026-11-05).
> **Primary source:** `apps/api/src/modules/school/`
> **Route mounts:** `/api/v1/schools` and `/api/v1/platform/schools`.

## 1. Responsibility and boundaries

The School module owns the school registry and school lifecycle from both realms:

- School-hosted profile, branding, verification documents, payment settlement account, dashboard and setup checklist.
- Public school information used by the login experience.
- Platform school listing, creation, editing, verification, rejection, suspension and reactivation.
- Platform document review.
- Workspace provisioning status and retry.
- Platform-initiated school impersonation ticket creation.
- Daily school lifecycle operations.

The public school record and subscription are created during self-registration by Auth. The School module coordinates activation and provisioning after email verification. Tenant-owned school data lives in the school's PostgreSQL schema.

## 2. Architecture and dependencies

| Layer | Source location | Responsibility |
|---|---|---|
| School routes | `routes/school.routes.ts` | School-hosted and public endpoints |
| Platform routes | `routes/school.platform.routes.ts` | Platform realm operations |
| Controllers | `controllers/` | HTTP mapping and response envelopes |
| DTOs | `dtos/school.dto.ts` | Zod validation |
| Use cases | `usecases/`, `usecases/platform/` | School and platform workflows |
| Services | `services/` | Workspace activation, approval checks and admin directory |
| Repositories | `repositories/` | Public school data and tenant data access |
| Permissions | `school.permissions.ts` | School/platform permission declarations |
| Container | `school.container.ts` | Awilix registrations |

Dependencies include Auth user/membership/password/message services, Plans and Subscriptions, Audit, Notifications, shared Prisma/storage/encryption/payment/verification providers and the schema-provisioning queue.

The module is registered after Auth, Plans, Subscriptions, Audit and Notifications.

## 3. Data and lifecycle model

### Public school record

The public school registry contains routing and lifecycle information such as school ID, subdomain, schema name, status, active flag, verification status, activation time and schema-provisioned timestamp. It also stores selected public-facing school details and payment settlement account metadata.

The tenant schema holds school-owned settings and operational records. Public school information may read tenant branding only after the tenant schema is provisioned.

### Key state distinctions

- **School status / active flag:** whether the school account is active, suspended or otherwise unavailable.
- **Verification status:** whether required school documents have been approved.
- **Schema provisioning:** whether the school's tenant schema has been built; `schemaProvisionedAt` is the readiness indicator used by the provisioning view.

A school may be activated after email verification while its schema is still being built. It remains unverified until the required evidence is approved. Payment-account setup is separately locked until verification.

### Workspace activation

When a registrant verifies email, `WorkspaceActivationService.activateForRegistrant()`:

1. Finds the pending school linked to the registrant.
2. Changes its status to active and `isActive` to true.
3. Records activation and an audit event.
4. Queues schema provisioning.
5. Returns workspace information with state `setting_up`.

The operation is intended to be idempotent: only a school still in pending state is activated. If queueing fails, the lifecycle job is expected to detect an active but unbuilt school and queue it again. Email verification itself is not rolled back if activation fails.

### Provisioning visibility and retry

The platform provisioning view uses `schemaProvisionedAt` as the truth for readiness. For unprovisioned schools, queue state is interpreted as queued, running, failed or stuck. A retry is refused when the schema is already provisioned or a job is currently queued/running; failed jobs for that school are removed before a new job is queued. Retry is audited.

## 4. API endpoints

### School realm and public endpoints

All paths are under `/api/v1/schools`.

| Method and path | Access | Purpose |
|---|---|---|
| `GET /public/:subdomain` | Public | Return safe school branding and availability state for login |
| `GET /` | Authenticated; tenant required; `school.view` | Get current school profile |
| `PUT /` | Authenticated; tenant required; `school.update` | Update current school profile |
| `POST /logo` | Authenticated; tenant required; `school.update`; upload limiter; multipart `logo` | Upload school logo |
| `GET /documents` | Authenticated; tenant required; `school.documents.manage` | List verification documents with signed file links |
| `POST /documents` | Authenticated; tenant required; `school.documents.manage`; upload limiter; multipart `document` | Upload verification document and metadata |
| `POST /payment-setup` | Authenticated; tenant required; `school.payments.manage`; verified school required | Create or change fee settlement account |
| `GET /dashboard` | Authenticated; tenant required; `school.dashboard.view` | Get school dashboard data |
| `GET /setup-checklist` | Authenticated; tenant required; `school.update` | Get setup checklist |

### Platform realm endpoints

All paths are under `/api/v1/platform/schools`.

| Method and path | Permission | Purpose |
|---|---|---|
| `GET /` | `platform.schools.view` | Paginated school listing |
| `POST /` | `platform.schools.create` | Create a school and its initial admin |
| `GET /overview` | `platform.overview.view` | Platform totals/overview |
| `GET /provisioning` | `platform.schools.provisioning` | Provisioning state, counts and queue information |
| `POST /:id/provisioning/retry` | `platform.schools.provisioning.retry` | Retry failed/stuck provisioning |
| `PUT /documents/:documentId/approve` | `platform.schools.verify` | Approve a school document |
| `PUT /documents/:documentId/reject` | `platform.schools.verify` | Reject a school document |
| `POST /:id/impersonate` | `platform.schools.impersonate` | Create a one-time impersonation ticket |
| `GET /:id` | `platform.schools.view` | Get a platform school detail view |
| `PUT /:id` | `platform.schools.manage` | Update school fields from platform |
| `GET /:id/documents` | `platform.schools.documents` | List school documents for review |
| `PUT /:id/verify` | `platform.schools.verify` | Verify school |
| `PUT /:id/reject` | `platform.schools.verify` | Reject school verification |
| `PUT /:id/suspend` | `platform.schools.suspend` | Suspend school |
| `PUT /:id/reactivate` | `platform.schools.suspend` | Reactivate school |

Platform routes require authentication and platform permissions. Platform permissions are evaluated in the platform realm; school sessions cannot use them.

## 5. Request DTOs

### UpdateSchoolDto — `PUT /api/v1/schools` and platform update

Strict object; at least one field is required.

| Field | Rule |
|---|---|
| `name` | Optional; trimmed; 2–100 characters |
| `email` | Optional valid email |
| `phone` | Optional nullable; trimmed; 7–30 characters |
| `website` | Optional nullable URL; max 200 characters |
| `address` | Optional nullable; max 200 characters |
| `city`, `state`, `country` | Optional; max 100 characters |
| `timezone` | Optional valid IANA time-zone identifier; max 60 characters |
| `schoolCategory` | `primary`, `secondary`, `primary_secondary` |
| `schoolOwnership` | `private`, `public`, `mission`, `international` |

Once verified, the school cannot change `name`, `schoolCategory` or `schoolOwnership` through its own profile endpoint. Platform update is the path for those locked fields.

### UploadDocumentDto — `POST /documents`

- `type`: `cac_certificate`, `proprietor_id`, `waec_approval`, `ministry_approval`, `other`.
- Optional `idDocumentType`: `nin`, `voters_card`, `drivers_license`, `international_passport`, `other`.
- Optional `idNumber`: 5–40 characters.
- Optional `proprietorFullName`: 3–120 characters.
- Optional `proprietorDateOfBirth`: parseable date string.
- For `proprietor_id`, `idDocumentType`, `idNumber` and `proprietorFullName` are required.
- Multipart file field: `document`; max 5 MB.

### SetupPaymentDto — `POST /payment-setup`

- `bankCode`: trimmed, 2–10 characters.
- `accountNumber`: exactly 10 digits.
- `password`: optional in DTO; required by use-case logic when changing an existing settlement account.

### Platform DTOs

**CreateSchoolDto**
- `name`: 3–100 characters.
- `subdomain`: lowercase 3–50 characters; letters/digits/internal hyphens only.
- `email`: valid email.
- Optional `phone`: 7–30 characters.
- `schoolCategory`: `primary`, `secondary`, `primary_secondary`.
- `schoolOwnership`: `private`, `public`, `mission`, `international`.
- `admin`: required object with firstName, lastName, email and optional phone.

**ListSchoolsQuery**
- `page`: integer, default 1, min 1.
- `limit`: integer, default 20, range 1–100.
- Optional `status`: `pending`, `active`, `suspended`, `deactivated`.
- Optional `verificationStatus`: `unverified`, `under_review`, `verified`, `rejected`.
- Optional `search`: max 100 characters.

The controller parses this query directly because the generic validation middleware does not write parsed query values back to `req.query`.

**VerifySchoolDto**
- Optional `note`, max 500 characters.
- `override`: boolean, defaults false; allows platform verification even when required documents are not all approved.

**RejectSchoolDto**, **SuspendSchoolDto**, **RejectDocumentDto**
- Required `reason`, trimmed, 10–500 characters.

The provisioning query accepts `page`, `limit`, `state` (`all`, `provisioned`, `pending`, `failed`) and optional `search` (max 100 characters).

## 6. Response contracts

Controllers use the shared success envelope `{ success, message, data }`, with HTTP 201 for school creation and document upload. School listing uses the shared paginated envelope with `meta`. Provisioning status uses a custom envelope containing `data`, `meta` and `counts`.

### Public school information

The public login endpoint returns:

- `name`, `subdomain`, `logoUrl`, `schoolCategory`
- `state`: `active`, `setting_up`, `suspended` or `unavailable`
- `primaryColor`, `secondaryColor`, `motto`
- `website`, `address`

It intentionally excludes verification internals. Branding colors and motto are read from the tenant schema only when active and provisioned; defaults are used if tenant branding cannot be read.

### Other response shapes

- School profile and platform school details are mapped through `SchoolMapper`.
- School documents are mapped through `SchoolDocumentMapper`; school-side listing replaces storage paths with short-lived signed URLs.
- Payment setup returns the school response plus `accountNameMatchesSchool`.
- Platform school list returns mapped school/plan/MRR values with pagination metadata.
- Provisioning returns rows with `provisioned`, `state`, failure reason, attempts and last-attempt timestamp, plus aggregate counts.
- Provisioning retry returns `{ schoolId, state: "queued" }`.

The full mapper field lists and each platform use-case response should be linked into the eventual OpenAPI specification after the module contract pass; this guide does not duplicate every school field.

## 7. Business rules

### School profile

After verification, school name, category and ownership are locked for school-side editing. Email uniqueness is checked before update. Changed fields are audited with before/after values.

### Verification documents

- File type is sniffed from bytes; client MIME type is not trusted.
- Maximum document size is 5 MB.
- Accepted document formats are PDF, JPG and PNG; WebP is explicitly rejected.
- Upload count is bounded per document type by `MAX_DOCUMENTS_PER_TYPE`.
- Proprietor ID number is encrypted before persistence.
- Government ID verification is attempted when the required metadata is supplied.
- Provider failure does not block upload; the document remains under manual review.
- First upload moves verification status from unverified or rejected to under_review.
- If all ownership-type-required documents are approved, `SchoolApprovalCheckerService` triggers automatic verification through the normal verification use case.

### Payment settlement account

- Route requires `school.payments.manage` and `requireVerifiedSchool`.
- Initial setup does not require password confirmation; changing an existing account does.
- Password confirmation uses the Auth login-attempt limiter.
- Account number is encrypted at rest; only last four digits and account name are exposed in school response.
- Account ownership is checked through Paystack account verification.
- Account-name comparison with the school name is flagged in response/audit, but a mismatch is not an automatic rejection.
- A change sends notifications to the school's registered email and the acting user's email.
- The Paystack subaccount is created with zero percentage charge in the inspected use case.

### School lifecycle automation

The daily lifecycle use case handles four categories:

1. **Unconfirmed registration:** pending registrations older than the configured window (default 72 hours) are released; the unconfirmed login may be removed if it belongs to no other school.
2. **Stuck provisioning:** active schools whose schema is not provisioned after the configured stuck threshold are queued again.
3. **Unverified trial:** reminders are sent at 7 and 1 days remaining (configured trial default 30 days); expired schools are suspended, not deleted.
4. **Retention:** after the configured retention period (default 60 days after suspension), a school suspended for verification expiry is released only when the tenant data check confirms no school data. Schools with data are held for human review. If the data check errors, the school is held rather than automatically dropped.

The three lifecycle windows are platform settings with policy constants as fallbacks. Recheck the scheduler wiring before relying on the exact cadence in operations.

## 8. Permissions

### School realm

| Key | Purpose |
|---|---|
| `school.view` | View school profile |
| `school.update` | Edit school profile, logo and setup |
| `school.documents.manage` | Upload/view verification documents |
| `school.payments.manage` | Set up payment settlement account |
| `school.dashboard.view` | View school dashboard |

### Platform realm

| Key | Purpose |
|---|---|
| `platform.schools.view` | View all schools |
| `platform.schools.create` | Create schools |
| `platform.schools.manage` | Edit school details, including locked fields |
| `platform.schools.verify` | Verify/reject schools and documents |
| `platform.schools.suspend` | Suspend/reactivate schools |
| `platform.overview.view` | View platform totals |
| `platform.schools.impersonate` | Create school impersonation ticket |
| `platform.schools.provisioning` | View provisioning state |
| `platform.schools.provisioning.retry` | Retry provisioning |
| `platform.schools.documents` | View verification documents |

All declared keys use ALL scope and STAFF persona in their respective realm. Sensitive flags are set for high-impact school/platform operations. Registry synchronization and deployed grants must be verified separately.

## 9. Background jobs and integrations

- Workspace activation enqueues the schema-provisioning job.
- The provisioning queue is also queried by platform provisioning status and retry.
- School lifecycle processing requeues stuck provisioning and performs registration expiry, trial reminders, suspension and retention release.
- School module depends on Notifications and Audit for lifecycle messages and traceability.
- Paystack is used for settlement account verification/subaccount creation.
- A document-verification provider may verify proprietor government ID.
- Supabase storage stores school logos and verification documents.

## 10. Tests and coverage

The inspected School test directory contains:

- `apps/api/tests/school/school-admin-directory.test.ts`: three focused cases covering tenant-context admin lookup, missing/unbuilt school behavior, and isolation when one school's schema is unreadable during multi-school contact lookup.

No broad tests were found in the inspected School test directory for registration activation, schema provisioning/retry, document upload/review, payment setup, verification override, suspension/reactivation or retention release. This does not prove those behaviors are untested elsewhere.

**Verification performed for this documentation:** source inspection only. Tests, migrations, provisioning queue, storage, payment provider, ID verification provider, mail delivery and live HTTP requests were not run.

## 11. Frontend integration requirements

1. Resolve school context from the current school host; do not send a school ID to choose the tenant.
2. Use `GET /api/v1/schools/public/:subdomain` for login branding and handle `setting_up`, `suspended` and `unavailable` states.
3. School-side profile editing must disable name/category/ownership after verification; backend validation remains authoritative.
4. Upload logo using multipart field `logo`, max 2 MB; upload documents using multipart field `document`, max 5 MB.
5. Show document status and signed file URLs from the API; do not construct storage URLs from internal file paths.
6. Collect proprietor ID metadata when uploading a proprietor ID document.
7. Do not show payment-account setup as available until the school is verified; require password confirmation when changing an existing account.
8. Platform school screens must distinguish school status, verification status and schema provisioning state.
9. Platform provisioning UI should show counts and states separately; a school can be active while provisioning is still incomplete.
10. Verification override should be an explicitly privileged platform action with a clear warning.
11. Treat impersonation as a ticket exchange flow, not as direct client-side token construction.

## 12. Outstanding verification

| Item | Status |
|---|---|
| School and platform route mounts | Source-verified |
| DTO schemas and route permission keys | Source-verified |
| Workspace activation and provisioning queue call | Source-reviewed; queue not executed |
| Verification-document file sniffing and approval path | Source-reviewed; provider not called |
| Payment setup safeguards | Source-reviewed; Paystack not called |
| Lifecycle release/retention rules | Source-reviewed; scheduler/runtime not executed |
| Full School mapper response fields | Not yet fully documented |
| Provisioning scheduler cadence and deployment configuration | Requires scheduler/operations verification |
| Broad school lifecycle/provider integration coverage | Not yet verified |
| Permission registry sync and deployed grants | Not yet verified |

## Related documentation

- [Auth module](auth.md)
- [Users module](users.md)
- [Multi-tenancy and database architecture](../../../architecture/multi-tenancy-and-database.md)
- [Authentication and authorization architecture](../../../architecture/authentication-and-authorization.md)
- [Roles module](roles.md)
