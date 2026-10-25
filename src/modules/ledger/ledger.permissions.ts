/*
| LEDGER PERMISSION KEYS (the books; brief section 10).
| finance.accounts.view     see the chart of accounts and balances
| finance.accounts.manage   add, rename, deactivate accounts
| finance.journals.view     see journals and lines
| finance.journals.post     manual journals, opening balances and transfers (sensitive: never auto-granted to cloned roles)
| finance.journals.reverse  reverse a posted journal (sensitive)
| finance.periods.view      see the accounting months
| finance.reports.view      account balances and cash book
| finance.periods.close     close an accounting month once its checklist is clean (sensitive)
| finance.periods.reopen    reopen a closed month, with a written reason (sensitive)
| finance.reports.export    download a report as a file
| finance.reports.accountant  trial balance, general ledger, income statement, balance sheet, cash flow
| Scopes are ALL for now; branch-limited finance roles are added with the branch pass.
*/
const ALL_SCOPE = ["ALL"] as const;
const staffOnly = ["STAFF"] as const;

export const LEDGER_PERMISSIONS = [
    { key: "finance.accounts.view",    realm: "SCHOOL", module: "finance", scopes: ALL_SCOPE, personas: staffOnly, label: "View chart of accounts" },
    { key: "finance.accounts.manage",  realm: "SCHOOL", module: "finance", scopes: ALL_SCOPE, personas: staffOnly, label: "Manage chart of accounts" },
    { key: "finance.journals.view",    realm: "SCHOOL", module: "finance", scopes: ALL_SCOPE, personas: staffOnly, label: "View journals" },
    { key: "finance.journals.post",    realm: "SCHOOL", module: "finance", scopes: ALL_SCOPE, personas: staffOnly, label: "Post manual journals, opening balances and transfers", isSensitive: true },
    { key: "finance.journals.reverse", realm: "SCHOOL", module: "finance", scopes: ALL_SCOPE, personas: staffOnly, label: "Reverse journals", isSensitive: true },
    { key: "finance.periods.view",     realm: "SCHOOL", module: "finance", scopes: ALL_SCOPE, personas: staffOnly, label: "View accounting periods" },
    { key: "finance.reports.view",     realm: "SCHOOL", module: "finance", scopes: ALL_SCOPE, personas: staffOnly, label: "View finance reports" },
    { key: "finance.reports.export",   realm: "SCHOOL", module: "finance", scopes: ALL_SCOPE, personas: staffOnly, label: "Export finance reports" },
    { key: "finance.reports.accountant", realm: "SCHOOL", module: "finance", scopes: ALL_SCOPE, personas: staffOnly, label: "View accountant reports (ledger, trial balance, statements)" },
    { key: "finance.periods.close",    realm: "SCHOOL", module: "finance", scopes: ALL_SCOPE, personas: staffOnly, label: "Close accounting periods", isSensitive: true },
    { key: "finance.periods.reopen",   realm: "SCHOOL", module: "finance", scopes: ALL_SCOPE, personas: staffOnly, label: "Reopen accounting periods", isSensitive: true },
] as const;
