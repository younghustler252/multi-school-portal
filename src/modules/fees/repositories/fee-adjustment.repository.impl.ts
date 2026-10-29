import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { FeeAdjustmentMapper, AdjustmentRow } from "../mappers/fee-adjustment.mapper";
import { AdjustmentEntity, AdjustmentFilters } from "../domain/adjustment.entity";
import { IFeeAdjustmentRepository } from "./fee-adjustment.repository";

const WITH_LINKS = { invoice: { select: { invoiceNumber: true, studentId: true, student: { select: { firstName: true, lastName: true } } } }, invoiceItem: { select: { description: true } } };

export class FeeAdjustmentRepositoryImpl extends BaseTenantRepository<AdjustmentEntity, AdjustmentRow> implements IFeeAdjustmentRepository {
    protected readonly modelName = "invoiceAdjustment";

    constructor({ feeAdjustmentMapper }: { feeAdjustmentMapper: FeeAdjustmentMapper }) { super(feeAdjustmentMapper); }

    findById(id: string) { return super.findById(id, WITH_LINKS); }

    list(f: AdjustmentFilters, page?: number, limit?: number) {
        return this.paginate({
            page, limit, include: WITH_LINKS, orderBy: { createdAt: "desc" },
            where: { ...(f.status && { status: f.status }), ...(f.type && { type: f.type }), ...(f.invoiceId && { invoiceId: f.invoiceId }), ...(f.studentId && { invoice: { studentId: f.studentId } }) },
        });
    }

    create(data: Record<string, any>) { return super.create(data, WITH_LINKS); }

    // The status in the filter is what stops two people deciding the same request
    async markDecided(id: string, data: Record<string, any>, status: "APPROVED" | "REJECTED") {
        const r = await this.model().updateMany({ where: { id, status: "PENDING" }, data: { ...data, status } });
        return r.count === 1;
    }

    async recordFirstApproval(id: string, byId: string, at: Date) {
        const r = await this.model().updateMany({ where: { id, status: "PENDING", firstApprovedById: null }, data: { firstApprovedById: byId, firstApprovedAt: at } });
        return r.count === 1;
    }

    async creditedOnItem(invoiceItemId: string): Promise<bigint> {
        const agg = await this.model().aggregate({ where: { invoiceItemId, type: "CREDIT_NOTE", status: "APPROVED" }, _sum: { amountKobo: true } });
        return (agg._sum.amountKobo as bigint | null) ?? 0n;
    }

    countApprovedForInvoice(invoiceId: string): Promise<number> { return this.model().count({ where: { invoiceId, status: "APPROVED" } }); }
}
