/*
| FEES PERMISSION KEYS (set-up part; brief section 10). fees.view already exists in the platform registry.
| fees.setup.view         see fee types, structures and discount rules (staff only)
| fees.types.manage       add and edit fee types, choose their income account
| fees.structures.manage  set what each class is charged per term
| fees.discounts.manage   create discount rules and give them to students (sensitive: it reduces what the school earns)
| Invoice, adjustment and payment keys arrive with their pieces.
*/
const ALL_SCOPE = ["ALL"] as const;
const staffOnly = ["STAFF"] as const;

export const FEES_PERMISSIONS = [
    { key: "fees.setup.view",         realm: "SCHOOL", module: "fees", scopes: ALL_SCOPE, personas: staffOnly, label: "View fee types, structures and discounts" },
    { key: "fees.types.manage",       realm: "SCHOOL", module: "fees", scopes: ALL_SCOPE, personas: staffOnly, label: "Manage fee types" },
    { key: "fees.structures.manage",  realm: "SCHOOL", module: "fees", scopes: ALL_SCOPE, personas: staffOnly, label: "Manage fee structures" },
    { key: "fees.discounts.manage",   realm: "SCHOOL", module: "fees", scopes: ALL_SCOPE, personas: staffOnly, label: "Manage discount rules and student discounts", isSensitive: true },
] as const;
