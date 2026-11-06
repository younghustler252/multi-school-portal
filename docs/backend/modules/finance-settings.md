# Finance Settings Module

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. This guide documents the central school-level finance policy registry and its consumers. Test sources and the original settings-table migration were inspected but not executed.

## Responsibility and boundaries

Finance Settings is the single source of truth for configurable finance policy. It replaces module-local constants with typed per-school values. It owns:

- The registry of supported keys, types, defaults and allowed ranges.
- Strict validation for writes and forgiving fallback for invalid historical stored values.
- School-specific override persistence in `SchoolSettingValue`.
- A request-scoped/scoped `FinanceSettingsService` used by finance modules.
- The settings screen read model, including default, effective value and override status.

It is not plan-gated: every school has finance settings. It does not own accounting data or execute finance operations; other modules consume its effective values.

## Runtime composition and route mount

Mounted at `/api/v1/finance/settings`. The container registers:

- `FinanceSettingsRepositoryImpl`
- `FinanceSettingsService`
- `GetFinanceSettingsUseCase`
- `UpdateFinanceSettingsUseCase`
- `FinanceSettingsController`

The service is scoped and deliberately caches nothing. It reads the current tenant's overrides on each call to prevent one school's settings leaking into another school through a shared container.

## HTTP endpoints

