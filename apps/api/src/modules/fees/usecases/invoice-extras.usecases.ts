import { IFeeInvoiceRepository } from "../repositories/fee-invoice.repository";
import { IInvoiceGenerationRepository } from "../repositories/invoice-generation.repository";
import { IFeeTypeRepository } from "../repositories/fee-type.repository";
import { IInstalmentRepository } from "../repositories/instalment.repository";
import { IFeeReportRepository } from "../repositories/fee-report.repository";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { IssueInvoiceUseCase } from "./invoice-issue.usecases";
import { FeeInvoiceMapper } from "../mappers/fee-invoice.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { AppError } from "../../../shared/errors/domain.errors";
import { koboOut } from "../../ledger/mappers/kobo";
import { parseDay, todayInFinanceZone, dayString } from "../../ledger/domain/ledger.dates";
import { feeErrors } from "../domain/fee.errors";
import { scheduleOf, validatePlan } from "../domain/instalment.policy";
import { daysOverdue, expandByPlan } from "../domain/report.policy";
import { totalsOf } from "../domain/invoice.policy";
import { OpeningBalancesDtoType, RunLateFeesDtoType, SaveInstalmentPlanDtoType } from "../dtos/instalment.dto";

interface Dependencies {
    feeInvoiceRepository: IFeeInvoiceRepository; invoiceGenerationRepository: IInvoiceGenerationRepository; feeTypeRepository: IFeeTypeRepository;
    instalmentRepository: IInstalmentRepository; feeReportRepository: IFeeReportRepository; ledgerAccountRepository: ILedgerAccountRepository;
    issueInvoiceUseCase: IssueInvoiceUseCase; feeInvoiceMapper: FeeInvoiceMapper; auditService: AuditService;
}
export interface ExtrasOptions { now?: () => Date }

const planOut = (plan: { id: string; status: string; lines: { lineNumber: number; dueDate: Date; amountKobo: bigint }[] }, paid: bigint, total: bigint, asOf: string) => ({
    id: plan.id, status: plan.status, totalKobo: koboOut(total), paidKobo: koboOut(paid),
    lines: scheduleOf(plan.lines, paid, total, asOf).map(l => ({ lineNumber: l.lineNumber, dueDate: l.dueDate, amountKobo: koboOut(l.amountKobo), paidKobo: koboOut(l.paidKobo), balanceKobo: koboOut(l.balanceKobo), status: l.status, daysOverdue: l.daysOverdue })),
});

/* SET (OR REPLACE) AN INSTALMENT PLAN on an issued invoice that still owes money. A schedule only: nothing is posted. */
export class SaveInstalmentPlanUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: ExtrasOptions = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(invoiceId: string, schoolId: string, actorUserId: string, dto: SaveInstalmentPlanDtoType) {
        const [inv] = await this.d.feeInvoiceRepository.findManyByIds([invoiceId]);
        if (!inv) throw feeErrors.invoiceNotFound();
        if ((inv.status !== "unpaid" && inv.status !== "partial") || inv.balanceKobo <= 0n) throw feeErrors.invoiceNotOpen(inv.status);
        validatePlan(dto.lines.map(l => ({ dueDate: l.dueDate, amountKobo: l.amountKobo })), inv.totalKobo);
        const lines = dto.lines.map((l, i) => ({ lineNumber: i + 1, dueDate: parseDay(l.dueDate), amountKobo: l.amountKobo }));
        const saved = await this.d.instalmentRepository.save(invoiceId, lines, actorUserId);
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.instalments.saved", entity: "FeeInvoice", entityId: invoiceId,
            newValue: { parts: lines.length, totalKobo: inv.totalKobo.toString(), firstDue: dto.lines[0].dueDate, lastDue: dto.lines.at(-1)!.dueDate },
        });
        return planOut(saved, inv.paidKobo, inv.totalKobo, todayInFinanceZone(this.now()));
    }
}

export class GetInstalmentPlanUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: ExtrasOptions = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(invoiceId: string) {
        const [inv] = await this.d.feeInvoiceRepository.findManyByIds([invoiceId]);
        if (!inv) throw feeErrors.invoiceNotFound();
        const plan = await this.d.instalmentRepository.findByInvoice(invoiceId);
        if (!plan) throw feeErrors.instalmentPlanNotFound();
        return planOut(plan, inv.paidKobo, inv.totalKobo, todayInFinanceZone(this.now()));
    }
}

