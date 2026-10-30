/*
| EXPENSE PERMISSION KEYS (brief section 10).
| expenses.view      see expenses, bills, vendors and their payments
| expenses.create    request an expense or bill (draft, edit, submit) and delete own drafts
| expenses.approve   approve or reject a submitted expense (sensitive; never the person who asked)
| expenses.pay       pay an approved bill, in full or in parts
| expenses.void      void an approved expense, or reverse a payment (sensitive)
| vendors.manage     add and edit suppliers (their bank details are encrypted)
| budgets.view       see budgets and how spending compares to them
| budgets.manage     create and change budgets
| Reports use finance.reports.view (a books key that already exists).
*/
const ALL_SCOPE = ["ALL"] as const;
const staffOnly = ["STAFF"] as const;

export const EXPENSES_PERMISSIONS = [
    { key: "expenses.view",    realm: "SCHOOL", module: "expenses", scopes: ALL_SCOPE, personas: staffOnly, label: "View expenses and bills" },
    { key: "expenses.create",  realm: "SCHOOL", module: "expenses", scopes: ALL_SCOPE, personas: staffOnly, label: "Request expenses and bills" },
    { key: "expenses.approve", realm: "SCHOOL", module: "expenses", scopes: ALL_SCOPE, personas: staffOnly, label: "Approve or reject expenses", isSensitive: true },
    { key: "expenses.pay",     realm: "SCHOOL", module: "expenses", scopes: ALL_SCOPE, personas: staffOnly, label: "Pay bills" },
    { key: "expenses.void",    realm: "SCHOOL", module: "expenses", scopes: ALL_SCOPE, personas: staffOnly, label: "Void expenses and reverse payments", isSensitive: true },
    { key: "vendors.manage",   realm: "SCHOOL", module: "expenses", scopes: ALL_SCOPE, personas: staffOnly, label: "Manage vendors" },
    { key: "budgets.view",     realm: "SCHOOL", module: "expenses", scopes: ALL_SCOPE, personas: staffOnly, label: "View budgets" },
    { key: "budgets.manage",   realm: "SCHOOL", module: "expenses", scopes: ALL_SCOPE, personas: staffOnly, label: "Manage budgets" },
] as const;
