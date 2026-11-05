# Documentation Architecture and Migration Map

> **Status:** Phase 4 in progress — target structure approved; core architecture guides split; backend module source audits underway.
> **Branch reviewed:** `refactor/modules`.
> **Scope:** Documentation planning only. This file does not move, rewrite, archive, or delete existing documents.
> **Authority:** Application source, Prisma schemas and migrations, tests, runtime configuration, and shared contracts remain authoritative. Documentation must not claim runtime verification unless it was performed.

## 1. Goals and boundaries

The documentation system has four distinct audiences:

1. **All developers:** repository setup, system architecture, conventions, and engineering decisions.
2. **Backend developers:** module boundaries, route behaviour, authorization, business rules, persistence, jobs, and operational consequences.
3. **Frontend developers:** route/page structure, API integration, authentication, permissions, shared contracts, state management, and UI conventions.
4. **Operators:** deployment, migrations, backups, environment configuration, monitoring, and recovery.

The API contract must be consumable without requiring a frontend developer to understand backend implementation details. Backend module notes must explain implementation and business behaviour without becoming a second, conflicting endpoint specification.

## 2. Target directory structure

Only create a target file when its content is ready and has an identified owner/source. Empty placeholder files are not a deliverable.

```text
docs/
├── README.md                         # documentation entry point and reading paths
├── DOCUMENTATION_MIGRATION_MAP.md    # this plan; remove or supersede when migration completes
│
├── architecture/
│   ├── system-overview.md
│   ├── monorepo-architecture.md
│   ├── multi-tenancy.md
│   ├── authentication-and-authorization.md
│   ├── database-architecture.md
│   └── background-processing.md
│
├── backend/
│   ├── README.md
│   ├── api-conventions.md
│   ├── error-handling.md
│   └── modules/
│       ├── auth.md
│       ├── users.md
│       ├── school.md
│       ├── students.md
│       ├── guardians.md
│       ├── enrolment.md
│       ├── sessions.md
│       ├── classes.md
│       ├── attendance.md
│       ├── grades.md
│       ├── report-cards.md
│       ├── finance.md
│       └── ...
│
├── frontend/
│   ├── README.md
│   ├── architecture.md
│   ├── routing-and-navigation.md
│   ├── api-integration.md
│   ├── authentication.md
│   ├── authorization-and-permissions.md
│   ├── state-management.md
│   └── ui-conventions.md
│
├── api/
│   └── openapi.yaml                 # HTTP contract; coverage and generation strategy to be decided
│
├── operations/
│   ├── deployment.md
│   ├── environment-variables.md
│   ├── database-migrations.md
│   ├── backup-and-recovery.md
│   └── go-live.md
│
├── security/
│   └── auth-audit.md
│
├── decisions/
│   ├── 0002-monorepo.md
│   └── ...
│
├── workstreams/
│   ├── finance/
│   ├── settings-and-automation/
│   └── ...
│
└── archive/
    └── README.md                   # explains why historical material was archived
```

### Structure rules

- `packages/contracts` remains the code-level home for shared schemas and types. It is not moved into `docs/`.
- `docs/api/openapi.yaml` describes the HTTP interface: paths, methods, parameters, request/response schemas, security requirements, and documented errors.
- `docs/backend/modules/` explains backend module responsibilities, workflows, invariants, persistence, permissions, jobs, and links to the API contract.
- `docs/frontend/` explains how the web application is structured and how to consume the API. It must not duplicate backend use-case implementation notes.
- `docs/workstreams/` holds active, temporary delivery handoffs and phase notes. When a workstream closes, enduring decisions move into architecture, backend, operations, or decisions documentation; only genuinely historical execution notes are archived.
- `docs/archive/` is not a dumping ground. Archived material must have a reason, date/status, and pointer to its replacement where one exists.
- Module documentation must use current source paths (for example, `apps/api/src/modules`) and identify the source snapshot reviewed.
- No document should say an endpoint is available merely because it appears in an old handoff or API draft.

