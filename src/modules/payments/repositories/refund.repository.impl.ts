import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { RefundMapper, RefundRow } from "../mappers/refund.mapper";
import { RefundEntity, RefundFilters } from "../domain/payment.entity";
import { IRefundRepository } from "./refund.repository";

const WITH_LINKS = { student: { select: { firstName: true, lastName: true } }, payment: { select: { receipt: { select: { receiptNumber: true } } } } };

export class RefundRepositoryImpl extends BaseTenantRepository<RefundEntity, RefundRow> implements IRefundRepository {
    protected readonly modelName = "refund";

    constructor({ refundMapper }: { refundMapper: RefundMapper }) { super(refundMapper); }

    findById(id: string) { return super.findById(id, WITH_LINKS); }

    list(f: RefundFilters, page?: number, limit?: number) {
        return this.paginate({ page, limit, where: { ...(f.status && { status: f.status }), ...(f.paymentId && { paymentId: f.paymentId }), ...(f.studentId && { studentId: f.studentId }) }, include: WITH_LINKS, orderBy: { createdAt: "desc" } });
    }

    create(data: Record<string, any>) { return super.create(data, WITH_LINKS); }

    // The status in the filter is what stops two people deciding the same refund
    async markDecided(id: string, data: Record<string, any>, status: "APPROVED" | "REJECTED") {
        const r = await this.model().updateMany({ where: { id, status: "REQUESTED" }, data: { ...data, status } });
        return r.count === 1;
    }

    async markPaid(id: string, data: Record<string, any>) {
        const r = await this.model().updateMany({ where: { id, status: "APPROVED" }, data: { ...data, status: "PAID" } });
        return r.count === 1;
    }

    async openAmounts(studentId: string): Promise<Map<string, bigint>> {
        const rows = await this.model().findMany({ where: { studentId, status: { in: ["REQUESTED", "APPROVED"] } }, select: { paymentId: true, amountKobo: true } });
        const out = new Map<string, bigint>();
        for (const r of rows as { paymentId: string; amountKobo: bigint }[]) out.set(r.paymentId, (out.get(r.paymentId) ?? 0n) + r.amountKobo);
        return out;
    }

    async openAmountFor(paymentId: string, studentId: string): Promise<bigint> {
        const agg = await this.model().aggregate({ where: { paymentId, studentId, status: { in: ["REQUESTED", "APPROVED"] } }, _sum: { amountKobo: true } });
        return (agg._sum.amountKobo as bigint | null) ?? 0n;
    }

    countForPayment(paymentId: string): Promise<number> { return this.model().count({ where: { paymentId, status: { not: "REJECTED" } } }); }
}
