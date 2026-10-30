/*
|--------------------------------------------------------------------------
| FINANCE PHASE 5: payroll. Pay maths, components, pay profiles, the monthly run (draft to paid), payslips, loans, remittances,
| and the controls. Logic only, over the real posting service (see support/payroll-world.ts).
| THE ACCEPTANCE STORY (last block): a month runs end to end with approvals; the journals balance; payslip snapshots never change.
|--------------------------------------------------------------------------
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ZodError } from "zod";
import { payrollWorld, N, code } from "./support/payroll-world";
import { dayString } from "../../src/modules/ledger/domain/ledger.dates";
import { percentOf, bandedAmount, calculatePay } from "../../src/modules/payroll/domain/payroll-calc";
import { renderPayslipHtml, naira } from "../../src/modules/payroll/domain/payslip-document";
import { monthLabel, lastDayOfMonth } from "../../src/modules/payroll/domain/payroll.policy";
import { PAYROLL_PERMISSIONS } from "../../src/modules/payroll/payroll.permissions";
import { PERMISSION_REGISTRY, validatePermissionRegistry } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { REPORTS } from "../../src/modules/finance-reports/services/report-catalogue";
import { viewerOf } from "../../src/modules/payroll/controllers/payroll.controller";
import { CreateComponentDto, SetProfileDto, ApproveRunDto, RejectRunDto, CreateRemittanceDto } from "../../src/modules/payroll/dtos/payroll.dto";

const K = (naira: number) => Number(N(naira));          // the number the API would receive
const kb = (naira: number) => Number(N(naira));          // the number the API sends back
const own = (staffId: string) => ({ scope: "OWN", staffId }) as const;
const ALL = { scope: "ALL" } as const;

/* The school used by most tests:
|  Ada  basic 200,000  + Housing 30,000 + Transport 10% of basic (20,000)  (both taxable)  gross 250,000
|       - Pension 8% of basic (16,000) - PAYE (0% to 100k, 10% to 300k, 20% above) on 250,000 = 15,000   net 219,000   employer pension 10% = 20,000
|  Bola basic 100,000 - Union dues 1,000   net 99,000
|  Chi has no pay profile; "Gone Away" is no longer employed. */
async function school() {
    const w = payrollWorld();
    const c: Record<string, any> = {};
    c.housing = await w.component({ code: "HOUSING", name: "Housing", type: "EARNING", calcType: "FIXED", defaultValue: K(30_000), isTaxable: true });
    c.transport = await w.component({ code: "TRANSPORT", name: "Transport", type: "EARNING", calcType: "PERCENT_OF_BASIC", defaultValue: 1000, isTaxable: true });
    c.pension = await w.component({ code: "PENSION_EE", name: "Pension (staff)", type: "DEDUCTION", calcType: "PERCENT_OF_BASIC", defaultValue: 800, liabilityAccountId: "a-pension", isStatutory: true });
    c.paye = await w.component({
        code: "PAYE", name: "PAYE", type: "DEDUCTION", calcType: "BANDED", liabilityAccountId: "a-paye", isStatutory: true,
        bands: [{ upToKobo: K(100_000), rateBp: 0 }, { upToKobo: K(300_000), rateBp: 1000 }, { upToKobo: null, rateBp: 2000 }],
    });
    c.employer = await w.component({ code: "PENSION_ER", name: "Pension (employer)", type: "EMPLOYER_CONTRIBUTION", calcType: "PERCENT_OF_BASIC", defaultValue: 1000, liabilityAccountId: "a-pension" });
    c.union = await w.component({ code: "UNION", name: "Union dues", type: "DEDUCTION", calcType: "FIXED", defaultValue: K(1_000), liabilityAccountId: "a-union" });
    await w.profile("s1", 200_000, { components: [c.housing, c.transport, c.pension, c.paye, c.employer].map(x => ({ componentId: x.id })), bankName: "GTB", accountName: "Ada Obi", accountNumber: "0123456789" });
    await w.profile("s2", 100_000, { components: [{ componentId: c.union.id }] });
    return { w, c };
}
const slipOf = (run: any, staffId: string) => run.payslips.find((p: any) => p.staff.id === staffId);

