import { randomBytes, randomUUID } from "crypto";
import { ISalaryTransferRepository } from "../repositories/salary-transfer.repository";
import { IPayrollRunRepository } from "../../payroll/repositories/payroll.repositories";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { ITransferProvider } from "../../../infrastructure/payments/interfaces/transfer.provider.interface";
import { PaymentProviderError } from "../../../infrastructure/payments/interfaces/payment.provider.interface";
import { EncryptionService } from "../../../shared/services/encryption.service";
import { AuditService } from "../../audit/services/audit.service";
import { TransferMapper } from "../mappers";
import { TransferOutcomeService } from "./transfer-outcome.service";
import { FinanceSettingsReader, settingsOf } from "../../finance-settings/domain/finance-settings";
import { PayrollRunEntity } from "../../payroll/domain/payroll.entity";
import { NewSalaryTransfer, SalaryTransferEntity } from "../domain/transfer.entity";
import { NOT_FOUND_TRUST_MINUTES, PROCESSING_STALE_MINUTES, SENDING_STALE_MINUTES, buildReference, checkLimits } from "../domain/transfer.policy";
import { transferErrors } from "../domain/transfer.errors";
import { lastDayOfMonth } from "../../payroll/domain/payroll.policy";
import { resolveMoneyAccount } from "../../payroll/usecases/payroll-shared";
import { ListTransfersQueryType, ReconcileTransfersDtoType, RetryTransferDtoType, StartTransfersDtoType } from "../dtos/transfer.dto";

interface Dependencies {
    salaryTransferRepository: ISalaryTransferRepository; payrollRunRepository: IPayrollRunRepository; ledgerAccountRepository: ILedgerAccountRepository;
    transferProvider: ITransferProvider; encryptionService: EncryptionService; auditService: AuditService; transferMapper: TransferMapper;
    transferOutcomeService: TransferOutcomeService; financeSettingsService?: FinanceSettingsReader;
}
interface Options { now?: () => Date; transaction?: <T>(fn: () => Promise<T>) => Promise<T> }

const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

/* Transfers move real money, so they only run when the platform AND the school have switched them on. */
async function assertEnabled(d: Dependencies) {
    if (!d.transferProvider.isEnabled()) throw transferErrors.disabled("Salary transfers are not switched on for this platform");
    if (!(await settingsOf(d)).payrollTransfersEnabled) throw transferErrors.disabled("Salary transfers are switched off in this school's finance settings");
}

async function loadRun(d: Dependencies, runId: string): Promise<PayrollRunEntity> {
    const run = await d.payrollRunRepository.findById(runId);
    if (!run) throw transferErrors.notFound();
    return run;
}

/* Whoever approved the run does not also send it (unless the school allows self approval): the person who prepared, approved and sent it are recorded. */
async function assertNotApprover(d: Dependencies, run: PayrollRunEntity, actor: string) {
    if (run.approvedById === actor && !(await settingsOf(d)).allowSelfApproval) throw transferErrors.initiatorIsApprover();
}

/*
| START the transfers of an APPROVED run. It only creates the records (one PENDING transfer per payslip with pay), freezing each person's bank
| details at this moment, so a later edit to a pay profile can never redirect approved money. Nothing is sent. Starting again never makes a
| second transfer for a payslip that already has one. Limits and the approver rule are checked here, before anything exists.
*/
export class StartTransfersUseCase {
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: Options = {}) { this.transaction = options.transaction ?? defaultTransaction; }

    async execute(runId: string, schoolId: string, actorUserId: string, dto: StartTransfersDtoType) {
        const d = this.d;
        await assertEnabled(d);
        const run = await loadRun(d, runId);
        if (run.status !== "APPROVED") throw transferErrors.runNotApproved(run.status);
        await assertNotApprover(d, run, actorUserId);
        const from = await resolveMoneyAccount(d.ledgerAccountRepository, dto.fromAccountId).catch(e => { throw transferErrors.accountInvalid(e.message); });

        const owed = run.payslips.filter(p => p.netKobo > 0n);
        const live = await d.salaryTransferRepository.payslipsWithLiveTransfer(owed.map(p => p.id));
        const day = lastDayOfMonth(run.periodYear, run.periodMonth);
        const rows: NewSalaryTransfer[] = [], skipped: { staffId: string; reason: string }[] = [];
        for (const p of owed) {
            if (live.has(p.id)) { skipped.push({ staffId: p.staffId, reason: "Already has a transfer" }); continue; }
            const b = await d.salaryTransferRepository.payoutDetails(p.staffId, day);
            if (!b?.bankCode || !b.accountNumberEncrypted || !b.accountName || !b.accountLast4) { skipped.push({ staffId: p.staffId, reason: "No bank details on the pay profile" }); continue; }
            const attempt = (await d.salaryTransferRepository.lastAttempt(p.id)) + 1;
            rows.push({
                id: randomUUID(), runId, payslipId: p.id, staffId: p.staffId, attempt, reference: buildReference(schoolId, randomBytes(6).toString("hex"), attempt),
                amountKobo: p.netKobo, bankCode: b.bankCode, bankName: b.bankName, accountName: b.accountName, accountNumberEncrypted: b.accountNumberEncrypted,
                accountLast4: b.accountLast4, fromAccountId: from.id, initiatedById: actorUserId,
            });
        }
        if (rows.length === 0) throw transferErrors.nothingToSend(skipped);

        const settings = await settingsOf(d);
        const problem = checkLimits(rows, settings.transferMaxKobo, settings.transferBatchMaxKobo);
        if (problem) throw transferErrors.overLimit(problem.code, problem.message, problem.staffId);

        await this.transaction(() => d.salaryTransferRepository.insertMany(rows));
        const total = rows.reduce((s, r) => s + r.amountKobo, 0n);
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "payroll.transfers.started", entity: "PayrollRun", entityId: runId,
            newValue: { runNumber: run.runNumber, transfers: rows.length, totalKobo: total.toString(), fromAccountId: from.id, skipped },
        });
        return { started: rows.length, totalKobo: Number(total), skipped, transfers: (await d.salaryTransferRepository.listByRun(runId)).map(t => d.transferMapper.toResponse(t)) };
    }
}

