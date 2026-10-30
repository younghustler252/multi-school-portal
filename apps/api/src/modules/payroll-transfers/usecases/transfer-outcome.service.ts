import { ISalaryTransferRepository } from "../repositories/salary-transfer.repository";
import { IPayrollRunRepository } from "../../payroll/repositories/payroll.repositories";
import { PostingService } from "../../ledger/services/posting.service";
import { AuditService } from "../../audit/services/audit.service";
import { SalaryTransferEntity, TransferStatus } from "../domain/transfer.entity";
import { Outcome, nextStatus } from "../domain/transfer.policy";
import { transferErrors } from "../domain/transfer.errors";
import { ActorType } from "../../audit/domain/audit.enums";
import { parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";

interface Dependencies {
    salaryTransferRepository: ISalaryTransferRepository; payrollRunRepository: IPayrollRunRepository; postingService: PostingService; auditService: AuditService;
}
export interface OutcomeOptions { now?: () => Date; transaction?: <T>(fn: () => Promise<T>) => Promise<T> }
export interface OutcomeInfo { source: "response" | "webhook" | "verify" | "reconcile"; schoolId: string; actorUserId: string | null; transferCode?: string | null; reason?: string | null }
export interface OutcomeResult { result: "applied" | "same" | "rejected"; status: TransferStatus }

const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

const NOT_YET_CONFIRMED: TransferStatus[] = ["PENDING", "SENDING", "PROCESSING", "UNKNOWN"];

/*
| THE ONE PLACE A TRANSFER'S OUTCOME IS APPLIED (the provider's answer, its signed webhook, a verify and the reconciliation all come here).
|   success   books Dr Salaries payable / Cr the money account ONCE (the journal key is the transfer id), marks the transfer SUCCESS, and
|             when every salary of the run is paid, marks the run and its payslips PAID.
|   failed    marks the transfer FAILED with the reason. Nothing is booked.
|   reversed  the bank returned the money: the booking is reversed through the posting service. If the success was never seen, it is booked first.
| Repeats are harmless (same status = no change). A contradiction (a failure for a transfer already paid) changes nothing and is audited.
*/
export class TransferOutcomeService {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: OutcomeOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async apply(transferId: string, outcome: Outcome, info: OutcomeInfo): Promise<OutcomeResult> {
        const d = this.d;
        const t = await d.salaryTransferRepository.findById(transferId);
        if (!t) throw transferErrors.notFound();
        const next = nextStatus(t.status, outcome);
        const audit = (action: string, value: Record<string, unknown>) => d.auditService.log({
            userId: info.actorUserId ?? "SYSTEM_PAYROLL_TRANSFERS", ...(info.actorUserId ? {} : { actorType: ActorType.SYSTEM }), schoolId: info.schoolId, action, entity: "SalaryTransfer", entityId: t.id,
            oldValue: { status: t.status }, newValue: { reference: t.reference, source: info.source, ...value },
        });

        if (next === "SAME") return { result: "same", status: t.status };
        if (next === "REJECT") {
            await audit("payroll.transfer.conflict", { outcome, kept: t.status, reason: info.reason ?? null });
            return { result: "rejected", status: t.status };
        }

        if (outcome === "success") {
            await this.bookSuccess(t, info);
            await audit(t.status === "FAILED" ? "payroll.transfer.late_success" : "payroll.transfer.succeeded", { amountKobo: t.amountKobo.toString(), status: "SUCCESS" });
            await this.completeRunIfPaid(t.runId, t.initiatedById);
            return { result: "applied", status: "SUCCESS" };
        }

        if (outcome === "failed") {
            const ok = await d.salaryTransferRepository.update(t.id, NOT_YET_CONFIRMED, { status: "FAILED", failureReason: info.reason ?? "The transfer failed", transferCode: info.transferCode ?? t.transferCode });
            if (!ok) throw transferErrors.changed();
            await audit("payroll.transfer.failed", { reason: info.reason ?? null, status: "FAILED" });
            return { result: "applied", status: "FAILED" };
        }

        // reversed: make sure the payment is booked, then reverse it
        let current = t;
        if (t.status !== "SUCCESS") {
            await this.bookSuccess(t, info);
            current = (await d.salaryTransferRepository.findById(t.id))!;
        }
        await this.transaction(async () => {
            const posted = await d.postingService.reverse(current.journalId!, { reason: info.reason ?? "The bank returned this salary transfer", actorUserId: info.actorUserId });
            const ok = await d.salaryTransferRepository.update(t.id, ["SUCCESS"], { status: "REVERSED", reversalJournalId: posted.journal.id, failureReason: info.reason ?? "Returned by the bank" });
            if (!ok) throw transferErrors.changed();
        });
        await audit("payroll.transfer.reversed", { amountKobo: t.amountKobo.toString(), status: "REVERSED" });
        return { result: "applied", status: "REVERSED" };
    }

    /* Books the payment and marks the transfer SUCCESS in one transaction. The journal's key is the transfer id, so a repeat never books twice. */
    private async bookSuccess(t: SalaryTransferEntity, info: OutcomeInfo): Promise<void> {
        const d = this.d, today = todayInFinanceZone(this.now());
        await this.transaction(async () => {
            const posted = await d.postingService.post({
                entryDate: today, description: `Salary transfer ${t.reference}`, sourceType: "PAYROLL_PAYMENT", sourceId: t.id, purpose: "TRANSFER",
                lines: [
                    { systemKey: "SALARIES_PAYABLE", debitKobo: t.amountKobo, partyType: "STAFF", partyId: t.staffId },
                    { accountId: t.fromAccountId, creditKobo: t.amountKobo },
                ],
                actorUserId: info.actorUserId ?? t.initiatedById,
            });
            const ok = await d.salaryTransferRepository.update(t.id, [...NOT_YET_CONFIRMED, "FAILED"], {
                status: "SUCCESS", journalId: posted.journal.id, confirmedAt: this.now(), failureReason: null, transferCode: info.transferCode ?? t.transferCode,
            });
            if (!ok) throw transferErrors.changed();
        });
    }

    /* When every salary of an approved run has a confirmed transfer, the run is PAID and its payslips are marked paid. */
    private async completeRunIfPaid(runId: string, paidById: string): Promise<void> {
        const d = this.d;
        const run = await d.payrollRunRepository.findById(runId);
        if (!run || run.status !== "APPROVED") return;
        const paid = new Set((await d.salaryTransferRepository.listByRun(runId)).filter(x => x.status === "SUCCESS").map(x => x.payslipId));
        if (!run.payslips.filter(p => p.netKobo > 0n).every(p => paid.has(p.id))) return;
        const today = todayInFinanceZone(this.now());
        const accounts = new Set((await d.salaryTransferRepository.listByRun(runId)).filter(x => x.status === "SUCCESS").map(x => x.fromAccountId));
        const ok = await d.payrollRunRepository.transition(runId, ["APPROVED"], run.version, {
            status: "PAID", paidAt: this.now(), paidById, paidOn: parseDay(today), paidFromAccountId: accounts.size === 1 ? [...accounts][0] : null, paymentReference: "bank transfers",
        });
        if (ok) await d.payrollRunRepository.markPayslipsPaid(runId, this.now(), "bank transfers");
    }
}