describe("payroll: the pay maths", () => {
    const comp = (o: any) => ({ id: o.id ?? "c", name: o.name ?? "X", code: "X", type: o.type, calcType: o.calcType, defaultValue: o.v ?? 0n, bands: o.bands ?? null, isTaxable: o.taxable ?? false, isStatutory: false, expenseAccountId: null, liabilityAccountId: o.type === "EARNING" ? null : "liab", isActive: true, createdAt: new Date() });

    it("a percentage rounds half up to a whole kobo", () => {
        assert.equal(percentOf(1000n, 5n), 1n);        // 0.5 kobo
        assert.equal(percentOf(999n, 5n), 0n);         // 0.4995 kobo
        assert.equal(percentOf(1050n, 750n), 79n);     // 78.75
        assert.equal(percentOf(N(200_000), 800n), N(16_000));
    });

    it("bands tax each slice at its own rate", () => {
        const bands = [{ upToKobo: N(100_000), rateBp: 0 }, { upToKobo: N(300_000), rateBp: 1000 }, { upToKobo: null, rateBp: 2000 }];
        assert.equal(bandedAmount(N(50_000), bands), 0n);
        assert.equal(bandedAmount(N(250_000), bands), N(15_000));
        assert.equal(bandedAmount(N(400_000), bands), N(40_000));     // 0 + 200k at 10% + 100k at 20%
        assert.equal(bandedAmount(0n, bands), 0n);
    });

    it("works out gross, deductions, loans, employer cost and net, in a stable order", () => {
        const r = calculatePay(N(200_000), [
            { component: comp({ id: "e", type: "EARNING", calcType: "FIXED", v: N(30_000), taxable: true }), valueOverride: null },
            { component: comp({ id: "d", type: "DEDUCTION", calcType: "PERCENT_OF_GROSS", v: 500n }), valueOverride: null },
            { component: comp({ id: "er", type: "EMPLOYER_CONTRIBUTION", calcType: "PERCENT_OF_BASIC", v: 1000n }), valueOverride: null },
        ], [{ loanId: "l1", label: "Loan", amountKobo: N(5_000) }]);
        assert.equal(r.grossKobo, N(230_000));
        assert.equal(r.deductionsKobo, N(11_500));                 // 5% of gross
        assert.equal(r.loanRepaymentKobo, N(5_000));
        assert.equal(r.totalDeductionsKobo, N(16_500));
        assert.equal(r.employerContributionKobo, N(20_000));
        assert.equal(r.netKobo, N(213_500));
        assert.deepEqual(r.lines.map(l => l.kind + ":" + l.type), ["BASIC:EARNING", "COMPONENT:EARNING", "COMPONENT:DEDUCTION", "LOAN:DEDUCTION", "COMPONENT:EMPLOYER_CONTRIBUTION"]);
        assert.deepEqual(r.lines.map(l => l.sortOrder), [0, 1, 2, 3, 4]);
    });

    it("a per-person value replaces the component's default", () => {
        const pension = comp({ type: "DEDUCTION", calcType: "PERCENT_OF_BASIC", v: 800n });
        assert.equal(calculatePay(N(200_000), [{ component: pension, valueOverride: 1000n }], []).deductionsKobo, N(20_000));
        assert.equal(calculatePay(N(200_000), [{ component: pension, valueOverride: null }], []).deductionsKobo, N(16_000));
    });

    it("tax counts only taxable pay", () => {
        const paye = comp({ type: "DEDUCTION", calcType: "BANDED", bands: [{ upToKobo: null, rateBp: 1000 }] });
        const bonus = (taxable: boolean) => ({ component: comp({ id: "b", type: "EARNING", calcType: "FIXED", v: N(50_000), taxable }), valueOverride: null });
        assert.equal(calculatePay(N(100_000), [bonus(true), { component: paye, valueOverride: null }], []).deductionsKobo, N(15_000));
        assert.equal(calculatePay(N(100_000), [bonus(false), { component: paye, valueOverride: null }], []).deductionsKobo, N(10_000));
    });

    it("pay that would go below zero is reported as a negative net", () => {
        const r = calculatePay(N(10_000), [{ component: comp({ type: "DEDUCTION", calcType: "FIXED", v: N(20_000) }), valueOverride: null }], []);
        assert.equal(r.netKobo, -N(10_000));
    });

    it("formats naira from kobo without floating point", () => {
        assert.equal(naira("21900000"), "₦219,000.00");
        assert.equal(naira("5"), "₦0.05");
        assert.equal(naira("123456789012345678"), "₦1,234,567,890,123,456.78");
    });

    it("knows month ends and labels", () => {
        assert.equal(lastDayOfMonth(2026, 9), "2026-09-30");
        assert.equal(lastDayOfMonth(2028, 2), "2028-02-29");
        assert.equal(monthLabel(2026, 9), "September 2026");
    });
});

describe("payroll: pay components", () => {
    it("creates earnings, deductions and banded tax, and shows them back", async () => {
        const { c } = await school();
        assert.equal(c.housing.type, "EARNING");
        assert.equal(c.paye.calcType, "BANDED");
        assert.equal(c.paye.bands.length, 3);
    });

    it("refuses shapes that could not be posted", async () => {
        const w = payrollWorld();
        const bad = (over: any) => w.component({ code: "X1", name: "X", type: "DEDUCTION", calcType: "FIXED", defaultValue: 100, liabilityAccountId: "a-union", ...over });
        await assert.rejects(bad({ type: "EARNING", calcType: "PERCENT_OF_GROSS", liabilityAccountId: undefined }), code("COMPONENT_INVALID"));
        await assert.rejects(bad({ liabilityAccountId: undefined }), code("COMPONENT_INVALID"));             // a deduction must say who is owed
        await assert.rejects(bad({ type: "EARNING" }), code("COMPONENT_INVALID"));                           // an earning has no liability account
        await assert.rejects(bad({ expenseAccountId: "a-housing" }), code("COMPONENT_INVALID"));             // a deduction has no expense account
        await assert.rejects(bad({ calcType: "PERCENT_OF_BASIC", defaultValue: 20_000 }), code("COMPONENT_INVALID"));       // more than 100%
        await assert.rejects(bad({ calcType: "BANDED" }), code("COMPONENT_INVALID"));                         // no bands
        await assert.rejects(bad({ calcType: "BANDED", bands: [{ upToKobo: 500, rateBp: 100 }, { upToKobo: 400, rateBp: 200 }] }), code("COMPONENT_INVALID"));      // not rising
        await assert.rejects(bad({ calcType: "BANDED", bands: [{ upToKobo: null, rateBp: 100 }, { upToKobo: 400, rateBp: 200 }] }), code("COMPONENT_INVALID"));   // open band not last
        await assert.rejects(bad({ liabilityAccountId: "a-fuel" }), code("COMPONENT_INVALID"));              // not a liability account
        await assert.rejects(bad({ type: "EMPLOYER_CONTRIBUTION", expenseAccountId: "a-cash" }), code("COMPONENT_INVALID"));   // not an expense account
    });

    it("a code is used once, and codes are upper-cased", async () => {
        const w = payrollWorld();
        const first = await w.component({ code: "union", type: "DEDUCTION", calcType: "FIXED", defaultValue: 100, liabilityAccountId: "a-union" });
        assert.equal(first.code, "UNION");
        await assert.rejects(w.component({ code: "UNION", type: "DEDUCTION", calcType: "FIXED", defaultValue: 100, liabilityAccountId: "a-union" }), code("COMPONENT_CODE_TAKEN"));
    });

    it("type and calculation cannot be changed, but the value and accounts can", async () => {
        const { w, c } = await school();
        assert.throws(() => CreateComponentDto.parse({ code: "ZZ", name: "Z", type: "EARNING", calcType: "FIXED", defaultValue: 1, surprise: true }), ZodError);
        const updated = await w.updateComponent.execute(c.housing.id, "school-1", "admin-1", { defaultValue: BigInt(K(35_000)) } as any);
        assert.equal(updated.defaultValue, K(35_000));
        assert.equal(updated.type, "EARNING");
    });

    it("a component in use is deactivated, not deleted; an unused one can go", async () => {
        const { w, c } = await school();
        await assert.rejects(w.deleteComponent.execute(c.union.id, "school-1", "admin-1"), code("COMPONENT_IN_USE"));
        await w.setComponentActive.execute(c.union.id, "school-1", "admin-1", false);
        const spare = await w.component({ code: "SPARE", type: "EARNING", calcType: "FIXED", defaultValue: 100 });
        assert.deepEqual(await w.deleteComponent.execute(spare.id, "school-1", "admin-1"), { deleted: true });
    });
});