/*
| SEND the PENDING transfers of a run, one at a time. For each: claim it (PENDING -> SENDING, so two senders can never both send it), make the
| provider's recipient, then ask for the transfer. Every state is saved BEFORE the next network call, and no database transaction is held across one.
|   provider said no           -> FAILED (the reference was never used)
|   provider said yes, moving  -> PROCESSING (the webhook or a verify settles it)
|   provider said paid         -> SUCCESS (booked once)
|   no answer / any doubt      -> UNKNOWN. NEVER sent again: reconciliation asks the provider what happened.
*/
export class SendTransfersUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(runId: string, schoolId: string, actorUserId: string) {
        const d = this.d;
        await assertEnabled(d);
        const run = await loadRun(d, runId);
        if (run.status !== "APPROVED" && run.status !== "PAID") throw transferErrors.runNotApproved(run.status);
        await assertNotApprover(d, run, actorUserId);

        const pending = (await d.salaryTransferRepository.listByRun(runId)).filter(t => t.status === "PENDING");
        const results: { id: string; staffId: string; status: string; note?: string }[] = [];
        for (const t of pending) results.push(await this.sendOne(t, run, schoolId, actorUserId));

        await d.auditService.log({
            userId: actorUserId, schoolId, action: "payroll.transfers.sent", entity: "PayrollRun", entityId: runId,
            newValue: { runNumber: run.runNumber, attempted: results.length, results: results.map(r => ({ id: r.id, status: r.status })) },
        });
        return { attempted: results.length, results };
    }

    private async sendOne(t: SalaryTransferEntity, run: PayrollRunEntity, schoolId: string, actor: string): Promise<{ id: string; staffId: string; status: string; note?: string }> {
        const d = this.d, repo = d.salaryTransferRepository;
        const out = (status: string, note?: string) => ({ id: t.id, staffId: t.staffId, status, note });
        if (!(await repo.claim(t.id))) return out("SKIPPED", "Another sender has this transfer");
        const info = (extra: object = {}) => ({ source: "response" as const, schoolId, actorUserId: actor, ...extra });

        let recipientCode = t.recipientCode;
        if (!recipientCode) {
            try {
                recipientCode = (await d.transferProvider.createRecipient({ name: t.accountName, accountNumber: d.encryptionService.decrypt(t.accountNumberEncrypted), bankCode: t.bankCode })).recipientCode;
                await repo.update(t.id, ["SENDING"], { recipientCode });
            } catch (e) {
                // Nothing was sent yet, so this is safe to put back and try again later
                const definitive = e instanceof PaymentProviderError && e.definitive;
                if (definitive) { await d.transferOutcomeService.apply(t.id, "failed", info({ reason: `The bank details were refused: ${(e as Error).message}` })); return out("FAILED", (e as Error).message); }
                await repo.update(t.id, ["SENDING"], { status: "PENDING" });
                return out("PENDING", "Could not reach the provider to set up the recipient. Try again");
            }
        }

        try {
            if (t.amountKobo > BigInt(Number.MAX_SAFE_INTEGER)) throw new PaymentProviderError("Amount too large", true);
            const r = await d.transferProvider.initiateTransfer({ amountKobo: Number(t.amountKobo), recipientCode, reference: t.reference, reason: `Salary ${run.runNumber}` });
            if (r.state === "success") { await d.transferOutcomeService.apply(t.id, "success", info({ transferCode: r.transferCode })); return out("SUCCESS"); }
            if (r.state === "failed") { await d.transferOutcomeService.apply(t.id, "failed", info({ reason: r.failureReason ?? "The provider refused the transfer", transferCode: r.transferCode })); return out("FAILED", r.failureReason); }
            if (r.state === "reversed") { await d.transferOutcomeService.apply(t.id, "reversed", info({ transferCode: r.transferCode })); return out("REVERSED"); }
            await repo.update(t.id, ["SENDING"], { status: "PROCESSING", transferCode: r.transferCode ?? null });
            return out("PROCESSING", r.message);
        } catch (e) {
            const message = e instanceof Error ? e.message : "Unknown error";
            // "Duplicate reference" means the provider already HAS this transfer: that is an unknown outcome, not a failure
            if (e instanceof PaymentProviderError && e.definitive && !/duplicate/i.test(message)) {
                await d.transferOutcomeService.apply(t.id, "failed", info({ reason: message }));
                return out("FAILED", message);
            }
            await repo.update(t.id, ["SENDING"], { status: "UNKNOWN", failureReason: `No clear answer from the provider (${message}). It will be checked, not resent` });
            return out("UNKNOWN", message);
        }
    }
}

