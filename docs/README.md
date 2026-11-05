# Documentation Index

This directory contains current engineering guides, active workstream handoffs, and historical implementation notes. Source code on the current branch is authoritative when a note and implementation disagree.

## Current guides

| Document | Purpose |
|---|---|
| [Platform Documentation](PLATFORM_DOCUMENTATION.md) | Monorepo layout, backend architecture, tenancy, authorization, active module wiring and route index |
| [Testing Guide](TESTING_GUIDE.md) | Workspace test commands, test database location, safeguards and migration/test workflow |
| [Auth Audit](AUTH_AUDIT.md) | Security findings and their follow-up status; not a replacement for tests |

## Active workstream handoffs

| Document | Purpose |
|---|---|
| [Finance Handoff](FINANCE_HANDOFF.md) | Current finance module map, accounting invariants, Phase 6 wiring and deployment checks |
| [Settings and Automation Handoff](SETTINGS_AUTOMATION_HANDOFF.md) | Current settings, templates, notifications, automation and platform-side status |

## Supporting notes

- [Settings and Automation Notes](SETTINGS_AUTOMATION_NOTES.md) records design decisions and behavior details. Check current route/use-case source before relying on individual endpoint details.
- [Webhooks Module Notes](WEBHOOKS_MODULE_NOTES.md) records the provider webhook flow and operational notes.
- [Role Sync Notes](ROLE_SYNC_NOTES.md) records role/permission synchronization behavior. Run commands through the API workspace and review the target environment first.
- [Architecture decisions](decisions/) records decisions that should remain durable across implementation passes.

## Historical module implementation notes

The following files were written as implementation/apply handoffs during earlier module passes:

- `CLASSES_MODULE_NOTES.md`
- `GUARDIANS_MODULE_NOTES.md`
- `PLANS_MODULE_NOTES.md`
- `SCHOOL_MODULE_NOTES.md`
- `SESSIONS_MODULE_NOTES.md`
- `STUDENTS_MODULE_NOTES.md`
- `USER_MODULE_NOTES.md`

They may preserve useful decisions, edge cases and frontend contract changes, but they are **not guaranteed to describe the latest implementation**. In particular, do not follow old “copy these files”, “delete these files”, or migration instructions without checking the current source, migrations, tests and workspace scripts. Their paths may refer to the pre-monorepo layout.

## Documentation maintenance rules

1. Update current guides when architecture, workspace scripts, module registration or route mounts change.
2. Update a workstream handoff when verified implementation changes alter its status or next steps.
3. Keep historical notes only when they preserve useful context; otherwise replace them with a current module contract or remove them after confirming no active handoff depends on them.
4. Never claim tests, migrations, provider calls or runtime behavior were verified unless those checks were actually run.
5. Prefer links to current source paths under `apps/api/` and `apps/web/`.