export class CancelInstalmentPlanUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(invoiceId: string, schoolId: string, actorUserId: string) {
        if (!(await this.d.instalmentRepository.cancel(invoiceId))) throw feeErrors.instalmentPlanNotFound();
        await this.d.auditService.log({ userId: actorUserId, schoolId, action: "fees.instalments.cancelled", entity: "FeeInvoice", entityId: invoiceId });
        return { cancelled: true };
    }
}

/*
| OPENING BALANCES (migration): what each student owed before the system began. One invoice each (type OPENING_BALANCE), dated and due on the
| as-of date, issued at once: Dr fees receivable, Cr opening balance equity. Each entry stands alone, so one bad row never blocks the rest.
*/
export class OpeningBalancesUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: ExtrasOptions = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(schoolId: string, actorUserId: string, dto: OpeningBalancesDtoType) {
        const d = this.d;
        parseDay(dto.asOf);
        if (dto.asOf > todayInFinanceZone(this.now())) throw feeErrors.asOfInFuture();
        const [equity] = await d.ledgerAccountRepository.findPostable([], ["OPENING_EQUITY"]);
        if (!equity) throw feeErrors.openingEquityMissing();

        const created: { studentId: string; invoiceId: string; invoiceNumber: string | null; amountKobo: number }[] = [];
        const failed: { studentId: string; code: string; message: string }[] = [];
        for (const e of dto.entries) {
            let draftId: string | null = null;
            try {
                if (!(await d.invoiceGenerationRepository.studentExists(e.studentId))) throw feeErrors.studentNotFound();
                const items = [{ feeTypeId: null, description: "Balance brought forward", incomeAccountId: equity.id, amountKobo: e.amountKobo, sortOrder: 0 }];
                const draft = await d.feeInvoiceRepository.createDraft({
                    type: "OPENING_BALANCE", studentId: e.studentId, branchId: dto.branchId ?? null, dueDate: parseDay(dto.dueDate ?? dto.asOf), note: e.note ?? null,
                    ...totalsOf(items, 0n), createdById: actorUserId, updatedById: actorUserId,
                }, items, []);
                draftId = draft.id;
                const issued = await d.issueInvoiceUseCase.execute(draft.id, schoolId, actorUserId, { issueDate: dto.asOf });
                created.push({ studentId: e.studentId, invoiceId: draft.id, invoiceNumber: issued.invoiceNumber, amountKobo: Number(e.amountKobo) });
            } catch (err) {
                if (!(err instanceof AppError)) throw err;
                if (draftId) await d.feeInvoiceRepository.deleteDraft(draftId);        // never leave a half-made opening balance behind
                failed.push({ studentId: e.studentId, code: err.code ?? "ERROR", message: err.message });
            }
        }
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.opening_balances.imported", entity: "FeeInvoice",
            newValue: { asOf: dto.asOf, created: created.length, failed: failed.length, totalKobo: created.reduce((s, c) => s + BigInt(c.amountKobo), 0n).toString() },
        });
        return { created, failed };
    }
}

/*
| LATE FEES. Every issued invoice that is overdue by more than the grace days is charged ONE late fee, as a new invoice (type ADHOC, linked to the
| one it was charged for, issued at once). The amount is fixed, or a percent of what is overdue. An invoice is charged a late fee once, ever, and a late
| fee invoice is never charged a late fee itself. With instalments, only the overdue parts count. "dryRun" lists what would be charged and changes nothing.
*/
export class RunLateFeesUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: ExtrasOptions = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(schoolId: string, actorUserId: string, dto: RunLateFeesDtoType) {
        const d = this.d;
        const today = todayInFinanceZone(this.now());
        const asOf = dto.asOf ?? today;
        parseDay(asOf);
        if (asOf > today) throw feeErrors.asOfInFuture();

        const [type] = await d.feeTypeRepository.findByIds([dto.feeTypeId]);
        if (!type) throw feeErrors.feeTypeNotFound();
        if (!type.isActive) throw feeErrors.feeTypeInactive(type.name);