## 3. Existing document migration map

| Current file | Target | Action | Notes |
|---|---|---|---|
| `docs/README.md` | `docs/README.md` | Rewrite after moves | Become the navigation page with paths for new contributors, backend, frontend, and operations. |
| `docs/PLATFORM_DOCUMENTATION.md` | `docs/architecture/` (split into focused documents) | Split and consolidate | Preserve source-checked architecture. System overview, monorepo, tenancy, authorization, persistence, jobs and finance invariants should have clear homes. Avoid repeating the same architecture in several files. |
| `docs/TESTING_GUIDE.md` | `docs/backend/testing.md` or root development guide | Move and review | It covers workspace commands and API test safeguards; retain web-specific checks only where confirmed. |
| `docs/AUTH_AUDIT.md` | `docs/security/auth-audit.md` | Move, then maintain | Security findings and remediation status, not general auth onboarding. Keep audit limitations explicit. |
| `docs/GO_LIVE_CHECKLIST.md` | `docs/operations/go-live.md` | Review before moving | Historical checklist may contain stale commands/migrations; verify every step against current scripts and deployment model. |
| `docs/FINANCE_HANDOFF.md` | `docs/workstreams/finance/handoff.md` | Move and maintain | Current finance state and next steps. Extract enduring accounting invariants into architecture/backend finance documentation. |
| `docs/FINANCE_PHASE6_NOTES.md` | `docs/workstreams/finance/phase-6.md` | Move, verify, then archive when closed | Historical phase record; verify completion claims and migration references first. |
| `docs/SETTINGS_AUTOMATION_HANDOFF.md` | `docs/workstreams/settings-and-automation/handoff.md` | Move and maintain while active | Current delivery status and remaining work. |
| `docs/SETTINGS_AUTOMATION_NOTES.md` | `docs/backend/modules/settings-and-automation.md` | Consolidate | Preserve lasting behaviour and decisions; remove duplicated handoff status once captured. |
| `docs/PROJECT_BRIEF.md` | `docs/decisions/` or `docs/archive/` | Reconcile, do not blindly move | Early product brief includes historical stack, roadmap and architecture assumptions. Extract still-valid product constraints; archive superseded assumptions. |
| `docs/schoolos-api-documentation.md` | `docs/archive/` after contract migration | Supersede, not immediately delete | Narrative route reference is manually compiled and explicitly requires source validation. Extract verified business rules; replace endpoint reference with OpenAPI. |
| `docs/swagger.yaml` | `docs/api/openapi.yaml` | Replace after coverage decision | Existing starter specification contains legacy paths and must not be treated as current. Do not simply rename it. |
| `docs/decisions/0002-monorepo.md` | `docs/decisions/0002-monorepo.md` | Keep; review status and open questions | Decision record remains useful. Update only if current implementation or decision status has changed. |
| `docs/ATTENDANCE_MODULE_NOTES.md` | `docs/backend/modules/attendance.md` | Source-audit, rewrite | Separate current endpoint contract from backend rules; preserve historical test claims with dates/limitations. |
| `docs/BRANCHES_MODULE_NOTES.md` | `docs/backend/modules/branches.md` | Source-audit, rewrite | Very short implementation note; verify route mount and permission names. |
| `docs/CLASSES_MODULE_NOTES.md` | `docs/backend/modules/classes.md` | Source-audit, rewrite | Preserve business rules and response-shape decisions only when confirmed. |
| `docs/ENROLMENT_MODULE_NOTES.md` | `docs/backend/modules/enrolment.md` | Source-audit, rewrite | Verify current route prefix, permissions, transitions, and relationship to students/classes. |
| `docs/GUARDIANS_MODULE_NOTES.md` | `docs/backend/modules/guardians.md` | Source-audit, rewrite | Verify invite/link/unlink and guardian-child access flows. |
| `docs/PLANS_MODULE_NOTES.md` | `docs/backend/modules/plans-and-entitlements.md` | Source-audit, rewrite | Historical apply instructions must not survive as executable guidance. |
| `docs/SESSIONS_MODULE_NOTES.md` | `docs/backend/modules/sessions-and-terms.md` | Source-audit, rewrite | Verify session/term lifecycle and current schema. |
| `docs/STUDENTS_MODULE_NOTES.md` | `docs/backend/modules/students.md` | Source-audit, rewrite | Separate student CRUD, enrolment links, import and promotion workflows. |
| `docs/STUDENT_IMPORT_NOTES.md` | `docs/backend/modules/student-import.md` or students page | Consolidate | Likely a subsection of students documentation unless import complexity warrants a separate page. |
| `docs/SCHOOL_MODULE_NOTES.md` | `docs/backend/modules/school.md` | Source-audit, rewrite | Current source comparison exists; verify its final formatting and route table before moving. |
| `docs/USER_MODULE_NOTES.md` | `docs/backend/modules/users.md` | Source-audit, rewrite | Historical apply section remains; preserve current source comparison and remove stale executable instructions during rewrite. |
| Auth module (new source documentation) | `docs/backend/modules/auth.md` | Source-audit, document | Created from current Auth routes, controllers, DTOs, use cases, services, repositories and focused tests. Runtime/integration verification remains outstanding. |
| `docs/ROLES_MODULE_NOTES.md` | `docs/backend/modules/roles-and-permissions.md` | Source-audit, rewrite | Explain RBAC administration and permission semantics. Link to shared authorization architecture. |
| `docs/ROLE_SYNC_NOTES.md` | `docs/operations/permission-registry-sync.md` or backend RBAC page | Consolidate | Operational procedure only if still required; otherwise fold into roles/permissions documentation. |
| `docs/GRADES_SETUP_NOTES.md` | `docs/backend/modules/grades.md` | Consolidate | Combine with mark-sheet workflow after source audit. |
| `docs/GRADES_SHEETS_NOTES.md` | `docs/backend/modules/grades.md` | Consolidate | Merge setup and workflow into one coherent grades module guide. |
| `docs/REPORT_CARDS_NOTES.md` | `docs/backend/modules/report-cards.md` | Source-audit, rewrite | Preserve snapshot, publish, PDF and queue rules after confirming source. |
| `docs/GRADUATION_NOTES.md` | `docs/backend/modules/student-lifecycle.md` or students page | Consolidate | Promotion/graduation rules belong with student lifecycle unless they become a distinct module. |
| `docs/WEBHOOKS_MODULE_NOTES.md` | `docs/backend/modules/webhooks.md` | Source-audit, rewrite | Document signature verification, idempotency, handler ownership and provider-specific boundaries. |
| `docs/AUDIT_MODULE_NOTES.md` | `docs/backend/modules/audit.md` | Source-audit, rewrite | Document audit guarantees and failure behaviour; link to security guidance. |
| `docs/SMALL_FIXES_NOTES.md` | `docs/archive/` after extraction | Extract then archive | This is a mixed hardening change log. Move lasting behaviour into the owning module docs; retain only useful historical context. |

