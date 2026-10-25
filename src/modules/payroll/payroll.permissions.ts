/*
| PAYROLL PERMISSION KEYS (brief section 10).
| payroll.profiles.manage     set and see staff pay (basic salary, bank details, components) (sensitive)
| payroll.components.manage   add and edit pay components (allowances, tax, pension...)
| payroll.runs.view           see runs, payslips of everyone, components and the payroll summary
| payroll.runs.create         start a month's run, calculate it, send it for approval, cancel it
| payroll.runs.approve        approve or reject a run, or reverse an approved one (sensitive; never the person who created it)
| payroll.runs.pay            record that an approved run was paid (sensitive)
| payroll.payslips.view       ALL: any payslip. OWN: only the staff member's own, from /my/payslips
| payroll.loans.manage        lend to staff and cancel loans
| payroll.remittances.manage  pay withheld tax, pension and dues onward, and reverse a mistake
*/
const ALL_SCOPE = ["ALL"] as const;
const staffOnly = ["STAFF"] as const;

export const PAYROLL_PERMISSIONS = [
    { key: "payroll.profiles.manage",    realm: "SCHOOL", module: "payroll", scopes: ALL_SCOPE, personas: staffOnly, label: "Manage staff pay profiles", isSensitive: true },
    { key: "payroll.components.manage",  realm: "SCHOOL", module: "payroll", scopes: ALL_SCOPE, personas: staffOnly, label: "Manage pay components" },
    { key: "payroll.runs.view",          realm: "SCHOOL", module: "payroll", scopes: ALL_SCOPE, personas: staffOnly, label: "View payroll runs and payslips" },
    { key: "payroll.runs.create",        realm: "SCHOOL", module: "payroll", scopes: ALL_SCOPE, personas: staffOnly, label: "Prepare payroll runs" },
    { key: "payroll.runs.approve",       realm: "SCHOOL", module: "payroll", scopes: ALL_SCOPE, personas: staffOnly, label: "Approve or reject payroll runs", isSensitive: true },
    { key: "payroll.runs.pay",           realm: "SCHOOL", module: "payroll", scopes: ALL_SCOPE, personas: staffOnly, label: "Pay approved payroll runs", isSensitive: true },
    { key: "payroll.payslips.view",      realm: "SCHOOL", module: "payroll", scopes: ["ALL", "OWN"] as const, personas: staffOnly, label: "View payslips" },
    { key: "payroll.loans.manage",       realm: "SCHOOL", module: "payroll", scopes: ALL_SCOPE, personas: staffOnly, label: "Manage staff loans" },
    { key: "payroll.remittances.manage", realm: "SCHOOL", module: "payroll", scopes: ALL_SCOPE, personas: staffOnly, label: "Remit tax, pension and dues" },
] as const;
