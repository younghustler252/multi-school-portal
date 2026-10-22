/*
| PAYMENT PERMISSION KEYS (brief section 10).
| payments.view      see payments, allocations and receipts (staff; families see their own through OWN later)
| payments.record    record money received (cash, POS, bank transfer, cheque) and preview how it would be applied
| payments.confirm   confirm or reject a payment that is waiting for a second person (bank transfers, cheques)
| Refund and reversal keys arrive with their pieces.
*/
const ALL_SCOPE = ["ALL"] as const;
const staffOnly = ["STAFF"] as const;

export const PAYMENTS_PERMISSIONS = [
    { key: "payments.view",    realm: "SCHOOL", module: "payments", scopes: ALL_SCOPE, personas: staffOnly, label: "View payments and receipts" },
    { key: "payments.record",  realm: "SCHOOL", module: "payments", scopes: ALL_SCOPE, personas: staffOnly, label: "Record payments" },
    { key: "payments.confirm", realm: "SCHOOL", module: "payments", scopes: ALL_SCOPE, personas: staffOnly, label: "Confirm or reject payments" },
] as const;
