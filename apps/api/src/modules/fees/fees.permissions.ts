/*
| FEES PERMISSION KEYS (set-up part; brief section 10). fees.view already exists in the platform registry.
| fees.setup.view         see fee types, structures and discount rules (staff only)
| fees.types.manage       add and edit fee types, choose their income account
| fees.structures.manage  set what each class is charged per term
| fees.discounts.manage   create discount rules and give them to students (sensitive: it reduces what the school earns)
| fees.invoices.view      see invoices (staff; families see their own through fees.view later)
| fees.invoices.create    generate, make, edit and delete DRAFT invoices
| fees.invoices.issue     issue invoices (numbers them and posts them to the books)
| fees.invoices.void      void an issued invoice (sensitive)
| fees.adjustments.request  ask for a waiver, write-off, credit note or extra discount on an issued invoice
| fees.adjustments.approve  approve or reject one (sensitive; never the person who asked)
| fees.reports.view         ageing, defaulters, collections (staff)
| fees.view                 (platform key) a family sees their own children's invoices and statements
*/
const ALL_SCOPE = ["ALL"] as const;
const staffOnly = ["STAFF"] as const;

export const FEES_PERMISSIONS = [
    { key: "fees.setup.view",         realm: "SCHOOL", module: "fees", scopes: ALL_SCOPE, personas: staffOnly, label: "View fee types, structures and discounts" },
    { key: "fees.types.manage",       realm: "SCHOOL", module: "fees", scopes: ALL_SCOPE, personas: staffOnly, label: "Manage fee types" },
    { key: "fees.structures.manage",  realm: "SCHOOL", module: "fees", scopes: ALL_SCOPE, personas: staffOnly, label: "Manage fee structures" },
    { key: "fees.discounts.manage",   realm: "SCHOOL", module: "fees", scopes: ALL_SCOPE, personas: staffOnly, label: "Manage discount rules and student discounts", isSensitive: true },
    { key: "fees.invoices.view",       realm: "SCHOOL", module: "fees", scopes: ALL_SCOPE, personas: staffOnly, label: "View invoices" },
    { key: "fees.invoices.create",     realm: "SCHOOL", module: "fees", scopes: ALL_SCOPE, personas: staffOnly, label: "Generate and edit draft invoices" },
    { key: "fees.invoices.issue",      realm: "SCHOOL", module: "fees", scopes: ALL_SCOPE, personas: staffOnly, label: "Issue invoices" },
    { key: "fees.invoices.void",       realm: "SCHOOL", module: "fees", scopes: ALL_SCOPE, personas: staffOnly, label: "Void invoices", isSensitive: true },
    { key: "fees.adjustments.request", realm: "SCHOOL", module: "fees", scopes: ALL_SCOPE, personas: staffOnly, label: "Request invoice adjustments" },
    { key: "fees.adjustments.approve", realm: "SCHOOL", module: "fees", scopes: ALL_SCOPE, personas: staffOnly, label: "Approve invoice adjustments", isSensitive: true },
    { key: "fees.reports.view",      realm: "SCHOOL", module: "fees", scopes: ALL_SCOPE, personas: staffOnly, label: "View fee reports" },
] as const;
