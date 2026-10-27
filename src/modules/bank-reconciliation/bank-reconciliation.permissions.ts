/*
| BANK RECONCILIATION PERMISSION KEYS (phase 6)
| finance.bank_reconciliation.view      see imported statements, bank lines, suggested matches and the reconciliation summary
| finance.bank_reconciliation.import    upload a bank statement, or delete one that was imported by mistake
| finance.bank_reconciliation.match     pair bank lines with book entries (by hand or automatically) and undo a pairing
| finance.bank_reconciliation.post      record what the bank did that the books missed (charges, interest) as a journal,
|                                       and mark opening items as cleared (sensitive: both change the books or hide a difference)
| finance.bank_reconciliation.complete  sign off a month's reconciliation, or reopen it (sensitive)
*/
const ALL_SCOPE = ["ALL"] as const;
const staffOnly = ["STAFF"] as const;

export const BANK_RECONCILIATION_PERMISSIONS = [
    { key: "finance.bank_reconciliation.view",     realm: "SCHOOL", module: "bank_reconciliation", scopes: ALL_SCOPE, personas: staffOnly, label: "View bank reconciliation" },
    { key: "finance.bank_reconciliation.import",   realm: "SCHOOL", module: "bank_reconciliation", scopes: ALL_SCOPE, personas: staffOnly, label: "Import bank statements" },
    { key: "finance.bank_reconciliation.match",    realm: "SCHOOL", module: "bank_reconciliation", scopes: ALL_SCOPE, personas: staffOnly, label: "Match bank lines to book entries" },
    { key: "finance.bank_reconciliation.post",     realm: "SCHOOL", module: "bank_reconciliation", scopes: ALL_SCOPE, personas: staffOnly, label: "Record bank charges and clear opening items", isSensitive: true },
    { key: "finance.bank_reconciliation.complete", realm: "SCHOOL", module: "bank_reconciliation", scopes: ALL_SCOPE, personas: staffOnly, label: "Complete or reopen a bank reconciliation", isSensitive: true },
] as const;