        const rows = await d.feeReportRepository.openInvoices({ branchId: dto.branchId, classId: dto.classId, termId: dto.termId });
        const links = await d.feeInvoiceRepository.lateFeeLinks(rows.map(r => r.id));

        const plan: { invoiceId: string; invoiceNumber: string | null; studentId: string; baseKobo: bigint; feeKobo: bigint }[] = [];
        const skipped: { invoiceId: string; invoiceNumber: string | null; reason: string }[] = [];
        for (const r of rows) {
            if (links.areLateFees.has(r.id)) { skipped.push({ invoiceId: r.id, invoiceNumber: r.invoiceNumber, reason: "IS_LATE_FEE" }); continue; }
            const overdue = expandByPlan(r).filter(x => daysOverdue(asOf, x.dueDate, x.issueDate) > dto.graceDays);
            if (overdue.length === 0) continue;                                        // not late enough: nothing to say
            if (links.charged.has(r.id)) { skipped.push({ invoiceId: r.id, invoiceNumber: r.invoiceNumber, reason: "ALREADY_CHARGED" }); continue; }
            const base = overdue.reduce((s, x) => s + x.balanceKobo, 0n);
            const fee = dto.fixedKobo ?? (base * BigInt(Math.round((dto.percent as number) * 100))) / 10_000n;
            if (fee <= 0n) { skipped.push({ invoiceId: r.id, invoiceNumber: r.invoiceNumber, reason: "ZERO_AMOUNT" }); continue; }
            plan.push({ invoiceId: r.id, invoiceNumber: r.invoiceNumber, studentId: r.studentId, baseKobo: base, feeKobo: fee });
        }

        const view = (p: (typeof plan)[number]) => ({ invoiceId: p.invoiceId, invoiceNumber: p.invoiceNumber, studentId: p.studentId, overdueKobo: koboOut(p.baseKobo), feeKobo: koboOut(p.feeKobo) });
        if (dto.dryRun) return { asOf, dryRun: true, charged: plan.map(view), skipped, failed: [] as { invoiceId: string; code: string; message: string }[] };

        const dueDate = dayString(new Date(parseDay(today).getTime() + dto.dueInDays * 86_400_000));
        const charged: (ReturnType<typeof view> & { lateFeeInvoiceId: string; lateFeeInvoiceNumber: string | null })[] = [];
        const failed: { invoiceId: string; code: string; message: string }[] = [];
        for (const p of plan) {
            let draftId: string | null = null;
            try {
                const items = [{ feeTypeId: type.id, description: `Late fee on ${p.invoiceNumber ?? "invoice"}`, incomeAccountId: type.incomeAccountId, amountKobo: p.feeKobo, sortOrder: 0 }];
                const draft = await d.feeInvoiceRepository.createDraft({
                    type: "ADHOC", studentId: p.studentId, lateFeeOfInvoiceId: p.invoiceId, dueDate: parseDay(dueDate), note: `Late fee on ${p.invoiceNumber ?? "invoice"}`,
                    ...totalsOf(items, 0n), createdById: actorUserId, updatedById: actorUserId,
                }, items, []);
                draftId = draft.id;
                const issued = await d.issueInvoiceUseCase.execute(draft.id, schoolId, actorUserId, { issueDate: today });
                charged.push({ ...view(p), lateFeeInvoiceId: draft.id, lateFeeInvoiceNumber: issued.invoiceNumber });
            } catch (err) {
                if (draftId) await d.feeInvoiceRepository.deleteDraft(draftId);
                const unique = (err as { code?: string })?.code === "P2002";           // another run charged it a moment ago
                if (unique) { skipped.push({ invoiceId: p.invoiceId, invoiceNumber: p.invoiceNumber, reason: "ALREADY_CHARGED" }); continue; }
                if (!(err instanceof AppError)) throw err;
                failed.push({ invoiceId: p.invoiceId, code: err.code ?? "ERROR", message: err.message });
            }
        }
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.late_fees.charged", entity: "FeeInvoice",
            newValue: { asOf, charged: charged.length, failed: failed.length, totalKobo: charged.reduce((s, c) => s + BigInt(String(c.feeKobo)), 0n).toString() },
        });
        return { asOf, dryRun: false, charged, skipped, failed };
    }
}

