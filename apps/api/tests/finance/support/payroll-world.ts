/*
| An in-memory payroll world over the REAL posting service (on the expenses world's books): components, pay profiles, runs, payslips, loans and
| remittances are small fakes that obey the same rules the database does (versions, state moves, one frozen snapshot per payslip).
*/
import { expensesWorld, NOW, N } from "./expenses-world";
import { dayString, parseDay } from "../../../src/modules/ledger/domain/ledger.dates";
import { ComponentMapper, ProfileMapper, RunMapper, LoanMapper, RemittanceMapper } from "../../../src/modules/payroll/mappers/payroll.mapper";
import {
    CreateComponentDto, SetProfileDto, CreateRunDto, ApproveRunDto, RejectRunDto, CancelRunDto, ReverseRunDto, PayRunDto, CreateLoanDto, CancelLoanDto,
    CreateRemittanceDto, ReverseRemittanceDto,
} from "../../../src/modules/payroll/dtos/payroll.dto";
import { CreateComponentUseCase, UpdateComponentUseCase, SetComponentActiveUseCase, DeleteComponentUseCase } from "../../../src/modules/payroll/usecases/component.usecases";
import { SetPayProfileUseCase, GetPayProfileUseCase } from "../../../src/modules/payroll/usecases/profile.usecases";
import {
    CreateRunUseCase, CalculateRunUseCase, SubmitRunUseCase, ApproveRunUseCase, RejectRunUseCase, CancelRunUseCase, ReverseRunUseCase, PayRunUseCase, GetRunUseCase, ListRunsUseCase,
} from "../../../src/modules/payroll/usecases/run.usecases";
import { ListPayslipsUseCase, GetPayslipUseCase, PayslipDocumentUseCase } from "../../../src/modules/payroll/usecases/payslip.usecases";
import { CreateLoanUseCase, CancelLoanUseCase } from "../../../src/modules/payroll/usecases/loan.usecases";
import { CreateRemittanceUseCase, ReverseRemittanceUseCase, RemittancesDueUseCase } from "../../../src/modules/payroll/usecases/remittance.usecases";
import { PayrollSummaryUseCase } from "../../../src/modules/payroll/usecases/payroll-summary.usecase";

export { NOW, N };
export const code = (c: string) => (e: any) => e.code === c;