Base path: `/api/v1/finance/settings`.

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/` | `finance.settings.view` | Return all registered settings with effective value, default, range/options and `isOverridden` |
| PUT | `/` | `finance.settings.manage` | Atomically update 1–20 settings; `null` restores default |

Request shape:

```json
{
  "values": {
    "finance.allow_self_approval": false,
    "finance.grace_days": 7,
    "finance.budget_enforcement": null
  }
}
```

The DTO accepts booleans, numbers, strings up to 50 characters and null. Key existence, expected type and allowed range are checked against the domain registry. Unknown keys and all invalid values are rejected before any write. The body is strict and must contain 1–20 keys.

Permissions:
- `finance.settings.view`: ALL, STAFF.
- `finance.settings.manage`: ALL, STAFF; sensitive because it can weaken approval controls.

## Setting registry

The current registry has 14 settings.

| Key | Type/default | Purpose |
|---|---|---|
| `finance.expense_approval_required` | boolean / true | Require approval for expenses at/above threshold |
| `finance.expense_approval_threshold_kobo` | integer / 5,000,000 | Expense approval threshold in kobo (₦50,000) |
| `finance.second_approval_threshold_kobo` | integer / 0 | Require two different approvers at/above amount; zero disables |
| `finance.allow_self_approval` | boolean / false | Allow requester/creator to approve own requests |
| `finance.budget_enforcement` | enum / warn | `off`, `warn`, or `block` budget overruns |
| `finance.fiscal_year_start_month` | integer / 1 | Month 1–12 for fiscal YTD reporting |
| `finance.grace_days` | integer / 0 | Late-fee grace days after invoice due date |
| `finance.reconciliation_blocks_close` | boolean / false | Make unreconciled bank accounts a close blocker instead of warning |
| `finance.reconciliation_tolerance_days` | integer / 3 | Date window for automatic bank matching |
| `finance.payroll_transfers_enabled` | boolean / false | School opt-in to bank salary transfers; platform switch must also be on |
| `finance.transfer_max_kobo` | integer / 0 | Maximum individual salary transfer; zero means unlimited |
| `finance.transfer_batch_max_kobo` | integer / 0 | Maximum batch total; zero means unlimited |
| `finance.vat_enabled` | boolean / false | Enable input VAT on expense lines |
| `finance.vat_rate_bps` | integer / 750 | Default VAT rate in basis points; 750 = 7.5% |

Integer settings enforce their configured min/max. Values are stored as JSONB in `SchoolSettingValue`; the four amount settings with a `Kobo` field are converted to BigInt when resolved.

## Read and write semantics

- A school override is stored as one row per key.
- No row means use the registry default.
- Sending `null` deletes the override and restores the default.
- Writes are strict: correct type and allowed range are required.
- Reads are forgiving: old string booleans/integers are coerced; invalid stored values fall back to defaults rather than breaking finance operations.
- `describeSettings` returns the value currently in force, the default, and whether a valid school override exists.
- Updates validate all keys before writing any. The repository writes/removes the changed keys inside one tenant transaction.
- No-op updates do not write or audit.
- A single audit event records all actual changes with old/new values and whether each key was reset.

The update transaction commits before the audit call. Audit failure therefore does not roll back a successful setting update; see the shared audit reliability item in the remediation register.

## Finance module consumers

| Setting | Current consumer/behavior |
|---|---|
| Expense approval required/threshold | Expenses submission/approval |
| Second approval threshold | Expenses, payroll, fee adjustments and refunds |
| Allow self approval | Expenses, payroll, fee adjustments/refunds and salary-transfer separation checks |
| Budget enforcement | Expense approval budget checks |
| Fiscal year start month | Finance proprietor dashboard YTD range |
| Grace days | Defined, but late-fee execution currently reads request `graceDays` instead; see REM-020 |
| Reconciliation blocks close | Ledger period-close checklist |
| Reconciliation tolerance days | Bank reconciliation match suggestions |
| Payroll transfers enabled | Salary-transfer start/send/retry switch, alongside platform switch |
| Transfer max/batch max | Salary-transfer preflight limits |
| VAT enabled/rate | Expense line validation and VAT calculation |

Settings are read through `FinanceSettingsService` (or `settingsOf` in hand-built tests). Modules should not duplicate defaults or read the JSONB table directly.

## Persistence

The registry is persisted in tenant `SchoolSettingValue`, introduced by the foundation migration:

`apps/api/prisma/tenant-migrations/20261012002207_foundation_membership_roles_settings_automation/migration.sql`

The table has a primary key on `key`, JSONB `value`, optional `updatedById`, and created/updated timestamps. It is shared with other school settings; the finance repository only reads keys starting with `finance.`.

## Tests and verification status

Test source inspected:
- `apps/api/tests/finance/finance-settings.test.ts`

The test suite covers defaults, type/range validation, forgiving stored-value fallback, unknown keys, all-or-nothing updates, reset-to-default, no-op auditing, expense approval behavior, self-approval, second approval and reconciliation close-checklist behavior. Tests use an in-memory repository; no finance-settings HTTP test or real tenant database test was found in the inspected suite.

**Not executed in this review:** tests, typecheck, build, migration, live HTTP requests or cross-tenant concurrent settings updates.

## Open implementation and verification items

1. **Grace-days setting is currently not consumed by late-fee execution.** This is recorded as REM-020 in the central register; decide whether the setting or explicit request override is authoritative.
2. **Finance settings audit is after the settings transaction.** A failure in audit persistence can return an API error after the values have committed. Align with the shared audit policy (REM-006).
3. **Invalid stored values silently fall back to defaults.** This is intentional resilience, but operators cannot distinguish a corrupted override from an unset default in the current response. Decide whether to expose an invalid-override warning or add an integrity/repair report.
4. **No HTTP or real-tenant DB tests were found.** Add route tests for STAFF persona and sensitive manage permission, plus cross-tenant isolation tests proving a scoped service never reads another school's overrides.
5. **Run finance-settings tests, typecheck/build and migration checks** before production rollout.

## Source paths reviewed

- `apps/api/src/modules/finance-settings/routes/finance-settings.routes.ts`
- `apps/api/src/modules/finance-settings/controllers/finance-settings.controller.ts`
- `apps/api/src/modules/finance-settings/dtos/finance-settings.dto.ts`
- `apps/api/src/modules/finance-settings/domain/finance-settings.ts`
- `apps/api/src/modules/finance-settings/domain/finance-settings.errors.ts`
- `apps/api/src/modules/finance-settings/services/finance-settings.service.ts`
- `apps/api/src/modules/finance-settings/repositories/`
- `apps/api/src/modules/finance-settings/usecases/finance-settings.usecases.ts`
- `apps/api/src/modules/finance-settings/finance-settings.permissions.ts`
- `apps/api/src/modules/finance-settings/finance-settings.container.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/prisma/tenant.prisma`
- `apps/api/prisma/tenant-migrations/20261012002207_foundation_membership_roles_settings_automation/migration.sql`
- `apps/api/tests/finance/finance-settings.test.ts`
