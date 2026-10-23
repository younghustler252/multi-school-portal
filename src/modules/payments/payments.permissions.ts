/*
| PAYMENT PERMISSION KEYS (brief section 10).
| payments.view      see payments, allocations and receipts (staff; families see their own through OWN later)
| payments.record    record money received (cash, POS, bank transfer, cheque) and preview how it would be applied
| payments.confirm   confirm or reject a payment that is waiting for a second person (bank transfers, cheques)
| payments.refund.request  ask for a refund of a student's credit
| payments.refund.approve  approve, reject and pay a refund (sensitive; never the person who asked)
| payments.reverse         reverse a confirmed payment (sensitive)
*/
const ALL_SCOPE = ["ALL"] as const;
const staffOnly = ["STAFF"] as const;

export const PAYMENTS_PERMISSIONS = [
    { key: "payments.view",    realm: "SCHOOL", module: "payments", scopes: ALL_SCOPE, personas: staffOnly, label: "View payments and receipts" },
    { key: "payments.record",  realm: "SCHOOL", module: "payments", scopes: ALL_SCOPE, personas: staffOnly, label: "Record payments" },
    { key: "payments.confirm", realm: "SCHOOL", module: "payments", scopes: ALL_SCOPE, personas: staffOnly, label: "Confirm or reject payments" },
    { key: "payments.refund.request", realm: "SCHOOL", module: "payments", scopes: ALL_SCOPE, personas: staffOnly, label: "Request refunds" },
    { key: "payments.refund.approve", realm: "SCHOOL", module: "payments", scopes: ALL_SCOPE, personas: staffOnly, label: "Approve and pay refunds", isSensitive: true },
    { key: "payments.reverse", realm: "SCHOOL", module: "payments", scopes: ALL_SCOPE, personas: staffOnly, label: "Reverse payments", isSensitive: true },
] as const;