describe("payroll: pay profiles", () => {
    it("encrypts the account number and only ever shows the last four digits", async () => {
        const { w } = await school();
        const stored = [...w.profiles.values()].find(p => p.staffId === "s1");
        assert.equal(stored.accountNumberEncrypted, "enc:0123456789");
        const shown = await w.getProfile.execute("s1");
        assert.equal(shown.current!.bank.accountNumberLast4, "6789");
        assert.equal(shown.current!.bank.hasAccountNumber, true);
        assert.ok(!JSON.stringify(shown).includes("0123456789"));
    });

    it("keeps dated history: a new profile closes the old one the day before", async () => {
        const { w } = await school();
        await w.profile("s1", 300_000, { effectiveFrom: "2026-10-01" });
        const h = await w.getProfile.execute("s1");
        assert.equal(h.history.length, 2);
        assert.equal(h.history[1].effectiveTo, "2026-09-30");
        assert.equal(h.history[0].effectiveTo, null);
        assert.equal(h.current!.basicSalaryKobo, kb(300_000));          // today is 2026-10-20, so the October profile is the one in force
    });

    it("a new profile must start after the current one", async () => {
        const { w } = await school();
        await assert.rejects(w.profile("s1", 250_000, { effectiveFrom: "2026-01-01" }), code("PROFILE_DATE_INVALID"));
        await assert.rejects(w.profile("s1", 250_000, { effectiveFrom: "2025-12-01" }), code("PROFILE_DATE_INVALID"));
    });

    it("refuses a staff member who has left, an unknown or inactive component, a repeated component and a banded override", async () => {
        const { w, c } = await school();
        await assert.rejects(w.profile("s-off", 100_000), code("REFERENCE_NOT_FOUND"));
        await assert.rejects(w.profile("s3", 100_000, { components: [{ componentId: "nope" }] }), code("REFERENCE_NOT_FOUND"));
        await w.setComponentActive.execute(c.union.id, "school-1", "admin-1", false);
        await assert.rejects(w.profile("s3", 100_000, { components: [{ componentId: c.union.id }] }), code("COMPONENT_INACTIVE"));
        await assert.rejects(w.profile("s3", 100_000, { components: [{ componentId: c.housing.id }, { componentId: c.housing.id }] }), code("PROFILE_DATE_INVALID"));
        await assert.rejects(w.profile("s3", 100_000, { components: [{ componentId: c.paye.id, valueOverride: 5 }] }), code("OVERRIDE_NOT_ALLOWED"));
    });

    it("the request shape is strict: a bad account number and unknown fields are refused", () => {
        assert.throws(() => SetProfileDto.parse({ staffId: "s1", effectiveFrom: "2026-01-01", basicSalaryKobo: 100, accountNumber: "123" }), ZodError);
        assert.throws(() => SetProfileDto.parse({ staffId: "s1", effectiveFrom: "2026-01-01", basicSalaryKobo: 0 }), ZodError);
        assert.throws(() => SetProfileDto.parse({ staffId: "s1", effectiveFrom: "2026-01-01", basicSalaryKobo: 100, extra: 1 }), ZodError);
    });
});

describe("payroll: starting and calculating a run", () => {
    it("works out every staff member's pay, and lists staff who have no profile", async () => {
        const { w } = await school();
        const r = await w.newRun();
        assert.equal(r.status, "DRAFT");
        assert.match(r.runNumber, /^PR-2026-\d{6}$/);
        const { run, withoutProfile } = await w.calculate.execute(r.id, "school-1", "bursar-1");
        assert.equal(run.status, "CALCULATED");
        assert.equal(run.staffCount, 2);
        assert.equal(run.grossKobo, kb(350_000));
        assert.equal(run.deductionsKobo, kb(32_000));
        assert.equal(run.netKobo, kb(318_000));
        assert.equal(run.employerCostKobo, kb(370_000));
        const ada = slipOf(run, "s1"), bola = slipOf(run, "s2");
        assert.equal(ada.grossKobo, kb(250_000));
        assert.equal(ada.totalDeductionsKobo, kb(31_000));
        assert.equal(ada.netKobo, kb(219_000));
        assert.equal(ada.employerContributionKobo, kb(20_000));
        assert.equal(bola.netKobo, kb(99_000));
        assert.equal(ada.payslipNumber, null);                                  // numbered only when approved
        assert.deepEqual(withoutProfile, [{ id: "s3", name: "Chi Eze" }]);      // the one who left is not listed
        assert.equal(w.books.journals.length, 0);                                // calculating posts nothing
    });

    it("uses the profile in force on the last day of the month", async () => {
        const { w } = await school();
        await w.profile("s1", 400_000, { effectiveFrom: "2026-10-01", components: [] });
        const sept = await w.calculated();
        assert.equal(slipOf(sept, "s1").grossKobo, kb(250_000));                // September still uses the old pay
        const oct = await w.calculated({ periodMonth: 10, payDate: "2026-10-28" });
        assert.equal(slipOf(oct, "s1").grossKobo, kb(400_000));
    });

    it("leaves out a deactivated component, and recalculating replaces the draft payslips", async () => {
        const { w, c } = await school();
        const run = await w.calculated();
        assert.equal(slipOf(run, "s1").netKobo, kb(219_000));
        await w.setComponentActive.execute(c.pension.id, "school-1", "admin-1", false);
        await w.calculate.execute(run.id, "school-1", "bursar-1");
        const again = await w.getRun.execute(run.id);
        assert.equal(again.payslips.length, 2);
        assert.equal(slipOf(again, "s1").netKobo, kb(235_000));
    });

    it("one run per month, never for a month that has not started", async () => {
        const { w } = await school();
        const first = await w.newRun();
        await assert.rejects(w.newRun(), code("PAYROLL_RUN_EXISTS"));
        await assert.rejects(w.newRun({ periodMonth: 11, payDate: "2026-11-28" }), code("PAYROLL_PERIOD_IN_FUTURE"));
        await w.cancelRun(first.id);
        await w.newRun();                                                        // the month is free again once the run is cancelled
    });

    it("refuses to calculate when anyone's net would be negative, and saves nothing", async () => {
        const { w } = await school();
        const big = await w.component({ code: "BIG", type: "DEDUCTION", calcType: "FIXED", defaultValue: K(20_000), liabilityAccountId: "a-union" });
        await w.profile("s3", 10_000, { components: [{ componentId: big.id }] });
        const r = await w.newRun();
        await assert.rejects(w.calculate.execute(r.id, "school-1", "bursar-1"), code("PAYROLL_CALC_PROBLEMS"));
        const after = await w.getRun.execute(r.id);
        assert.equal(after.status, "DRAFT");
        assert.equal(after.payslips.length, 0);
    });

    it("needs at least one pay profile", async () => {
        const w = payrollWorld();
        const r = await w.newRun();
        await assert.rejects(w.calculate.execute(r.id, "school-1", "bursar-1"), code("PAY_PROFILE_MISSING"));
    });
});

