import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { NewSettlement, NewSettlementItem, OnlinePaymentFacts, SettlementEntity, SettlementItemEntity } from "../domain/settlement.entity";
import { ISettlementRepository, Page } from "./settlement.repository";

/* GATEWAY SETTLEMENT QUERIES. SQL on the tenant client (the open transaction when there is one); every amount goes through big(). */
const big = (v: unknown): bigint => (typeof v === "bigint" ? v : BigInt(String(v)));
const day = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

const paymentOf = (r: any): OnlinePaymentFacts => ({
    id: r.id, reference: r.reference, gatewayReference: r.gatewayReference, amountKobo: big(r.amountKobo), status: r.status,
    reversed: r.reversedAt !== null && r.reversedAt !== undefined, settled: !!r.settled,
    paidAt: r.paidAt ? new Date(r.paidAt).toISOString() : null, payerName: r.payerName,
});
const PAYMENT_SELECT = `p.id, p.reference, p."gatewayReference", p."amountKobo", p.status::text AS status, p."reversedAt", p."paidAt", p."payerName",
    EXISTS (SELECT 1 FROM "GatewaySettlementItem" i WHERE i."paymentId" = p.id) AS settled`;

const settlementOf = (r: any): SettlementEntity => ({
    id: r.id, provider: r.provider, reference: r.reference, settledOn: day(r.settledOn),
    grossKobo: big(r.grossKobo), feeKobo: big(r.feeKobo), netKobo: big(r.netKobo), accountId: r.accountId, accountName: r.accountName ?? null,
    journalId: r.journalId, journalNumber: r.journalNumber ?? null, itemCount: Number(r.itemCount), note: r.note, recordedById: r.recordedById,
    createdAt: new Date(r.createdAt), reversedAt: r.reversedAt ? new Date(r.reversedAt) : null, reverseReason: r.reverseReason,
});
const SETTLEMENT_SELECT = `s.*, a.name AS "accountName", je.number AS "journalNumber"
    FROM "GatewaySettlement" s JOIN "LedgerAccount" a ON a.id = s."accountId" JOIN "JournalEntry" je ON je.id = s."journalId"`;

export class SettlementRepositoryImpl implements ISettlementRepository {
    private get db() { return getTenantClient(); }

    async findPaymentsByReferences(refs: string[]): Promise<OnlinePaymentFacts[]> {
        if (refs.length === 0) return [];
        const rows = await this.db.$queryRawUnsafe<any[]>(
            `SELECT ${PAYMENT_SELECT} FROM "Payment" p WHERE p.method = 'paystack' AND (p.reference = ANY($1::text[]) OR p."gatewayReference" = ANY($1::text[]))`, refs);
        return rows.map(paymentOf);
    }

    async findPaymentsByIds(ids: string[]): Promise<OnlinePaymentFacts[]> {
        if (ids.length === 0) return [];
        const rows = await this.db.$queryRawUnsafe<any[]>(`SELECT ${PAYMENT_SELECT} FROM "Payment" p WHERE p.method = 'paystack' AND p.id = ANY($1::text[])`, ids);
        return rows.map(paymentOf);
    }