## 4. Frontend documentation sources and boundaries

**Sequencing decision (2026-11-05):** Frontend documentation is deferred. The existing frontend is behind the backend and is not the architecture source of truth for the upcoming frontend implementation. Complete the backend module guides and HTTP/shared-contract audit first; then write frontend implementation specifications against those verified contracts.

The frontend guide must be written from `apps/web`, not inferred from backend docs. The inspected structure currently includes:

- App route groups under `apps/web/src/app`: `(auth)`, `(dashboard)`, `(marketing)`, `(super-admin)`, plus onboarding and maintenance routes.
- Feature folders under `apps/web/src/features`, including auth, students, guardians, classes, enrolment, attendance, fees, grades, report cards, school, staff, notifications, subscriptions and super-admin.
- Shared API utilities under `apps/web/src/lib/api`.
- Authentication and tenant stores under `apps/web/src/stores`.
- Navigation, RBAC and tenant/subdomain helpers under `apps/web/src/lib`.
- Shared code-level contracts under `packages/contracts`.

These are inventory observations, not a complete frontend architecture audit. The frontend documents should be created only after inspecting actual API client configuration, query/cache usage, route protection, feature folder conventions, form validation, and error handling.

| Frontend guide | Source of truth to inspect |
|---|---|
| Architecture and feature boundaries | `apps/web/src/app`, `features`, `components`, `config` |
| Routing and navigation | App Router route groups, layouts, middleware, `nav-config.ts` |
| API integration | `apps/web/src/lib/api`, feature services, `packages/contracts` |
| Authentication | Auth routes/features, auth store, middleware, API auth contract |
| Authorization | `rbac.ts`, navigation config, server/API permission enforcement |
| State management | `apps/web/src/stores`, TanStack Query usage and local feature state |
| UI conventions | Shared components, feature components, styling and form patterns |