describe("payroll: approval (maker and checker)", () => {
    it("cannot be sent for approval before it is calculated, nor twice", async () => {
        const { w } = await school();
        const r = await w.newRun();
        await assert.rejects(w.submit.execute(r.id, "school-1", "bursar-1"), code("PAYROLL_NOT_CALCULATED"));
        await w.calculate.execute(r.id, "school-1", "bursar-1");
        await w.submit.execute(r.id, "school-1", "bursar-1");
        await assert.rejects(w.submit.execute(r.id, "school-1", "bursar-1"), code("PAYROLL_RUN_STATE"));
        await assert.rejects(w.calculate.execute(r.id, "school-1", "bursar-1"), code("PAYROLL_RUN_STATE"));
    });

    it("the person who created the run cannot approve or reject it", async () => {
        const { w } = await school();
        const r = await w.pending();
        await assert.rejects(w.approveAs(r.id, "bursar-1"), code("SELF_APPROVAL_NOT_ALLOWED"));
        await assert.rejects(w.rejectAs(r.id, "No", "bursar-1"), code("SELF_APPROVAL_NOT_ALLOWED"));
        assert.equal((await w.getRun.execute(r.id)).status, "PENDING_APPROVAL");
        assert.equal(w.books.journals.length, 0);
    });

    it("approval posts one balanced accrual with the right accounts, dated the last day of the month", async () => {
        const { w } = await school();
        const run = await w.approved();
        assert.equal(run.status, "APPROVED");
        assert.equal(run.approvedById, "principal-1");
        assert.equal(w.books.journals.length, 1);
        const j = w.books.journals[0];
        assert.equal(j.sourceType, "PAYROLL_ACCRUAL");
        assert.equal(dayString(j.entryDate), "2026-09-30");
        assert.equal(run.accrualJournalId, j.id);
        assert.equal(w.balance("a-salaries"), N(350_000));          // basic and earnings of both
        assert.equal(w.balance("a-employer"), N(20_000));
        assert.equal(-w.balance("a-spay"), N(318_000));             // what they are owed
        assert.equal(-w.balance("a-paye"), N(15_000));
        assert.equal(-w.balance("a-pension"), N(36_000));            // 16,000 withheld + 20,000 employer
        assert.equal(-w.balance("a-union"), N(1_000));
        const owedLines = j.lines.filter((l: any) => l.accountId === "a-spay");
        assert.deepEqual(owedLines.map((l: any) => [l.partyType, l.partyId, l.creditKobo]).sort(), [["STAFF", "s1", N(219_000)], ["STAFF", "s2", N(99_000)]]);
        w.assertControl(assert);
    });

    it("numbers and freezes every payslip when approved", async () => {
        const { w } = await school();
        const run = await w.approved();
        assert.deepEqual(run.payslips.map((p: any) => [p.payslipNumber, p.status]), [["PSL-2026-000001", "FINAL"], ["PSL-2026-000002", "FINAL"]]);
        const slip = await w.getPayslip.execute(slipOf(run, "s1").id, ALL);
        assert.equal(slip.frozen, true);
        const snap = [...w.runs.values()][0].payslips[0].snapshot;
        assert.equal(snap.school.name, "Bright Future Academy");
        assert.equal(snap.staff.name, "Ada Obi");
        assert.equal(snap.period.label, "September 2026");
        assert.equal(snap.bank.last4, "6789");
        assert.equal(snap.netKobo, N(219_000).toString());
    });

    it("cannot be approved twice, and a rejected run goes back to be fixed with its reason kept", async () => {
        const { w } = await school();
        const r = await w.pending();
        const back = await w.rejectAs(r.id, "Check overtime");
        assert.equal(back.status, "CALCULATED");
        assert.equal(back.rejectionReason, "Check overtime");
        assert.equal(w.books.journals.length, 0);
        await w.calculate.execute(r.id, "school-1", "bursar-1");
        await w.submit.execute(r.id, "school-1", "bursar-1");
        const ok = await w.approveAs(r.id);
        assert.equal(ok.rejectionReason, null);
        await assert.rejects(w.approveAs(r.id), code("PAYROLL_RUN_STATE"));
        assert.equal(w.books.journals.length, 1);
    });

    it("a rejection needs a reason, and rejecting leaves no gap in payslip numbers", async () => {
        const { w } = await school();
        const r = await w.pending();
        await assert.rejects(w.reject.execute(r.id, "school-1", "principal-1", { reason: "   " }), code("REASON_REQUIRED"));
        assert.throws(() => RejectRunDto.parse({}), ZodError);
        await w.rejectAs(r.id);
        await w.calculate.execute(r.id, "school-1", "bursar-1");
        await w.submit.execute(r.id, "school-1", "bursar-1");
        const run = await w.approveAs(r.id);
        assert.equal(slipOf(run, "s1").payslipNumber, "PSL-2026-000001");
    });

    it("a run can be cancelled before approval, with a reason, and not after", async () => {
        const { w } = await school();
        const r = await w.calculated();
        await assert.rejects(w.cancel.execute(r.id, "school-1", "bursar-1", { reason: " " }), code("REASON_REQUIRED"));
        const gone = await w.cancelRun(r.id);
        assert.equal(gone.status, "CANCELLED");
        const p = await w.approved({ periodMonth: 10, payDate: "2026-10-28" });
        await assert.rejects(w.cancelRun(p.id), code("PAYROLL_RUN_STATE"));
    });

    it("the request shapes are strict", () => {
        assert.throws(() => ApproveRunDto.parse({ note: "ok", other: 1 }), ZodError);
    });
});