export function payrollWorld() {
    const ew = expensesWorld();
    const { books, accounts } = ew;
    const acct = (id: string, over: any) => ({ id, code: id, name: id, type: "ASSET", subtype: "GENERAL", systemKey: null as any, parentId: null, isMoneyAccount: false, isActive: true, isLocked: false, sortOrder: 0, deletedAt: null, ...over });
    accounts.push(
        acct("a-salaries", { systemKey: "SALARIES_EXPENSE", type: "EXPENSE" }), acct("a-employer", { systemKey: "EMPLOYER_PENSION_EXPENSE", type: "EXPENSE" }),
        acct("a-spay", { systemKey: "SALARIES_PAYABLE", type: "LIABILITY" }), acct("a-loans", { systemKey: "STAFF_LOANS_RECEIVABLE", type: "ASSET" }),
        acct("a-paye", { name: "PAYE payable", type: "LIABILITY", subtype: "PAYROLL_LIABILITY" }), acct("a-pension", { name: "Pension payable", type: "LIABILITY", subtype: "PAYROLL_LIABILITY" }),
        acct("a-union", { name: "Union dues payable", type: "LIABILITY", subtype: "PAYROLL_LIABILITY" }), acct("a-housing", { type: "EXPENSE" }),
    );
    const ledgerAccountRepository = ew.d.ledgerAccountRepository;
    const audit = ew.audit;
    const auditService = ew.d.auditService;

    // staff
    const staff = new Map<string, any>([
        ["s1", { id: "s1", name: "Ada Obi", employeeId: "E-001", designation: "Teacher", department: "Science", isActive: true }],
        ["s2", { id: "s2", name: "Bola Ade", employeeId: "E-002", designation: "Clerk", department: "Admin", isActive: true }],
        ["s3", { id: "s3", name: "Chi Eze", employeeId: "E-003", designation: "Driver", department: null, isActive: true }],
        ["s-off", { id: "s-off", name: "Gone Away", employeeId: "E-009", designation: null, department: null, isActive: false }],
    ]);
    const payrollContextRepository: any = {
        async staffInfo(ids: string[]) { return ids.map(i => staff.get(i)).filter(Boolean).map(s => ({ ...s })); },
        async activeStaffIds() { return [...staff.values()].filter(s => s.isActive).map(s => s.id); },
    };

    // components
    const components = new Map<string, any>();
    let compN = 0;
    const payComponentRepository: any = {
        async findById(id: string) { const c = components.get(id); return c && !c.deleted ? { ...c } : null; },
        async findByIds(ids: string[]) { return ids.map(i => components.get(i)).filter(c => c && !c.deleted).map(c => ({ ...c })); },
        async findByCode(code: string) { const c = [...components.values()].find(x => x.code === code && !x.deleted); return c ? { ...c } : null; },
        async list(f: any) { const data = [...components.values()].filter(c => !c.deleted && (f.status === "all" || (f.status === "inactive" ? !c.isActive : c.isActive)) && (!f.type || c.type === f.type)); return { data, meta: {} }; },
        async create(data: any) { const c = { id: `pc-${++compN}`, isActive: true, createdAt: NOW, deleted: false, ...data, bands: data.bands ? data.bands.map((b: any) => ({ upToKobo: b.upToKobo === null ? null : BigInt(b.upToKobo), rateBp: b.rateBp })) : null }; components.set(c.id, c); return { ...c }; },
        async update(id: string, data: any) { const c = components.get(id); Object.assign(c, data, data.bands !== undefined ? { bands: data.bands ? data.bands.map((b: any) => ({ upToKobo: b.upToKobo === null ? null : BigInt(b.upToKobo), rateBp: b.rateBp })) : null } : {}); return { ...c }; },
        async remove(id: string) { components.get(id).deleted = true; },
        async inUse(id: string) {
            return [...profiles.values()].some(p => p.components.some((x: any) => x.componentId === id)) || [...runs.values()].some(r => r.payslips.some((p: any) => p.lines.some((l: any) => l.componentId === id)));
        },
    };

    // pay profiles
    const profiles = new Map<string, any>();
    let profN = 0;
    const view = (p: any) => ({ ...p, components: p.components.map((c: any) => ({ ...c })) });
    const payProfileRepository: any = {
        async findById(id: string) { const p = profiles.get(id); return p ? view(p) : null; },
        async effectiveOn(staffId: string, day: Date) { const d = dayString(day); const p = [...profiles.values()].find(x => x.staffId === staffId && dayString(x.effectiveFrom) <= d && (!x.effectiveTo || dayString(x.effectiveTo) >= d)); return p ? view(p) : null; },
        async history(staffId: string) { return [...profiles.values()].filter(p => p.staffId === staffId).sort((a, b) => +b.effectiveFrom - +a.effectiveFrom).map(view); },
        async latest(staffId: string) { const h = await payProfileRepository.history(staffId); return h[0] ?? null; },
        async createFrom(data: any) {
            const dayBefore = new Date(data.effectiveFrom.getTime() - 86_400_000);
            for (const p of profiles.values()) if (p.staffId === data.staffId && !p.effectiveTo) p.effectiveTo = dayBefore;
            const p = {
                id: `pp-${++profN}`, staffId: data.staffId, effectiveFrom: data.effectiveFrom, effectiveTo: null, basicSalaryKobo: data.basicSalaryKobo, payFrequency: "MONTHLY",
                bankCode: data.bankCode, bankName: data.bankName, accountName: data.accountName, accountNumberLast4: data.accountNumberLast4, hasAccountNumber: !!data.accountNumberEncrypted,
                accountNumberEncrypted: data.accountNumberEncrypted, taxId: data.taxId, pensionId: data.pensionId, isActive: true, createdById: data.createdById, createdAt: NOW,
                components: data.components.map((c: any, i: number) => ({ id: `ppc-${profN}-${i}`, componentId: c.componentId, componentName: components.get(c.componentId)?.name, componentCode: components.get(c.componentId)?.code, valueOverride: c.valueOverride, isActive: true })),
            };
            profiles.set(p.id, p); return view(p);
        },
        async subjectsFor(day: Date) {
            const d = dayString(day);
            return [...profiles.values()].filter(p => dayString(p.effectiveFrom) <= d && (!p.effectiveTo || dayString(p.effectiveTo) >= d))
                .map(p => ({ staffId: p.staffId, profileId: p.id, basicSalaryKobo: p.basicSalaryKobo,
                    assigned: p.components.filter((c: any) => components.get(c.componentId)?.isActive).map((c: any) => ({ component: { ...components.get(c.componentId) }, valueOverride: c.valueOverride })) }));
        },
        async list() { return { data: [...profiles.values()].filter(p => !p.effectiveTo).map(view), meta: {} }; },
    };

    // runs and payslips
    const runs = new Map<string, any>();
    let runN = 0, slipN = 0, lineN = 0;
    const slipView = (s: any) => ({ ...s, lines: s.lines.map((l: any) => ({ ...l })) });
    const runView = (r: any) => ({ ...r, payslips: r.payslips.map(slipView) });
    const payrollRunRepository: any = {
        async findById(id: string) { const r = runs.get(id); return r ? runView(r) : null; },
        async list(f: any) { const data = [...runs.values()].filter(r => (!f.status || r.status === f.status) && (!f.year || r.periodYear === f.year)).map(runView); return { data, meta: {} }; },
        async existsForMonth(y: number, m: number) { return [...runs.values()].some(r => r.periodYear === y && r.periodMonth === m && r.status !== "CANCELLED"); },
        async create(data: any) {
            const r = {
                id: `run-${++runN}`, status: "DRAFT", grossKobo: 0n, deductionsKobo: 0n, employerCostKobo: 0n, netKobo: 0n, staffCount: 0, calculatedAt: null, submittedAt: null,
                approvedById: null, approvedAt: null, rejectedById: null, rejectedAt: null, rejectionReason: null, paidAt: null, paidById: null, paidOn: null, paidFromAccountId: null,
                paymentReference: null, accrualJournalId: null, paymentJournalId: null, cancelledAt: null, cancelledById: null, cancelReason: null, version: 1, createdAt: NOW, payslips: [] as any[], ...data,
            };
            runs.set(r.id, r); return runView(r);
        },
        async transition(id: string, from: string[], version: number, data: any) {
            const r = runs.get(id);
            if (!r || r.version !== version || !from.includes(r.status)) return false;
            Object.assign(r, data, { version: version + 1 }); return true;
        },
        async replacePayslips(runId: string, slips: any[]) {
            const r = runs.get(runId);
            if (r.payslips.some((p: any) => p.status !== "DRAFT")) throw new Error("only draft payslips can be replaced");
            r.payslips = slips.map(s => ({
                id: `ps-${++slipN}`, runId, payslipNumber: null, status: "DRAFT", paidAt: null, paymentReference: null, snapshot: null, createdAt: NOW, ...s,
                lines: s.lines.map((l: any) => ({ id: `pl-${++lineN}`, ...l })),
            }));
        },
        async findPayslip(id: string) { for (const r of runs.values()) { const s = r.payslips.find((p: any) => p.id === id); if (s) return slipView(s); } return null; },
        async listPayslips(f: any) {
            const all = [...runs.values()].flatMap(r => r.payslips).filter((p: any) => (!f.runId || p.runId === f.runId) && (!f.staffId || p.staffId === f.staffId) && (!f.statuses || f.statuses.includes(p.status)));
            return { data: all.map(slipView), meta: {} };
        },
        async finalizePayslip(id: string, number: string, snapshot: any) {
            const all = [...runs.values()].flatMap(r => r.payslips);
            const s = all.find((p: any) => p.id === id);
            if (s.snapshot) throw new Error("a frozen payslip cannot change");
            if (all.some((p: any) => p.payslipNumber === number)) throw new Error("unique payslipNumber");
            Object.assign(s, { payslipNumber: number, snapshot, status: "FINAL" });
        },
        async markPayslipsPaid(runId: string, at: Date, ref: string | null) { for (const p of runs.get(runId).payslips) if (p.status === "FINAL") Object.assign(p, { status: "PAID", paidAt: at, paymentReference: ref }); },
        async markPayslipsVoid(runId: string) { for (const p of runs.get(runId).payslips) if (p.status === "FINAL") p.status = "VOID"; },
        async runsInYear(year: number) { return [...runs.values()].filter(r => r.periodYear === year).map(runView); },
    };

    // loans
    const loans = new Map<string, any>();
    const repayments: any[] = [];
    const loanRepository: any = {
        async findById(id: string) { const l = loans.get(id); return l ? { ...l, repaymentsCount: repayments.filter(r => r.loanId === id && !r.reversedAt).length } : null; },
        async list() { return { data: [...loans.values()], meta: {} }; },
        async create(data: any) { const l = { status: "ACTIVE", version: 1, cancelledAt: null, cancelReason: null, createdAt: NOW, ...data }; loans.set(l.id, l); return { ...l, repaymentsCount: 0 }; },
        async dueFor(staffIds: string[], year: number, month: number) {
            return [...loans.values()].filter(l => staffIds.includes(l.staffId) && l.status === "ACTIVE" && l.balanceKobo > 0n && l.startYear * 12 + l.startMonth <= year * 12 + month)
                .map(l => ({ loanId: l.id, staffId: l.staffId, label: "Loan repayment", balanceKobo: l.balanceKobo, monthlyKobo: l.monthlyRepaymentKobo, amountKobo: l.monthlyRepaymentKobo < l.balanceKobo ? l.monthlyRepaymentKobo : l.balanceKobo }));
        },
        async applyRepayment(loanId: string, payslipId: string, amount: bigint) {
            const l = loans.get(loanId);
            if (!l || l.status !== "ACTIVE" || l.balanceKobo < amount) return false;
            l.balanceKobo -= amount; l.version++; repayments.push({ loanId, payslipId, amountKobo: amount, reversedAt: null });
            if (l.balanceKobo === 0n) l.status = "CLEARED"; return true;
        },
        async reverseRepayments(payslipIds: string[], at: Date) {
            for (const r of repayments) if (payslipIds.includes(r.payslipId) && !r.reversedAt) { r.reversedAt = at; const l = loans.get(r.loanId); l.balanceKobo += r.amountKobo; l.status = "ACTIVE"; l.version++; }
        },
        async cancel(id: string, version: number, by: string, reason: string, at: Date) {
            const l = loans.get(id);
            if (!l || l.version !== version || l.status !== "ACTIVE") return false;
            Object.assign(l, { status: "CANCELLED", cancelledAt: at, cancelReason: reason, version: version + 1 }); return true;
        },
    };

    // remittances
    const remittances = new Map<string, any>();
    const remittanceRepository: any = {
        async findById(id: string) { const m = remittances.get(id); return m ? { ...m } : null; },
        async list() { return { data: [...remittances.values()], meta: {} }; },
        async create(data: any) { const m = { reversedAt: null, reverseReason: null, createdAt: NOW, liabilityAccountName: null, ...data }; remittances.set(m.id, m); return { ...m }; },
        async markReversed(id: string, by: string, reason: string, at: Date) { const m = remittances.get(id); if (!m || m.reversedAt) return false; Object.assign(m, { reversedAt: at, reverseReason: reason }); return true; },
    };

    // the books, read the way the ledger report repository does
    const ledgerReportRepository: any = {
        async balancesAsOf(asOf: string) {
            const rows = new Map<string, any>();
            for (const a of accounts) rows.set(a.id, { accountId: a.id, code: a.code, name: a.name, type: a.type, subtype: a.subtype, systemKey: a.systemKey, isMoneyAccount: a.isMoneyAccount, debitKobo: 0n, creditKobo: 0n });
            for (const j of books.journals) if (dayString(j.entryDate) <= asOf) for (const l of j.lines) { const r = rows.get(l.accountId); r.debitKobo += l.debitKobo; r.creditKobo += l.creditKobo; }
            return [...rows.values()].map(r => ({ ...r, balanceKobo: ["LIABILITY", "INCOME", "EQUITY"].includes(r.type) ? r.creditKobo - r.debitKobo : r.debitKobo - r.creditKobo }));
        },
    };
    const paymentContextRepository = { async schoolHeader() { return { name: "Bright Future Academy", address: "1 School Road, Lagos", logoUrl: null }; } };
    const encryptionService = { encrypt: (s: string) => `enc:${s}`, decrypt: (s: string) => s.replace(/^enc:/, "") };

    const componentMapper = new ComponentMapper(), profileMapper = new ProfileMapper(), runMapper = new RunMapper(), loanMapper = new LoanMapper(), remittanceMapper = new RemittanceMapper();
    const tx = books.options.transaction;
    let clock = NOW;
    const o = { now: () => clock, transaction: tx };
    const d: any = {
        payComponentRepository, payProfileRepository, payrollRunRepository, loanRepository, remittanceRepository, payrollContextRepository, ledgerAccountRepository, ledgerReportRepository,
        paymentContextRepository, postingService: ew.d.postingService, numberSequenceService: books.deps.numberSequenceService, encryptionService, auditService,
        componentMapper, profileMapper, runMapper, loanMapper, remittanceMapper,
    };

    const world = {
        d, books, accounts, audit, staff, components, profiles, runs, loans, repayments, remittances,
        setNow(date: Date) { clock = date; },
        createComponent: new CreateComponentUseCase(d), updateComponent: new UpdateComponentUseCase(d), setComponentActive: new SetComponentActiveUseCase(d), deleteComponent: new DeleteComponentUseCase(d),
        setProfile: new SetPayProfileUseCase(d, o), getProfile: new GetPayProfileUseCase(d, o),
        createRun: new CreateRunUseCase(d, o), calculate: new CalculateRunUseCase(d, o), submit: new SubmitRunUseCase(d, o), approve: new ApproveRunUseCase(d, o),
        reject: new RejectRunUseCase(d, o), cancel: new CancelRunUseCase(d, o), reverse: new ReverseRunUseCase(d, o), pay: new PayRunUseCase(d, o), getRun: new GetRunUseCase(d), listRuns: new ListRunsUseCase(d),
        listPayslips: new ListPayslipsUseCase(d), getPayslip: new GetPayslipUseCase(d), document: new PayslipDocumentUseCase(d),
        createLoan: new CreateLoanUseCase(d, o), cancelLoan: new CancelLoanUseCase(d, o),
        createRemittance: new CreateRemittanceUseCase(d, o), reverseRemittance: new ReverseRemittanceUseCase(d, o), due: new RemittancesDueUseCase(d, o.now),
        summary: new PayrollSummaryUseCase(d, o.now),

        balance(accountId: string): bigint {
            return books.journals.flatMap((j: any) => j.lines).filter((l: any) => l.accountId === accountId).reduce((s: bigint, l: any) => s + l.debitKobo - l.creditKobo, 0n);
        },

        /* parsed the way the API parses them */
        async component(over: any) { return world.createComponent.execute("school-1", "admin-1", CreateComponentDto.parse({ name: over.code, ...over })); },
        async profile(staffId: string, basicNaira: number, over: any = {}) {
            return world.setProfile.execute("school-1", "admin-1", SetProfileDto.parse({ staffId, effectiveFrom: "2026-01-01", basicSalaryKobo: Number(N(basicNaira)), components: [], ...over }));
        },
        async newRun(over: any = {}) { return world.createRun.execute("school-1", "bursar-1", CreateRunDto.parse({ periodYear: 2026, periodMonth: 9, payDate: "2026-09-28", ...over })); },
        async calculated(over: any = {}) { const r = await world.newRun(over); await world.calculate.execute(r.id, "school-1", "bursar-1"); return world.getRun.execute(r.id); },
        async pending(over: any = {}) { const r = await world.calculated(over); return world.submit.execute(r.id, "school-1", "bursar-1"); },
        async approved(over: any = {}) { const r = await world.pending(over); return world.approve.execute(r.id, "school-1", "principal-1", ApproveRunDto.parse({})); },
        async paid(over: any = {}) { const r = await world.approved(over); return world.pay.execute(r.id, "school-1", "bursar-1", PayRunDto.parse({ accountId: "a-bank" })); },
        approveAs(id: string, who = "principal-1") { return world.approve.execute(id, "school-1", who, ApproveRunDto.parse({})); },
        rejectAs(id: string, reason = "Check overtime", who = "principal-1") { return world.reject.execute(id, "school-1", who, RejectRunDto.parse({ reason })); },
        cancelRun(id: string, reason = "Wrong month") { return world.cancel.execute(id, "school-1", "bursar-1", CancelRunDto.parse({ reason })); },
        reverseRun(id: string, reason = "Wrong amounts") { return world.reverse.execute(id, "school-1", "principal-1", ReverseRunDto.parse({ reason })); },
        payRun(id: string, over: any = {}) { return world.pay.execute(id, "school-1", "bursar-1", PayRunDto.parse({ accountId: "a-bank", ...over })); },
        lend(staffId: string, principalNaira: number, monthlyNaira: number, over: any = {}) {
            return world.createLoan.execute("school-1", "bursar-1", CreateLoanDto.parse({ staffId, principalKobo: Number(N(principalNaira)), monthlyRepaymentKobo: Number(N(monthlyNaira)), startMonth: "2026-09", accountId: "a-bank", ...over }));
        },
        cancelLoanFor(id: string, reason = "Changed mind") { return world.cancelLoan.execute(id, "school-1", "bursar-1", CancelLoanDto.parse({ reason })); },
        remit(over: any = {}) {
            return world.createRemittance.execute("school-1", "bursar-1", CreateRemittanceDto.parse({ liabilityAccountId: "a-paye", periodYear: 2026, periodMonth: 9, amountKobo: 1, fromAccountId: "a-bank", ...over }));
        },
        reverseRemit(id: string, reason = "Paid twice") { return world.reverseRemittance.execute(id, "school-1", "bursar-1", ReverseRemittanceDto.parse({ reason })); },
        fund(naira: number) { return ew.d.postingService.post({ entryDate: "2026-09-01", description: "funds", sourceType: "MANUAL", sourceId: `fund-${Math.random()}`, purpose: "POST", lines: [{ accountId: "a-bank", debitKobo: N(naira) }, { accountId: "a-tuition", creditKobo: N(naira) }] }); },

        /* THE CONTROLS (brief 12): salaries payable = approved unpaid payslips, staff loans receivable = active loans, and the books balance. */
        assertControl(assert: any) {
            const owed = [...runs.values()].flatMap(r => r.payslips).filter((p: any) => p.status === "FINAL").reduce((s: bigint, p: any) => s + p.netKobo, 0n);
            assert.equal(-world.balance("a-spay"), owed, "salaries payable must equal what approved, unpaid payslips owe");
            const active = [...loans.values()].filter(l => l.status === "ACTIVE").reduce((s, l) => s + l.balanceKobo, 0n);
            assert.equal(world.balance("a-loans"), active, "staff loans receivable must equal what active loans owe");
            const sums = books.journals.reduce((s: any, j: any) => ({ d: s.d + j.lines.reduce((x: bigint, l: any) => x + l.debitKobo, 0n), c: s.c + j.lines.reduce((x: bigint, l: any) => x + l.creditKobo, 0n) }), { d: 0n, c: 0n });
            assert.equal(sums.d, sums.c, "the books must balance");
        },
    };
    return world;
}
