import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { NewSalaryTransfer, SalaryTransferEntity, TransferStatus } from "../domain/transfer.entity";
import { ISalaryTransferRepository, PayoutDetails, TransferPatch } from "./salary-transfer.repository";

/* SALARY TRANSFER QUERIES. SQL on the tenant client; amounts go through big(). The enum column is cast to text on the way out and back in. */
const big = (v: unknown): bigint => (typeof v === "bigint" ? v : BigInt(String(v)));

const COLUMNS = `t.id, t."runId", t."payslipId", t."staffId", t.attempt, t.reference, t."amountKobo", t.status::text AS status, t."bankCode", t."bankName",
    t."accountName", t."accountNumberEncrypted", t."accountLast4", t."recipientCode", t."transferCode", t."fromAccountId", t."failureReason",
    t."initiatedById", t."sentAt", t."confirmedAt", t."journalId", t."reversalJournalId", t."createdAt", t."updatedAt"`;

const entityOf = (r: any): SalaryTransferEntity => ({
    id: r.id, runId: r.runId, payslipId: r.payslipId, staffId: r.staffId, attempt: Number(r.attempt), reference: r.reference, amountKobo: big(r.amountKobo),
    status: r.status as TransferStatus, bankCode: r.bankCode, bankName: r.bankName, accountName: r.accountName, accountNumberEncrypted: r.accountNumberEncrypted,
    accountLast4: r.accountLast4, recipientCode: r.recipientCode, transferCode: r.transferCode, fromAccountId: r.fromAccountId, failureReason: r.failureReason,
    initiatedById: r.initiatedById, sentAt: r.sentAt ? new Date(r.sentAt) : null, confirmedAt: r.confirmedAt ? new Date(r.confirmedAt) : null,
    journalId: r.journalId, reversalJournalId: r.reversalJournalId, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt),
});

const PATCHABLE: Record<keyof TransferPatch, string> = {
    status: `"status" = $N::"SalaryTransferStatus"`, recipientCode: `"recipientCode" = $N`, transferCode: `"transferCode" = $N`, failureReason: `"failureReason" = $N`,
    confirmedAt: `"confirmedAt" = $N`, journalId: `"journalId" = $N`, reversalJournalId: `"reversalJournalId" = $N`,
};

export class SalaryTransferRepositoryImpl implements ISalaryTransferRepository {
    private get db() { return getTenantClient(); }

