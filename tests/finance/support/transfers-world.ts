/*
| An in-memory salary transfers world over the payroll world (real PostingService, real use cases). The provider is a script: each call to
| initiateTransfer takes the next answer from `provider.script` (a state, or a thrown error), and verifyTransfer answers from `provider.remote`.
*/
import { payrollWorld, N } from "./payroll-world";
import { PaymentProviderError } from "../../../src/infrastructure/payments/interfaces/payment.provider.interface";
import { TransferMapper } from "../../../src/modules/payroll-transfers/mappers";
import { TransferOutcomeService } from "../../../src/modules/payroll-transfers/usecases/transfer-outcome.service";
import {
    StartTransfersUseCase, SendTransfersUseCase, ReconcileTransfersUseCase, RetryTransferUseCase, CancelTransferUseCase, GetRunTransfersUseCase, HandleTransferEventUseCase,
} from "../../../src/modules/payroll-transfers/usecases/transfer.usecases";

export { N };
export const code = (c: string) => (e: any) => e.code === c;

type Script = { state: "success" | "failed" | "reversed" | "pending" } | { throw: { definitive: boolean; message: string } };

export function transfersWorld(opts: { enabled?: boolean; settings?: Record<string, any> } = {}) {
    const w: any = payrollWorld();
    const transfers = new Map<string, any>();
    const bank = new Map<string, any>();                  // staffId -> payout details
    let n = 0;
    const clone = (t: any) => ({ ...t });

    const salaryTransferRepository: any = {
        async findById(id: string) { const t = transfers.get(id); return t ? clone(t) : null; },
        async findByReference(ref: string) { const t = [...transfers.values()].find(x => x.reference === ref); return t ? clone(t) : null; },
        async listByRun(runId: string) { return [...transfers.values()].filter(t => t.runId === runId).map(clone); },
        async list(f: any) { const rows = [...transfers.values()].filter(t => (!f.status || t.status === f.status) && (!f.runId || t.runId === f.runId)).map(clone); return { rows, total: rows.length }; },
        async payslipsWithLiveTransfer(ids: string[]) { return new Set([...transfers.values()].filter(t => ids.includes(t.payslipId) && ["PENDING", "SENDING", "PROCESSING", "UNKNOWN", "SUCCESS"].includes(t.status)).map(t => t.payslipId)); },
        async lastAttempt(pid: string) { return Math.max(0, ...[...transfers.values()].filter(t => t.payslipId === pid).map(t => t.attempt)); },
        async hasLiveTransfers(runId: string) { return [...transfers.values()].some(t => t.runId === runId && ["PENDING", "SENDING", "PROCESSING", "UNKNOWN", "SUCCESS"].includes(t.status)); },
        async payoutDetails(staffId: string) { return bank.get(staffId) ?? null; },
        async insertMany(rows: any[]) {
            for (const r of rows) {
                if ([...transfers.values()].some(t => t.payslipId === r.payslipId && ["PENDING", "SENDING", "PROCESSING", "UNKNOWN", "SUCCESS"].includes(t.status))) throw Object.assign(new Error("unique live"), { code: "P2002" });
                transfers.set(r.id, { ...r, status: "PENDING", recipientCode: null, transferCode: null, failureReason: null, sentAt: null, confirmedAt: null, journalId: null, reversalJournalId: null, createdAt: new Date(2026, 9, 1, 10, ++n), updatedAt: new Date(2026, 9, 1, 10, n) });
            }
        },
        async claim(id: string) { const t = transfers.get(id); if (!t || t.status !== "PENDING") return false; Object.assign(t, { status: "SENDING", sentAt: w.now ? w.now() : new Date() }); return true; },
        async update(id: string, from: string[], patch: any) { const t = transfers.get(id); if (!t || !from.includes(t.status)) return false; Object.assign(t, patch); return true; },
        async unsettled() { return [...transfers.values()].filter(t => ["SENDING", "PROCESSING", "UNKNOWN"].includes(t.status)).map(clone); },
    };

    const provider = {
        enabled: opts.enabled ?? true,
        script: [] as Script[],
        calls: [] as any[], recipients: [] as any[],
        remote: new Map<string, any>(),                    // reference -> { state, transferCode, failureReason }
        isEnabled() { return provider.enabled; },
        async createRecipient(p: any) { provider.recipients.push(p); return { recipientCode: `RCP_${provider.recipients.length}` }; },
        async initiateTransfer(p: any) {
            provider.calls.push(p);
            const s = provider.script.shift() ?? { state: "pending" as const };
            if ("throw" in s) throw new PaymentProviderError(s.throw.message, s.throw.definitive);
            return { state: s.state, reference: p.reference, transferCode: `TRF_${provider.calls.length}` };
        },
        async verifyTransfer(ref: string) { return provider.remote.get(ref) ?? { state: "not_found", reference: ref }; },
    };

    const settings = { payrollTransfersEnabled: true, allowSelfApproval: false, transferMaxKobo: 0n, transferBatchMaxKobo: 0n, secondApprovalThresholdKobo: 0n, ...opts.settings };
    const d: any = {
        ...w.d, salaryTransferRepository, transferProvider: provider, transferMapper: new TransferMapper(),
        encryptionService: { encrypt: (s: string) => `enc:${s}`, decrypt: (s: string) => s.replace(/^enc:/, "") },
        financeSettingsService: { get: async () => settings },
    };
    const clockNow = () => new Date("2026-10-20T10:00:00Z");
    const tx = w.books.options.transaction;
    d.transferOutcomeService = new TransferOutcomeService(d, { now: clockNow, transaction: tx });
    w.d.salaryTransferRepository = salaryTransferRepository;      // so the manual pay use case sees it

    const t = {
        w, d, transfers, bank, provider, settings, audit: w.audit,
        start: new StartTransfersUseCase(d, { transaction: tx }), send: new SendTransfersUseCase(d), reconcile: new ReconcileTransfersUseCase(d, { now: clockNow }),
        retry: new RetryTransferUseCase(d, { transaction: tx }), cancel: new CancelTransferUseCase(d), runTransfers: new GetRunTransfersUseCase(d), events: new HandleTransferEventUseCase(d),
        outcome: d.transferOutcomeService as TransferOutcomeService,
        details(staffId: string, over: any = {}) { bank.set(staffId, { profileId: `pf-${staffId}`, bankCode: "058", bankName: "GTBank", accountName: `Acct ${staffId}`, accountNumberEncrypted: `enc:01234567${staffId.length}9`, accountLast4: "4567", ...over }); },
        /** an approved run with two people paid (bank details set for both) */
        async approvedRun() {
            await w.profile("s1", 200_000, { components: [], bankName: "GTB", accountName: "Ada", accountNumber: "0123456789" });
            await w.profile("s2", 100_000, { components: [], bankName: "GTB", accountName: "Bola", accountNumber: "0123456780" });
            t.details("s1"); t.details("s2");
            return w.approved();
        },
        startRun(runId: string, who = "bursar-1") { return t.start.execute(runId, "school-1", who, { fromAccountId: "a-bank" } as any); },
        sendRun(runId: string, who = "bursar-1") { return t.send.execute(runId, "school-1", who); },
        statuses(runId?: string) { return [...transfers.values()].filter(x => !runId || x.runId === runId).map(x => x.status); },
    };
    return t;
}