describe("payroll: paying a run", () => {
    it("records the payment: salaries payable is cleared and the money account is credited", async () => {
        const { w } = await school();
        const run = await w.paid();
        assert.equal(run.status, "PAID");
        assert.equal(w.balance("a-spay"), 0n);
        assert.equal(w.balance("a-bank"), -N(318_000));
        const j = w.books.journals.find((x: any) => x.sourceType === "PAYROLL_PAYMENT")!;
        assert.equal(run.paymentJournalId, j.id);
        assert.deepEqual(run.payslips.map((p: any) => p.status), ["PAID", "PAID"]);
        w.assertControl(assert);
    });

    it("only an approved run can be paid, and only once", async () => {
        const { w } = await school();
        const r = await w.pending();
        await assert.rejects(w.payRun(r.id), code("PAYROLL_NOT_APPROVED"));
        await w.approveAs(r.id);
        await w.payRun(r.id);
        await assert.rejects(w.payRun(r.id), code("PAYROLL_NOT_APPROVED"));
        assert.equal(w.books.journals.filter((j: any) => j.sourceType === "PAYROLL_PAYMENT").length, 1);
    });

    it("pays only from a real money account, and on a sensible date", async () => {
        const { w } = await school();
        const r = await w.approved();
        await assert.rejects(w.payRun(r.id, { accountId: "a-clearing" }), code("PAYMENT_ACCOUNT_INVALID"));
        await assert.rejects(w.payRun(r.id, { accountId: "a-fuel" }), code("PAYMENT_ACCOUNT_INVALID"));
        await assert.rejects(w.payRun(r.id, { accountId: "nope" }), code("PAYMENT_ACCOUNT_INVALID"));
        await assert.rejects(w.payRun(r.id, { paidOn: "2026-10-21" }), code("PAY_DATE_INVALID"));      // tomorrow
        await assert.rejects(w.payRun(r.id, { paidOn: "2026-08-31" }), code("PAY_DATE_INVALID"));      // before the month it pays
        assert.equal((await w.getRun.execute(r.id)).status, "APPROVED");
    });
});

describe("payroll: reversing an approved run", () => {
    it("undoes the accrual, voids the payslips and frees the month", async () => {
        const { w } = await school();
        const r = await w.approved();
        const reversed = await w.reverseRun(r.id);
        assert.equal(reversed.status, "CANCELLED");
        assert.deepEqual(reversed.payslips.map((p: any) => p.status), ["VOID", "VOID"]);
        for (const id of ["a-salaries", "a-employer", "a-spay", "a-paye", "a-pension", "a-union"]) assert.equal(w.balance(id), 0n, id);
        assert.equal(w.books.journals.length, 2);
        assert.equal(w.books.journals[0].status, "REVERSED");
        w.assertControl(assert);

        const again = await w.approved();                                         // the month can be run again
        assert.equal(slipOf(again, "s1").payslipNumber, "PSL-2026-000003");      // numbers keep counting; voided numbers are never reused
        w.assertControl(assert);
    });

    it("needs a reason, and a paid run cannot be reversed this way", async () => {
        const { w } = await school();
        const r = await w.approved();
        await assert.rejects(w.reverse.execute(r.id, "school-1", "principal-1", { reason: "" }), code("REASON_REQUIRED"));
        await w.payRun(r.id);
        await assert.rejects(w.reverseRun(r.id), code("PAYROLL_RUN_STATE"));
        const draft = await w.calculated({ periodMonth: 10, payDate: "2026-10-28" });
        await assert.rejects(w.reverseRun(draft.id), code("PAYROLL_RUN_STATE"));
    });
});