/*
| RECONCILE: ask the provider what really happened to every transfer that is in flight or unknown (or one transfer), and apply the answer.
| "Still moving" changes nothing. "No record" is trusted only after a wait (a transfer can take a while to appear), then the transfer is FAILED
| and may be retried as a new attempt.
*/
export class ReconcileTransfersUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: Options = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(schoolId: string, actorUserId: string, dto: ReconcileTransfersDtoType = {}) {
        const d = this.d;
        await assertEnabled(d);
        const one = dto.transferId ? await d.salaryTransferRepository.findById(dto.transferId) : null;
        if (dto.transferId && !one) throw transferErrors.notFound();
        const candidates = one ? [one] : await d.salaryTransferRepository.unsettled(200);

        const minutes = (t: SalaryTransferEntity) => (this.now().getTime() - (t.sentAt ?? t.updatedAt).getTime()) / 60_000;
        const results: { id: string; before: string; after: string; note?: string }[] = [];
        for (const t of candidates) {
            if (!["SENDING", "PROCESSING", "UNKNOWN"].includes(t.status)) { results.push({ id: t.id, before: t.status, after: t.status, note: "Nothing to reconcile" }); continue; }
            const stale = t.status === "UNKNOWN" || (t.status === "SENDING" && minutes(t) >= SENDING_STALE_MINUTES) || (t.status === "PROCESSING" && minutes(t) >= PROCESSING_STALE_MINUTES);
            if (!one && !stale) continue;
            try {
                const v = await d.transferProvider.verifyTransfer(t.reference);
                const info = { source: "reconcile" as const, schoolId, actorUserId, transferCode: v.transferCode, reason: v.failureReason ?? null };
                if (v.state === "success" || v.state === "failed" || v.state === "reversed") {
                    const r = await d.transferOutcomeService.apply(t.id, v.state, info);
                    results.push({ id: t.id, before: t.status, after: r.status });
                } else if (v.state === "not_found") {
                    if (minutes(t) >= NOT_FOUND_TRUST_MINUTES) {
                        const r = await d.transferOutcomeService.apply(t.id, "failed", { ...info, reason: "The provider has no record of this transfer, so it was never sent" });
                        results.push({ id: t.id, before: t.status, after: r.status });
                    } else results.push({ id: t.id, before: t.status, after: t.status, note: "The provider has no record yet. Checked again later" });
                } else {
                    if (v.transferCode && !t.transferCode) await d.salaryTransferRepository.update(t.id, [t.status], { transferCode: v.transferCode });
                    results.push({ id: t.id, before: t.status, after: t.status, note: "Still moving at the provider" });
                }
            } catch (e) {
                results.push({ id: t.id, before: t.status, after: t.status, note: `Could not check: ${e instanceof Error ? e.message : "error"}` });
            }
        }
        await d.auditService.log({ userId: actorUserId, schoolId, action: "payroll.transfers.reconciled", entity: "SalaryTransfer", entityId: dto.transferId ?? "all", newValue: { checked: results.length, changed: results.filter(r => r.before !== r.after).length } });
        return { checked: results.length, changed: results.filter(r => r.before !== r.after).length, results };
    }
}