    async listUnsettled(page: number, limit: number) {
        const where = `p.method = 'paystack' AND p.status = 'CONFIRMED' AND p."reversedAt" IS NULL AND NOT EXISTS (SELECT 1 FROM "GatewaySettlementItem" i WHERE i."paymentId" = p.id)`;
        const rows = await this.db.$queryRawUnsafe<any[]>(
            `SELECT ${PAYMENT_SELECT} FROM "Payment" p WHERE ${where} ORDER BY COALESCE(p."paidAt", p."createdAt"), p.id LIMIT $1 OFFSET $2`, limit, (Math.max(1, page) - 1) * limit);
        const [t] = await this.db.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS n, COALESCE(SUM(p."amountKobo"), 0)::text AS total FROM "Payment" p WHERE ${where}`);
        return { rows: rows.map(paymentOf), total: Number(t.n), totalKobo: big(t.total) };
    }

    async clearingBalance(): Promise<bigint> {
        const [r] = await this.db.$queryRawUnsafe<any[]>(
            `SELECT COALESCE(SUM(jl."debitKobo" - jl."creditKobo"), 0)::text AS n FROM "JournalLine" jl JOIN "LedgerAccount" a ON a.id = jl."ledgerAccountId" WHERE a."systemKey" = 'ONLINE_CLEARING'`);
        return big(r.n);
    }

    async findByReference(provider: string, reference: string): Promise<SettlementEntity | null> {
        const [r] = await this.db.$queryRawUnsafe<any[]>(`SELECT ${SETTLEMENT_SELECT} WHERE s.provider = $1 AND s.reference = $2`, provider, reference);
        return r ? settlementOf(r) : null;
    }

    async findById(id: string) {
        const [r] = await this.db.$queryRawUnsafe<any[]>(`SELECT ${SETTLEMENT_SELECT} WHERE s.id = $1`, id);
        if (!r) return null;
        const items = await this.db.$queryRawUnsafe<any[]>(
            `SELECT i."paymentId", p.reference, p."payerName", i."amountKobo", i."feeKobo" FROM "GatewaySettlementItem" i JOIN "Payment" p ON p.id = i."paymentId" WHERE i."settlementId" = $1 ORDER BY p."paidAt", p.id`, id);
        return {
            settlement: settlementOf(r),
            items: items.map((x): SettlementItemEntity => ({ paymentId: x.paymentId, reference: x.reference, payerName: x.payerName, amountKobo: big(x.amountKobo), feeKobo: big(x.feeKobo) })),
        };
    }

    async list(page: number, limit: number): Promise<Page<SettlementEntity>> {
        const rows = await this.db.$queryRawUnsafe<any[]>(`SELECT ${SETTLEMENT_SELECT} ORDER BY s."settledOn" DESC, s."createdAt" DESC LIMIT $1 OFFSET $2`, limit, (Math.max(1, page) - 1) * limit);
        const [t] = await this.db.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS n FROM "GatewaySettlement"`);
        return { rows: rows.map(settlementOf), total: Number(t.n) };
    }

    async insert(s: NewSettlement, items: NewSettlementItem[]): Promise<boolean> {
        const taken = await this.db.$queryRawUnsafe<any[]>(`SELECT 1 FROM "GatewaySettlementItem" WHERE "paymentId" = ANY($1::text[]) LIMIT 1`, items.map(i => i.paymentId));
        if (taken.length > 0) return false;
        await this.db.$executeRawUnsafe(
            `INSERT INTO "GatewaySettlement" (id, provider, reference, "settledOn", "grossKobo", "feeKobo", "netKobo", "accountId", "journalId", "itemCount", note, "recordedById")
             VALUES ($1, $2, $3, $4::date, $5::bigint, $6::bigint, $7::bigint, $8, $9, $10::int, $11, $12)`,
            s.id, s.provider, s.reference, s.settledOn, s.grossKobo.toString(), s.feeKobo.toString(), s.netKobo.toString(), s.accountId, s.journalId, items.length, s.note, s.recordedById);
        for (const i of items) {
            await this.db.$executeRawUnsafe(
                `INSERT INTO "GatewaySettlementItem" (id, "settlementId", "paymentId", "amountKobo", "feeKobo") VALUES ($1, $2, $3, $4::bigint, $5::bigint)`,
                i.id, s.id, i.paymentId, i.amountKobo.toString(), i.feeKobo.toString());
        }
        return true;
    }

    async markReversed(id: string, by: string | null, reason: string): Promise<boolean> {
        const n = await this.db.$executeRawUnsafe(
            `UPDATE "GatewaySettlement" SET "reversedAt" = now(), "reversedById" = $2, "reverseReason" = $3 WHERE id = $1 AND "reversedAt" IS NULL`, id, by, reason);
        return Number(n) > 0;
    }

    async releaseItems(settlementId: string): Promise<void> {
        await this.db.$executeRawUnsafe(`DELETE FROM "GatewaySettlementItem" WHERE "settlementId" = $1`, settlementId);
    }
}