describe("payroll: staff loans", () => {
    it("lending pays the money out and records what is owed, by person", async () => {
        const { w } = await school();
        const loan = await w.lend("s1", 60_000, 40_000);
        assert.equal(loan.status, "ACTIVE");
        assert.equal(loan.balanceKobo, kb(60_000));
        assert.equal(w.balance("a-loans"), N(60_000));
        assert.equal(w.balance("a-bank"), -N(60_000));
        const j = w.books.journals[0];
        assert.equal(j.sourceType, "PAYROLL_PAYMENT");
        assert.deepEqual(j.lines.filter((l: any) => l.accountId === "a-loans").map((l: any) => [l.partyType, l.partyId]), [["STAFF", "s1"]]);
        w.assertControl(assert);
    });

    it("the same request id never lends twice", async () => {
        const { w } = await school();
        const a = await w.lend("s1", 60_000, 40_000, { requestId: "req-loan-1" });
        const b = await w.lend("s1", 60_000, 40_000, { requestId: "req-loan-1" });
        assert.equal(a.id, b.id);
        assert.equal(w.books.journals.length, 1);
        assert.equal(w.loans.size, 1);
    });

    it("refuses a repayment above the loan, a staff member who has left, and a non money account", async () => {
        const { w } = await school();
        await assert.rejects(w.lend("s1", 10_000, 20_000), code("LOAN_INVALID"));
        await assert.rejects(w.lend("s-off", 10_000, 1_000), code("REFERENCE_NOT_FOUND"));
        await assert.rejects(w.lend("s1", 10_000, 1_000, { accountId: "a-clearing" }), code("PAYMENT_ACCOUNT_INVALID"));
        await assert.rejects(w.lend("s1", 10_000, 1_000, { disbursedOn: "2026-10-30" }), code("LOAN_INVALID"));
        assert.equal(w.books.journals.length, 0);
    });

    it("is taken from pay on the payslip, never more than what is owed, and clears itself", async () => {
        const { w } = await school();
        const loan = await w.lend("s1", 60_000, 40_000);
        const sept = await w.approved();
        const ada = await w.getPayslip.execute(slipOf(sept, "s1").id, ALL);
        assert.equal(ada.netKobo, kb(179_000));                                       // 219,000 less the 40,000 instalment
        assert.equal(ada.totalDeductionsKobo, kb(71_000));
        assert.ok(ada.lines.some((l: any) => l.kind === "LOAN" && l.amountKobo === kb(40_000)));
        assert.equal(w.loans.get(loan.id).balanceKobo, N(20_000));
        assert.equal(w.balance("a-loans"), N(20_000));
        w.assertControl(assert);

        const oct = await w.approved({ periodMonth: 10, payDate: "2026-10-28" });     // only 20,000 is left to take
        assert.equal((await w.getPayslip.execute(slipOf(oct, "s1").id, ALL)).netKobo, kb(199_000));
        assert.equal(w.loans.get(loan.id).status, "CLEARED");
        assert.equal(w.balance("a-loans"), 0n);
        w.assertControl(assert);
    });

    it("reversing a run puts the repayment back", async () => {
        const { w } = await school();
        const loan = await w.lend("s1", 60_000, 40_000);
        const sept = await w.approved();
        await w.reverseRun(sept.id);
        assert.equal(w.loans.get(loan.id).balanceKobo, N(60_000));
        assert.equal(w.loans.get(loan.id).status, "ACTIVE");
        assert.equal(w.balance("a-loans"), N(60_000));
        w.assertControl(assert);
    });

    it("a loan with no repayments can be cancelled and the money comes back in the books; one with repayments cannot", async () => {
        const { w } = await school();
        const first = await w.lend("s1", 60_000, 40_000);
        const gone = await w.cancelLoanFor(first.id);
        assert.equal(gone.status, "CANCELLED");
        assert.equal(w.balance("a-loans"), 0n);
        assert.equal(w.balance("a-bank"), 0n);
        await assert.rejects(w.cancelLoanFor(first.id), code("LOAN_NOT_ACTIVE"));
        w.assertControl(assert);

        const second = await w.lend("s1", 60_000, 40_000, { requestId: "req-loan-2" });
        await w.approved();
        await assert.rejects(w.cancelLoanFor(second.id), code("LOAN_HAS_REPAYMENTS"));
    });

    it("a loan that changed after pay was calculated stops the approval", async () => {
        const { w } = await school();
        const loan = await w.lend("s1", 60_000, 40_000);
        const r = await w.pending();
        await w.cancelLoanFor(loan.id);
        const before = w.books.journals.length;
        await assert.rejects(w.approveAs(r.id), code("PAYROLL_STALE_LOAN"));
        assert.equal(w.books.journals.length, before);
        assert.equal((await w.getRun.execute(r.id)).status, "PENDING_APPROVAL");
    });
});

describe("payroll: remittances (paying withheld tax, pension and dues onward)", () => {
    it("lists what is still owed, account by account", async () => {
        const { w } = await school();
        await w.approved();
        assert.deepEqual((await w.due.execute()).map(r => [r.account.id, r.owedKobo]), [["a-paye", N(15_000).toString()], ["a-pension", N(36_000).toString()], ["a-union", N(1_000).toString()]]);
    });

    it("pays tax onward and clears what was owed", async () => {
        const { w } = await school();
        await w.approved();
        const m = await w.remit({ amountKobo: K(15_000) });
        assert.equal(m.amountKobo, kb(15_000));
        assert.equal(w.balance("a-paye"), 0n);
        assert.equal(w.balance("a-bank"), -N(15_000));
        assert.equal(w.books.journals.at(-1)!.sourceType, "PAYROLL_REMITTANCE");
        assert.deepEqual((await w.due.execute()).map(r => r.account.id), ["a-pension", "a-union"]);
    });

    it("never pays out more than is owed", async () => {
        const { w } = await school();
        await w.approved();
        await assert.rejects(w.remit({ amountKobo: K(15_001) }), code("REMITTANCE_ACCOUNT_INVALID"));
        await w.remit({ amountKobo: K(15_000) });
        await assert.rejects(w.remit({ amountKobo: 1, requestId: "another-one" }), code("REMITTANCE_ACCOUNT_INVALID"));
    });

    it("refuses accounts that are not what was withheld", async () => {
        const { w } = await school();
        await w.approved();
        await assert.rejects(w.remit({ liabilityAccountId: "a-spay", amountKobo: K(1_000) }), code("REMITTANCE_ACCOUNT_INVALID"));      // salaries are paid through the run
        await assert.rejects(w.remit({ liabilityAccountId: "a-fuel", amountKobo: K(1_000) }), code("REMITTANCE_ACCOUNT_INVALID"));
        await assert.rejects(w.remit({ liabilityAccountId: "nope", amountKobo: K(1_000) }), code("REMITTANCE_ACCOUNT_INVALID"));
        await assert.rejects(w.remit({ amountKobo: K(1_000), fromAccountId: "a-clearing" }), code("PAYMENT_ACCOUNT_INVALID"));
        assert.throws(() => CreateRemittanceDto.parse({ liabilityAccountId: "a", periodYear: 2026, periodMonth: 13, amountKobo: 1, fromAccountId: "b" }), ZodError);
    });

    it("the same request id never pays twice", async () => {
        const { w } = await school();
        await w.approved();
        const a = await w.remit({ amountKobo: K(5_000), requestId: "remit-req-1" });
        const b = await w.remit({ amountKobo: K(5_000), requestId: "remit-req-1" });
        assert.equal(a.id, b.id);
        assert.equal(w.balance("a-paye"), -N(10_000));
        assert.equal(w.books.journals.filter((j: any) => j.sourceType === "PAYROLL_REMITTANCE").length, 1);
    });

    it("a mistake is reversed, once, and the amount is owed again", async () => {
        const { w } = await school();
        await w.approved();
        const m = await w.remit({ amountKobo: K(15_000) });
        const rev = await w.reverseRemit(m.id);
        assert.equal(rev.reversed, true);
        assert.equal(w.balance("a-paye"), -N(15_000));
        await assert.rejects(w.reverseRemit(m.id), code("REMITTANCE_ALREADY_REVERSED"));
        await assert.rejects(w.reverseRemittance.execute("nope", "school-1", "x", { reason: "r" }), code("NOT_FOUND"));
        w.assertControl(assert);
    });
});