## 5. API contract strategy

### Current facts

- `packages/contracts` exports shared Zod request schemas and TypeScript types for selected areas, plus shared error-code definitions.
- The web app consumes the contracts package.
- The API currently owns its DTOs separately.
- `apps/api/tests/contracts/parity.test.ts` checks selected shared schemas against API DTOs using representative inputs; it does not prove parity for every API endpoint.
- The current `docs/swagger.yaml` is a starter document with legacy paths.
- The narrative API reference is manually compiled and warns that routes require source validation.

### Proposed direction

1. Keep `packages/contracts` as the shared TypeScript/Zod contract package.
2. Establish OpenAPI as the human- and tool-consumable HTTP API reference.
3. Decide whether OpenAPI is authored directly, generated from route/DTO metadata, or generated from a future unified schema strategy. Do not assume Zod-to-OpenAPI generation is already configured.
4. Add endpoints to OpenAPI only after checking route registration, middleware, DTO/query validation, controller response mapping, use-case output and error behaviour.
5. Expand contract parity tests incrementally. Do not claim full parity until coverage supports it.
6. Frontend module docs link to OpenAPI operations and explain feature-specific workflows; they do not copy every request/response schema into prose.

## 6. Migration sequence and acceptance criteria

| Step | Work | Acceptance criteria |
|---|---|---|
| 2.1 | Approve this structure and migration map | Folder ownership and document destinations are agreed. |
| 2.2 | Create the target directories as documents are migrated | No empty placeholder tree; every moved file has a destination and updated links. |
| 2.3 | Move architecture and engineering guides | No broken internal links; current source snapshot and limitations retained. |
| 2.4 | Reorganize active workstream handoffs | Active work remains easy to find; completed work is not presented as an active instruction list. |
| 2.5 | Audit and migrate backend module docs | Each page is source-checked and distinguishes current behaviour, deferred work and historical context. |
| 2.6 | Decide and establish OpenAPI workflow | Specification reflects verified mounted routes and documented request/response/security behaviour. |
| 2.7 | Audit and write frontend guides | Each guide reflects actual web implementation and links to shared contracts/OpenAPI. |
| 2.8 | Update root README, CONTRIBUTING and docs index | New developers have a clear reading path; old paths are removed or redirected. |
| 2.9 | Archive superseded references | Archive has replacement pointers; no active guide links to obsolete contracts. |

## 7. Documentation quality rules

Every maintained technical document should state:

- Purpose and intended audience.
- Current source paths and, where appropriate, branch/commit/date reviewed.
- Whether it describes current implementation, a proposal, an audit finding, or historical work.
- Relevant permissions, validation and business invariants where applicable.
- Verification performed and not performed (tests, builds, migrations, runtime/API checks).
- Links to authoritative code/contracts instead of duplicated definitions.
- Open gaps and deferred work, without presenting them as completed.

Never retain executable copy/delete/apply instructions in a current architecture or module guide unless they are a verified, still-required operational procedure.