/* RETRY a FAILED or REVERSED transfer as a NEW attempt (new reference). Never while the payslip has another live transfer. */
export class RetryTransferUseCase {
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: Options = {}) { this.transaction = options.transaction ?? defaultTransaction; }

    async execute(id: string, schoolId: string, actorUserId: string, dto: RetryTransferDtoType = {}) {
        const d = this.d;
        await assertEnabled(d);
        const t = await d.salaryTransferRepository.findById(id);
        if (!t) throw transferErrors.notFound();
        if (t.status !== "FAILED" && t.status !== "REVERSED") throw transferErrors.notRetryable(t.status);
        const run = await loadRun(d, t.runId);
        if (run.status !== "APPROVED" && run.status !== "PAID") throw transferErrors.runNotApproved(run.status);
        await assertNotApprover(d, run, actorUserId);
        if ((await d.salaryTransferRepository.payslipsWithLiveTransfer([t.payslipId])).size > 0) throw transferErrors.alreadyLive();

        let bank = { bankCode: t.bankCode, bankName: t.bankName, accountName: t.accountName, accountNumberEncrypted: t.accountNumberEncrypted, accountLast4: t.accountLast4 };
        if (dto.useCurrentBankDetails) {
            const b = await d.salaryTransferRepository.payoutDetails(t.staffId, lastDayOfMonth(run.periodYear, run.periodMonth));
            if (!b?.bankCode || !b.accountNumberEncrypted || !b.accountName || !b.accountLast4) throw transferErrors.accountInvalid("The pay profile has no bank details");
            bank = { bankCode: b.bankCode, bankName: b.bankName, accountName: b.accountName, accountNumberEncrypted: b.accountNumberEncrypted, accountLast4: b.accountLast4 };
        }
        const attempt = (await d.salaryTransferRepository.lastAttempt(t.payslipId)) + 1;
        const row: NewSalaryTransfer = {
            id: randomUUID(), runId: t.runId, payslipId: t.payslipId, staffId: t.staffId, attempt, reference: buildReference(schoolId, randomBytes(6).toString("hex"), attempt),
            amountKobo: t.amountKobo, ...bank, fromAccountId: t.fromAccountId, initiatedById: actorUserId,
        };
        await this.transaction(() => d.salaryTransferRepository.insertMany([row]));
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "payroll.transfer.retried", entity: "SalaryTransfer", entityId: row.id,
            oldValue: { previous: t.id, status: t.status, reason: t.failureReason }, newValue: { attempt, reference: row.reference, usedCurrentBankDetails: !!dto.useCurrentBankDetails },
        });
        return d.transferMapper.toResponse((await d.salaryTransferRepository.findById(row.id))!);
    }
}

/* CANCEL a transfer that was started but not sent. */
export class CancelTransferUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string, schoolId: string, actorUserId: string) {
        const d = this.d;
        const t = await d.salaryTransferRepository.findById(id);
        if (!t) throw transferErrors.notFound();
        if (t.status !== "PENDING") throw transferErrors.notCancellable(t.status);
        if (!(await d.salaryTransferRepository.update(id, ["PENDING"], { status: "CANCELLED" }))) throw transferErrors.changed();
        await d.auditService.log({ userId: actorUserId, schoolId, action: "payroll.transfer.cancelled", entity: "SalaryTransfer", entityId: id, oldValue: { status: "PENDING" }, newValue: { status: "CANCELLED", reference: t.reference } });
        return d.transferMapper.toResponse((await d.salaryTransferRepository.findById(id))!);
    }
}

export class GetRunTransfersUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(runId: string) {
        const ts = await this.d.salaryTransferRepository.listByRun(runId);
        return { transfers: ts.map(t => this.d.transferMapper.toResponse(t)), summary: this.d.transferMapper.summary(ts) };
    }
}

export class ListTransfersUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListTransfersQueryType) {
        const r = await this.d.salaryTransferRepository.list({ status: q.status, runId: q.runId }, q.page, q.limit);
        return { data: r.rows.map(t => this.d.transferMapper.toResponse(t)), meta: { page: q.page, limit: q.limit, total: r.total } };
    }
}

/* A provider event (signed webhook) for one of our transfers: found by reference, applied through the same outcome service as everything else. */
export class HandleTransferEventUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, type: string, data: { reference?: string; transfer_code?: string; reason?: string }) {
        const d = this.d;
        const outcome = type === "transfer.success" ? "success" : type === "transfer.failed" ? "failed" : type === "transfer.reversed" ? "reversed" : null;
        if (!outcome || !data.reference) return { handled: false };
        const t = await d.salaryTransferRepository.findByReference(data.reference);
        if (!t) return { handled: false };
        const r = await d.transferOutcomeService.apply(t.id, outcome, { source: "webhook", schoolId, actorUserId: null, transferCode: data.transfer_code ?? null, reason: data.reason ?? null });
        return { handled: true, ...r };
    }
}
