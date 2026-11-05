# Documentation Index

> **Architecture refactor:** See [Documentation Architecture and Migration Map](DOCUMENTATION_MIGRATION_MAP.md) for the approved target structure, ownership boundaries, existing-file destinations, and migration sequence. The map is a plan; it does not mean files have already been moved.


Source code on `refactor/modules` is authoritative when a document and implementation disagree. This index records the documents currently present; it does **not** imply every listed document has already been verified against the implementation.

## Current engineering guides

| Document | Purpose | Status |
|---|---|---|
| [System and Monorepo Architecture](architecture/system-and-monorepo.md) | System shape, workspace boundaries, technology baseline and backend module conventions | Current source-checked guide |
| [Multi-Tenancy and Database Architecture](architecture/multi-tenancy-and-database.md) | PostgreSQL schema-per-school model, tenant context and migration boundaries | Current source-checked guide |
| [Authentication and Authorization](architecture/authentication-and-authorization.md) | Permission realms, scopes, entitlements and enforcement boundaries | Current source-checked guide |
| [Background Processing](architecture/background-processing.md) | API/worker separation, queues, schedulers and tenant context | Current source-checked guide |
| [Finance Architecture](architecture/finance-architecture.md) | Cross-module accounting invariants and finance boundaries | Current source-checked guide |
| [Legacy Platform Documentation](PLATFORM_DOCUMENTATION.md) | Redirect to the split architecture guides | Retained for backward compatibility |
| [Testing Guide](TESTING_GUIDE.md) | Workspace test commands, test database, safeguards and migration workflow | Current guide; update when test setup changes |
| [Auth Audit](AUTH_AUDIT.md) | Auth security findings and follow-up statuses | Source-reviewed; remediation and runtime verification remain outstanding |

## Backend module documentation

| Document | Purpose | Status |
|---|---|---|
| [Backend Documentation](backend/README.md) | Backend documentation reading path and module audit sequence | Active |
| [Backend Remediation Register](backend/BACKEND_REMEDIATION_REGISTER.md) | Cumulative developer handoff for confirmed findings, potential risks and verification tasks | Active; updated as module audits progress |
| [Auth Module](backend/modules/auth.md) | Authentication, sessions, password recovery, invitations and impersonation | Source-reviewed; runtime and integration verification outstanding |
| [Users Module](backend/modules/users.md) | Profiles, passwords, avatars, sessions and platform user administration | Source-reviewed; runtime and integration verification outstanding |
| [School Module](backend/modules/school.md) | School profile, verification, provisioning, payments and lifecycle | Source-reviewed; provider/runtime verification outstanding |
| [Roles and Permissions](backend/modules/roles.md) | Role management, permission catalog, scopes and registry synchronization | Source-reviewed; registry sync/runtime verification outstanding |
| [Branches Module](backend/modules/branches.md) | Branch directory, lifecycle, plan limits and visibility scopes | Partially source-verified; tests/schema/runtime verification outstanding |
| [Staff Module](backend/modules/staff.md) | Staff records, branch assignment, portal access and lifecycle | Partially source-verified; remaining use cases/tests/schema/runtime verification outstanding |
| [Students Module](backend/modules/students.md) | Student records, lifecycle, branch transfer, photos and CSV import | Partially source-verified; remaining lifecycle/photo/schema/test verification outstanding |
| [Guardians Module](backend/modules/guardians.md) | Guardian records, student links and portal invitations | Partially source-verified; update/repository/schema/test verification outstanding |
| [Classes and Subjects](backend/modules/classes.md) | Class setup, subjects, teaching assignments and progression | Partially source-verified; remaining use cases/schema/test verification outstanding |
| [Enrolment Module](backend/modules/enrolment.md) | Term-specific student placement, class capacity, scoped lists and promotion | Partially source-verified; schema/migration/runtime verification outstanding |
| [Sessions Module](backend/modules/sessions.md) | Academic sessions, terms, current period, calendar events and rollover | Partially source-verified; schema/migration/runtime verification outstanding |
| [Attendance Module](backend/modules/attendance.md) | Class registers, daily marks, permission scopes, summaries and audit history | Partially source-verified; tests/runtime and summary authorization review outstanding |
| [Grades Module](backend/modules/grades.md) | Grading scales, assessment schemes, mark sheets, score entry, publication and published-result access | Source-reviewed; DB/migration execution, HTTP tests and runtime verification outstanding |
| [Report Cards Module](backend/modules/report-cards.md) | Report-card snapshots, calculation, remarks, publication, guardian notifications and PDF rendering | Source-reviewed; migration/HTTP/worker verification outstanding |
| [Student Graduation Lifecycle](backend/modules/graduation-lifecycle.md) | Graduation through promotion, undo, plan eligibility, enrolment and term rollover | Source-reviewed; DB/migration execution, HTTP and quota-concurrency verification outstanding |
| [Fees Module](backend/modules/fees.md) | Fee setup, invoices, discounts, adjustments, instalments, opening balances, late fees and fee reports | Source-reviewed; migration/HTTP/runtime verification and remediation outstanding |

