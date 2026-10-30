import { PayslipSnapshot } from "./payroll.entity";

const esc = (s: string | null | undefined): string =>
    (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/* 123456 kobo -> "₦1,234.56" (string maths, so no rounding and no floating point) */
export function naira(kobo: string): string {
    const neg = kobo.startsWith("-");
    const digits = (neg ? kobo.slice(1) : kobo).padStart(3, "0");
    const whole = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ","), cents = digits.slice(-2);
    return `${neg ? "-" : ""}₦${whole}.${cents}`;
}

/*
| The payslip as a single self-contained HTML page (print it or save it as PDF from the browser). It is drawn only from the frozen snapshot,
| so it can never differ from what was approved. Everything that came from a person is escaped.
*/
export function renderPayslipHtml(s: PayslipSnapshot): string {
    const rows = (type: string) => s.lines.filter(l => l.type === type && l.kind !== "LOAN")
        .map(l => `<tr><td>${esc(l.label)}</td><td class="n">${naira(l.amountKobo)}</td></tr>`).join("");
    const loans = s.lines.filter(l => l.kind === "LOAN").map(l => `<tr><td>${esc(l.label)}</td><td class="n">${naira(l.amountKobo)}</td></tr>`).join("");
    const employer = s.lines.filter(l => l.type === "EMPLOYER_CONTRIBUTION");
    const bank = s.bank.last4 ? `${esc(s.bank.bankName)} · ${esc(s.bank.accountName)} · ****${esc(s.bank.last4)}` : "";
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payslip ${esc(s.payslipNumber)}</title>
<style>body{font-family:system-ui,Arial,sans-serif;color:#1a1a1a;max-width:720px;margin:24px auto;padding:0 16px}h1{font-size:20px;margin:0}
.head{display:flex;justify-content:space-between;border-bottom:2px solid #1a1a1a;padding-bottom:12px;margin-bottom:16px}.muted{color:#666;font-size:13px}
table{width:100%;border-collapse:collapse;margin:8px 0 16px}td,th{padding:6px 4px;border-bottom:1px solid #e5e5e5;text-align:left}.n{text-align:right;font-variant-numeric:tabular-nums}
.total td{font-weight:700;border-top:2px solid #1a1a1a}.net{font-size:18px}@media print{body{margin:0}}</style></head><body>
<div class="head"><div>${s.school.logoUrl ? `<img src="${esc(s.school.logoUrl)}" alt="" height="48"><br>` : ""}<h1>${esc(s.school.name)}</h1><div class="muted">${esc(s.school.address)}</div></div>
<div class="n"><strong>PAYSLIP</strong><div class="muted">${esc(s.payslipNumber)}<br>${esc(s.period.label)}<br>Paid ${esc(s.payDate)}</div></div></div>
<div><strong>${esc(s.staff.name)}</strong><div class="muted">${[s.staff.employeeId, s.staff.designation, s.staff.department].filter(Boolean).map(esc).join(" · ")}</div>${bank ? `<div class="muted">${bank}</div>` : ""}</div>
<h3>Earnings</h3><table>${rows("EARNING")}<tr class="total"><td>Gross pay</td><td class="n">${naira(s.grossKobo)}</td></tr></table>
<h3>Deductions</h3><table>${rows("DEDUCTION")}${loans}<tr class="total"><td>Total deductions</td><td class="n">${naira(s.totalDeductionsKobo)}</td></tr></table>
<table><tr class="total net"><td>Net pay</td><td class="n">${naira(s.netKobo)}</td></tr></table>
${employer.length ? `<p class="muted">Employer contributions (not deducted from you): ${employer.map(l => `${esc(l.label)} ${naira(l.amountKobo)}`).join(", ")}</p>` : ""}
</body></html>`;
}
