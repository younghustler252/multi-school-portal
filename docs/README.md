# Documentation Index

Source code on `refactor/modules` is authoritative when a document and implementation disagree. This index records the documents currently present; it does **not** imply every listed document has already been verified against the implementation.

## Current engineering guides

| Document | Purpose | Status |
|---|---|---|
| [Platform Documentation](PLATFORM_DOCUMENTATION.md) | Monorepo structure, backend architecture, tenancy, authorization, module registration and route index | Current guide; update when architecture changes |
| [Testing Guide](TESTING_GUIDE.md) | Workspace test commands, test database, safeguards and migration workflow | Current guide; update when test setup changes |
| [Auth Audit](AUTH_AUDIT.md) | Auth security findings and follow-up statuses | Source-reviewed; remediation and runtime verification remain outstanding |

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

## Module documentation awaiting source comparison

These documents are retained for their potential implementation context. They are not yet certified as current API contracts. The module-by-module pass should compare each with routes, controllers, DTOs, use cases, repositories, permissions/scopes, container wiring, schema/migrations, jobs and tests.

- [Attendance](ATTENDANCE_MODULE_NOTES.md)
- [Audit](AUDIT_MODULE_NOTES.md)
- [Branches](BRANCHES_MODULE_NOTES.md)
- [Classes](CLASSES_MODULE_NOTES.md)
- [Enrolment](ENROLMENT_MODULE_NOTES.md)
- [Grades setup](GRADES_SETUP_NOTES.md)
- [Grades sheets](GRADES_SHEETS_NOTES.md)
- [Graduation](GRADUATION_NOTES.md)
- [Guardians](GUARDIANS_MODULE_NOTES.md)
- [Plans](PLANS_MODULE_NOTES.md)
- [Report cards](REPORT_CARDS_NOTES.md)
- [Roles](ROLES_MODULE_NOTES.md)
- [School](SCHOOL_MODULE_NOTES.md)
- [Sessions](SESSIONS_MODULE_NOTES.md)
- [Students](STUDENTS_MODULE_NOTES.md)
- [Student import](STUDENT_IMPORT_NOTES.md)
- [Users](USER_MODULE_NOTES.md)
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