## Workstream handoffs and operational guides

| Document | Purpose | Review status |
|---|---|---|
| [Finance Handoff](FINANCE_HANDOFF.md) | Finance module state, accounting invariants and next steps | Active handoff; module-by-module verification pending |
| [Finance Phase 6 Notes](FINANCE_PHASE6_NOTES.md) | Detailed Phase 6 implementation notes | Verify against current finance source before acting |
| [Settings and Automation Handoff](SETTINGS_AUTOMATION_HANDOFF.md) | Settings, templates, notifications and automation workstream | Active handoff; verification pending |
| [Settings and Automation Notes](SETTINGS_AUTOMATION_NOTES.md) | Supporting design and implementation notes | Verification pending |
| [Go-Live Checklist](GO_LIVE_CHECKLIST.md) | Production-readiness checklist | Verify each item against current deployment setup |
| [Role Sync Notes](ROLE_SYNC_NOTES.md) | Role and permission synchronization behavior | Verify commands and target environment before execution |
| [Small Fixes Notes](SMALL_FIXES_NOTES.md) | Small implementation fixes and follow-up context | Historical/supporting; review for still-open items |

## Legacy module notes awaiting migration or review

These older notes are retained for historical context. They are not certified as current API contracts; use the source-reviewed module guides above where available.

- [Audit](AUDIT_MODULE_NOTES.md)
- [Grades setup](GRADES_SETUP_NOTES.md)
- [Grades sheets](GRADES_SHEETS_NOTES.md)
- [Graduation](GRADUATION_NOTES.md)
- [Plans](PLANS_MODULE_NOTES.md)
- [Report cards](REPORT_CARDS_MODULE_NOTES.md)
- [Student import](STUDENT_IMPORT_NOTES.md)
- [Webhooks](WEBHOOKS_MODULE_NOTES.md)

## Project and API reference documents

| Document | Purpose | Review status |
|---|---|---|
| [Project Brief](PROJECT_BRIEF.md) | Product scope and project-level requirements | Check for product-scope changes |
| [API Documentation](schoolos-api-documentation.md) | Narrative API reference | Compare with current routes and DTOs |
| [Swagger Specification](swagger.yaml) | OpenAPI contract | Compare with current route/controller/DTO behavior |
| [Architecture decisions](decisions/) | Durable architecture decisions | Retain unless explicitly superseded |

## Documentation maintenance rules

1. A document is not current merely because it exists or was recently edited.
2. Record the source snapshot and date for substantial audits.
3. Update a handoff only after checking the implementation and tests relevant to its claims.
4. Preserve useful historical decisions, but mark old apply instructions so they cannot be mistaken for current steps.
5. Remove a document only after checking that it contains no unique requirements, decisions, edge cases or unfinished work.
6. Never claim tests, migrations, provider calls or runtime behavior were verified unless those checks were actually run.
7. Prefer current source paths under `apps/api/` and `apps/web/`; old pre-monorepo paths should be corrected when the document is actively maintained.
