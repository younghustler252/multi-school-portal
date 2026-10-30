/*
| SALARY TRANSFER PERMISSION KEYS (phase 6). Seeing transfers uses payroll.runs.view.
| payroll.transfers.send       start, send, retry and cancel salary transfers (sensitive; not the person who approved the run, unless the school allows self approval)
| payroll.transfers.reconcile  ask the provider what happened to transfers that are in flight or unknown (sensitive)
*/
const ALL_SCOPE = ["ALL"] as const;
const staffOnly = ["STAFF"] as const;

export const PAYROLL_TRANSFER_PERMISSIONS = [
    { key: "payroll.transfers.send",      realm: "SCHOOL", module: "payroll_transfers", scopes: ALL_SCOPE, personas: staffOnly, label: "Send salaries by bank transfer", isSensitive: true },
    { key: "payroll.transfers.reconcile", realm: "SCHOOL", module: "payroll_transfers", scopes: ALL_SCOPE, personas: staffOnly, label: "Check and reconcile salary transfers", isSensitive: true },
] as const;