describe("payroll: payslips, who sees what, and the document", () => {
    it("a staff member sees only their own finished payslips", async () => {
        const { w } = await school();
        const draft = await w.calculated();
        assert.equal((await w.listPayslips.execute({ page: 1, limit: 20 } as any, own("s1"))).data.length, 0);          // drafts are hidden
        assert.equal((await w.listPayslips.execute({ page: 1, limit: 20 } as any, ALL)).data.length, 2);               // the office sees them
        await assert.rejects(w.getPayslip.execute(slipOf(draft, "s1").id, own("s1")), code("NOT_FOUND"));

        await w.submit.execute(draft.id, "school-1", "bursar-1");
        const run = await w.approveAs(draft.id);
        const mine = await w.listPayslips.execute({ page: 1, limit: 20 } as any, own("s1"));
        assert.deepEqual(mine.data.map((p: any) => p.staff.id), ["s1"]);
        assert.equal((await w.getPayslip.execute(slipOf(run, "s1").id, own("s1"))).netKobo, kb(219_000));
        await assert.rejects(w.getPayslip.execute(slipOf(run, "s2").id, own("s1")), code("NOT_FOUND"));                  // someone else's: not even acknowledged
        await assert.rejects(w.document.execute(slipOf(run, "s2").id, own("s1")), code("NOT_FOUND"));
        await assert.rejects(w.getPayslip.execute("nope", ALL), code("NOT_FOUND"));
    });

    it("voided payslips disappear for the staff member but stay visible to the office", async () => {
        const { w } = await school();
        const run = await w.approved();
        await w.reverseRun(run.id);
        assert.equal((await w.listPayslips.execute({ page: 1, limit: 20 } as any, own("s1"))).data.length, 0);
        assert.equal((await w.listPayslips.execute({ page: 1, limit: 20 } as any, ALL)).data.length, 2);
    });

    it("the printable payslip is drawn from the snapshot, shows only the last four digits, and escapes names", async () => {
        const { w, c } = await school();
        w.staff.get("s3")!.name = "<b>Chi</b> & Co";
        const big = await w.profile("s3", 50_000, { components: [{ componentId: c.union.id }] });
        assert.ok(big);
        const run = await w.approved();
        const doc = await w.document.execute(slipOf(run, "s1").id, own("s1"));
        assert.equal(doc.filename, "PSL-2026-000001.html");
        assert.ok(doc.html.includes("Ada Obi") && doc.html.includes("₦219,000.00") && doc.html.includes("****6789") && doc.html.includes("September 2026"));
        assert.ok(!doc.html.includes("0123456789"));
        const chi = await w.document.execute(slipOf(run, "s3").id, ALL);
        assert.ok(chi.html.includes("&lt;b&gt;Chi&lt;/b&gt; &amp; Co"));
        assert.ok(!chi.html.includes("<b>Chi"));
    });

    it("a payslip that is not approved has no document", async () => {
        const { w } = await school();
        const run = await w.calculated();
        await assert.rejects(w.document.execute(slipOf(run, "s1").id, ALL), code("NOT_FOUND"));
    });

    it("renders every line, the loan and the employer's part", () => {
        const html = renderPayslipHtml({
            payslipNumber: "PSL-1", school: { name: "S", address: null, logoUrl: null }, staff: { id: "s", name: "N", employeeId: null, designation: null, department: null },
            period: { year: 2026, month: 9, label: "September 2026" }, payDate: "2026-09-28", bank: { bankName: null, accountName: null, last4: null },
            lines: [
                { label: "Basic salary", type: "EARNING", kind: "BASIC", amountKobo: "10000000" }, { label: "Tax", type: "DEDUCTION", kind: "COMPONENT", amountKobo: "100000" },
                { label: "Loan repayment", type: "DEDUCTION", kind: "LOAN", amountKobo: "200000" }, { label: "Pension (employer)", type: "EMPLOYER_CONTRIBUTION", kind: "COMPONENT", amountKobo: "50000" },
            ],
            grossKobo: "10000000", totalDeductionsKobo: "300000", netKobo: "9700000", employerContributionKobo: "50000",
        });
        for (const s of ["Basic salary", "₦100,000.00", "Tax", "Loan repayment", "Total deductions", "₦97,000.00", "Pension (employer)"]) assert.ok(html.includes(s), s);
    });
});

