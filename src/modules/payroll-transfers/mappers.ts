import { koboOut } from "../ledger/mappers/kobo";
import { SalaryTransferEntity } from "./domain/transfer.entity";

/* The response shape of a transfer. The stored account number never leaves the server: only its last four digits. */
export class TransferMapper {
    toResponse(t: SalaryTransferEntity) {
        return {
            id: t.id, runId: t.runId, payslipId: t.payslipId, staffId: t.staffId, attempt: t.attempt, reference: t.reference,
            amountKobo: koboOut(t.amountKobo), status: t.status, paid: t.status === "SUCCESS",
            bankName: t.bankName, accountName: t.accountName, accountLast4: t.accountLast4, fromAccountId: t.fromAccountId,
            failureReason: t.failureReason, initiatedById: t.initiatedById, sentAt: t.sentAt?.toISOString() ?? null, confirmedAt: t.confirmedAt?.toISOString() ?? null,
            journalId: t.journalId, reversalJournalId: t.reversalJournalId, createdAt: t.createdAt.toISOString(),
            needsAttention: t.status === "UNKNOWN" || t.status === "FAILED" || t.status === "REVERSED",
        };
    }
    summary(ts: SalaryTransferEntity[]) {
        const by: Record<string, { count: number; kobo: bigint }> = {};
        for (const t of ts) { const b = (by[t.status] ??= { count: 0, kobo: 0n }); b.count++; b.kobo += t.amountKobo; }
        return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { count: v.count, totalKobo: koboOut(v.kobo) }]));
    }
}