    async findById(id: string) {
        const [r] = await this.db.$queryRawUnsafe<any[]>(`SELECT ${COLUMNS} FROM "SalaryTransfer" t WHERE t.id = $1`, id);
        return r ? entityOf(r) : null;
    }
    async findByReference(reference: string) {
        const [r] = await this.db.$queryRawUnsafe<any[]>(`SELECT ${COLUMNS} FROM "SalaryTransfer" t WHERE t.reference = $1`, reference);
        return r ? entityOf(r) : null;
    }
    async listByRun(runId: string) {
        const rows = await this.db.$queryRawUnsafe<any[]>(`SELECT ${COLUMNS} FROM "SalaryTransfer" t WHERE t."runId" = $1 ORDER BY t."createdAt", t.id`, runId);
        return rows.map(entityOf);
    }
    async list(f: { status?: TransferStatus; runId?: string }, page: number, limit: number) {
        const where: string[] = [], args: unknown[] = [];
        if (f.status) { args.push(f.status); where.push(`t.status = $${args.length}::"SalaryTransferStatus"`); }
        if (f.runId) { args.push(f.runId); where.push(`t."runId" = $${args.length}`); }
        const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const rows = await this.db.$queryRawUnsafe<any[]>(`SELECT ${COLUMNS} FROM "SalaryTransfer" t ${w} ORDER BY t."createdAt" DESC, t.id LIMIT $${args.length + 1} OFFSET $${args.length + 2}`, ...args, limit, (Math.max(1, page) - 1) * limit);
        const [c] = await this.db.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS n FROM "SalaryTransfer" t ${w}`, ...args);
        return { rows: rows.map(entityOf), total: Number(c.n) };
    }
    async payslipsWithLiveTransfer(payslipIds: string[]) {
        if (payslipIds.length === 0) return new Set<string>();
        const rows = await this.db.$queryRawUnsafe<{ payslipId: string }[]>(
            `SELECT DISTINCT "payslipId" FROM "SalaryTransfer" WHERE "payslipId" = ANY($1::text[]) AND status IN ('PENDING','SENDING','PROCESSING','UNKNOWN','SUCCESS')`, payslipIds);
        return new Set(rows.map(r => r.payslipId));
    }
    async lastAttempt(payslipId: string) {
        const [r] = await this.db.$queryRawUnsafe<any[]>(`SELECT COALESCE(MAX(attempt), 0)::int AS n FROM "SalaryTransfer" WHERE "payslipId" = $1`, payslipId);
        return Number(r.n);
    }
    async hasLiveTransfers(runId: string) {
        const rows = await this.db.$queryRawUnsafe<any[]>(`SELECT 1 FROM "SalaryTransfer" WHERE "runId" = $1 AND status IN ('PENDING','SENDING','PROCESSING','UNKNOWN','SUCCESS') LIMIT 1`, runId);
        return rows.length > 0;
    }
    async payoutDetails(staffId: string, day: string): Promise<PayoutDetails | null> {
        const [r] = await this.db.$queryRawUnsafe<any[]>(
            `SELECT id AS "profileId", "bankCode", "bankName", "accountName", "accountNumberEncrypted", "accountNumberLast4" AS "accountLast4"
               FROM "StaffPayProfile" WHERE "staffId" = $1 AND "isActive" = true AND "effectiveFrom" <= $2::date AND ("effectiveTo" IS NULL OR "effectiveTo" >= $2::date)
              ORDER BY "effectiveFrom" DESC LIMIT 1`, staffId, day);
        return r ?? null;
    }
    async insertMany(rows: NewSalaryTransfer[]) {
        for (const t of rows) {
            await this.db.$executeRawUnsafe(
                `INSERT INTO "SalaryTransfer" (id, "runId", "payslipId", "staffId", attempt, reference, "amountKobo", "bankCode", "bankName", "accountName", "accountNumberEncrypted", "accountLast4", "fromAccountId", "initiatedById", "updatedAt")
                 VALUES ($1,$2,$3,$4,$5::int,$6,$7::bigint,$8,$9,$10,$11,$12,$13,$14, now())`,
                t.id, t.runId, t.payslipId, t.staffId, t.attempt, t.reference, t.amountKobo.toString(), t.bankCode, t.bankName, t.accountName, t.accountNumberEncrypted, t.accountLast4, t.fromAccountId, t.initiatedById);
        }
    }
    async claim(id: string) {
        const n = await this.db.$executeRawUnsafe(`UPDATE "SalaryTransfer" SET status = 'SENDING', "sentAt" = now(), "updatedAt" = now() WHERE id = $1 AND status = 'PENDING'`, id);
        return Number(n) > 0;
    }
    async update(id: string, from: TransferStatus[], patch: TransferPatch) {
        const sets: string[] = [], args: unknown[] = [id, from];
        for (const key of Object.keys(patch) as (keyof TransferPatch)[]) {
            args.push(patch[key] ?? null);
            sets.push(PATCHABLE[key].replace("$N", `$${args.length}`));
        }
        if (sets.length === 0) return true;
        const n = await this.db.$executeRawUnsafe(`UPDATE "SalaryTransfer" SET ${sets.join(", ")}, "updatedAt" = now() WHERE id = $1 AND status::text = ANY($2::text[])`, ...args);
        return Number(n) > 0;
    }
    async unsettled(limit: number) {
        const rows = await this.db.$queryRawUnsafe<any[]>(`SELECT ${COLUMNS} FROM "SalaryTransfer" t WHERE t.status IN ('SENDING','PROCESSING','UNKNOWN') ORDER BY t."updatedAt", t.id LIMIT $1`, limit);
        return rows.map(entityOf);
    }
}