describe("payroll: reports, summary and who may do what", () => {
    it("summarises approved and paid runs of a year, not drafts or cancelled runs", async () => {
        const { w } = await school();
        await w.calculated({ periodMonth: 7, payDate: "2026-07-28" });                       // a draft: left out
        const sept = await w.paid();
        const cancelled = await w.approved({ periodMonth: 10, payDate: "2026-10-28" });
        await w.reverseRun(cancelled.id);
        const s = await w.summary.execute(2026);
        assert.equal(s.rows.length, 1);
        assert.equal(s.rows[0].run, sept.runNumber);
        assert.equal(s.rows[0].period, "September 2026");
        assert.equal(s.total.gross, N(350_000));
        assert.equal(s.total.net, N(318_000));
        assert.equal(s.total.employerCost, N(370_000));
        assert.equal((await w.summary.execute()).year, 2026);
    });

    it("the payroll summary is in the report catalogue behind its own permission and plan feature", () => {
        const r = REPORTS.find(x => x.key === "payroll-summary")!;
        assert.equal(r.permission, "payroll.runs.view");
        assert.equal(r.feature, "modules.payroll");
        assert.ok(r.params.parse({ year: "2026" }));
        assert.throws(() => r.params.parse({ nonsense: 1 }), ZodError);
    });

    it("has nine payroll keys; approving, paying and managing profiles are sensitive; payslips can be ALL or OWN", () => {
        assert.equal(PAYROLL_PERMISSIONS.length, 9);
        assert.deepEqual(validatePermissionRegistry(), []);
        const reg = PERMISSION_REGISTRY.filter(p => p.module === "payroll");
        assert.equal(reg.length, 9);
        assert.deepEqual(reg.filter(p => p.isSensitive).map(p => p.key).sort(), ["payroll.profiles.manage", "payroll.runs.approve", "payroll.runs.pay"]);
        assert.deepEqual([...reg.find(p => p.key === "payroll.payslips.view")!.scopes].sort(), ["ALL", "OWN"]);
    });

    it("every role-template grant exists; staff roles read their own payslips; maker and checker are different roles", () => {
        const known = new Set(PERMISSION_REGISTRY.map(p => p.key));
        for (const r of ROLE_TEMPLATES) for (const p of r.permissions) assert.ok(known.has(p.key), `${r.key} grants unknown key ${p.key}`);
        const grants = (role: string) => ROLE_TEMPLATES.find(r => r.key === role)!.permissions;
        for (const role of ["teacher", "bursar", "principal"]) assert.deepEqual(grants(role).find(p => p.key === "payroll.payslips.view"), { key: "payroll.payslips.view", scope: "OWN" }, role);
        const keys = (role: string) => grants(role).map(p => p.key);
        assert.ok(keys("bursar").includes("payroll.runs.create") && !keys("bursar").includes("payroll.runs.approve") && !keys("bursar").includes("payroll.runs.pay"));
        assert.ok(keys("principal").includes("payroll.runs.approve") && !keys("principal").includes("payroll.runs.create"));
        for (const role of ["student", "guardian"]) assert.ok(!keys(role).some(k => k.startsWith("payroll.")));
    });

    it("decides the payslip viewer from the session: ALL sees all, others only themselves, and only staff can have 'own'", () => {
        const req = (scope: any, persona: any, personaEntityId: any) => ({ access: { scopeOf: () => scope, persona, personaEntityId } }) as any;
        assert.deepEqual(viewerOf(req("ALL", "STAFF", "s1")), { scope: "ALL" });
        assert.deepEqual(viewerOf(req("ALL", "STAFF", "s1"), true), { scope: "OWN", staffId: "s1" });         // /my/payslips is always your own
        assert.deepEqual(viewerOf(req("OWN", "STAFF", "s2")), { scope: "OWN", staffId: "s2" });
        assert.throws(() => viewerOf(req("OWN", "GUARDIAN", "g1")), code("PERMISSION_DENIED"));
        assert.throws(() => viewerOf(req("OWN", "STAFF", null)), code("PERMISSION_DENIED"));
        assert.throws(() => viewerOf(req(null, "STAFF", "s1")), code("PERMISSION_DENIED"));
        assert.throws(() => viewerOf({} as any), code("PERMISSION_DENIED"));
    });
});

describe("payroll: ACCEPTANCE. A month runs end to end with approvals; journals balance; payslip snapshots never change", () => {
    it("runs September from components to remittance, with the books balancing at every step", async () => {
        const { w, c } = await school();
        await w.lend("s1", 60_000, 40_000);
        w.assertControl(assert);

        // the bursar prepares, the principal approves
        const run = await w.newRun();
        await w.calculate.execute(run.id, "school-1", "bursar-1");
        await w.submit.execute(run.id, "school-1", "bursar-1");
        await assert.rejects(w.approveAs(run.id, "bursar-1"), code("SELF_APPROVAL_NOT_ALLOWED"));
        const approved = await w.approveAs(run.id, "principal-1");
        w.assertControl(assert);

        // freeze: everything that could change afterwards, changes
        const freeze = () => JSON.stringify([...w.runs.values()].flatMap(r => r.payslips).map((p: any) => [p.payslipNumber, p.snapshot, p.lines.map((l: any) => [l.label, l.amountKobo])]), (_k, v) => typeof v === "bigint" ? v.toString() : v);
        const before = freeze();
        const adaBefore = await w.getPayslip.execute(slipOf(approved, "s1").id, ALL);
        const docBefore = (await w.document.execute(slipOf(approved, "s1").id, ALL)).html;
        await w.updateComponent.execute(c.housing.id, "school-1", "admin-1", { defaultValue: BigInt(K(99_000)) } as any);
        await w.setComponentActive.execute(c.pension.id, "school-1", "admin-1", false);
        await w.profile("s1", 900_000, { effectiveFrom: "2026-10-01" });
        w.staff.get("s1")!.name = "Ada Renamed";

        // pay, then hand the withheld money on
        await w.payRun(run.id);
        await w.remit({ liabilityAccountId: "a-paye", amountKobo: K(15_000) });
        await w.remit({ liabilityAccountId: "a-pension", amountKobo: K(36_000) });
        await w.remit({ liabilityAccountId: "a-union", amountKobo: K(1_000) });

        // the payslips are exactly as they were approved
        assert.equal(freeze(), before);
        const adaAfter = await w.getPayslip.execute(slipOf(approved, "s1").id, ALL);
        assert.deepEqual({ ...adaAfter, status: null, paidAt: null, paymentReference: null }, { ...adaBefore, status: null, paidAt: null, paymentReference: null });
        assert.equal((await w.document.execute(slipOf(approved, "s1").id, ALL)).html, docBefore);
        assert.ok(docBefore.includes("Ada Obi") && !docBefore.includes("Ada Renamed"));
        await assert.rejects(w.d.payrollRunRepository.finalizePayslip(slipOf(approved, "s1").id, "PSL-X", {}), /frozen/);

        // everything owed is settled, nothing is left hanging
        assert.equal(w.balance("a-spay"), 0n);
        for (const id of ["a-paye", "a-pension", "a-union"]) assert.equal(w.balance(id), 0n, id);
        assert.deepEqual(await w.due.execute(), []);
        assert.equal(w.balance("a-loans"), N(20_000));                          // 60,000 lent, 40,000 taken from September pay
        w.assertControl(assert);

        // every journal balances on its own, not only in total
        for (const j of w.books.journals) {
            assert.equal(j.lines.reduce((s: bigint, l: any) => s + l.debitKobo, 0n), j.lines.reduce((s: bigint, l: any) => s + l.creditKobo, 0n), j.number);
        }
        assert.ok(w.audit.some((a: any) => a.action === "payroll.run.approved") && w.audit.some((a: any) => a.action === "payroll.run.paid"));
        assert.ok(!JSON.stringify(w.audit, (_k, v) => typeof v === "bigint" ? v.toString() : v).includes("0123456789"));     // the account number never reaches the audit trail
    });
});
