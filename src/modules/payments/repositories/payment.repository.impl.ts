import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { PaymentMapper, PaymentRow } from "../mappers/payment.mapper";
import { AllocationRow, CreditRow, PaymentEntity, PaymentFilters, ReceiptEntity } from "../domain/payment.entity";
import { IPaymentRepository, NewAllocation } from "./payment.repository";

const WITH_RECEIPT = { receipt: { select: { receiptNumber: true } } };
const WITH_DETAIL = {
    ...WITH_RECEIPT,
    allocations: { orderBy: { createdAt: "asc" }, include: { invoice: { select: { invoiceNumber: true } }, student: { select: { firstName: true, lastName: true } } } },
};
const WAITING = ["PENDING", "AWAITING_CONFIRMATION"];

export class PaymentRepositoryImpl extends BaseTenantRepository<PaymentEntity, PaymentRow> implements IPaymentRepository {
    protected readonly modelName = "payment";

    constructor({ paymentMapper }: { paymentMapper: PaymentMapper }) { super(paymentMapper); this.mapperRef = paymentMapper; }
    private readonly mapperRef: PaymentMapper;

    findById(id: string) { return super.findById(id, WITH_DETAIL); }
    findByReference(reference: string) { return this.findOne({ reference }, WITH_DETAIL); }

    async setGatewayResult(id: string, data: Record<string, any>) { await this.model().update({ where: { id }, data }); }

    async markFailed(id: string, version: number, data: Record<string, any>) {
        const r = await this.model().updateMany({ where: { id, version, status: { in: WAITING } }, data: { ...data, status: "FAILED", version: { increment: 1 } } });
        return r.count === 1;
    }

    findByClientRequestId(clientRequestId: string) { return this.findOne({ clientRequestId }, WITH_DETAIL); }

    list(f: PaymentFilters, page?: number, limit?: number) {
        const where: Record<string, unknown> = {
            ...(f.status && { status: f.status }), ...(f.method && { method: f.method }), ...(f.guardianId && { guardianId: f.guardianId }), ...(f.branchId && { branchId: f.branchId }),
            ...(f.studentId && { allocations: { some: { studentId: f.studentId } } }),
            ...((f.from || f.to) && { paidAt: { ...(f.from && { gte: f.from }), ...(f.to && { lte: f.to }) } }),
        };
        return this.paginate({ page, limit, where, include: WITH_RECEIPT, orderBy: { createdAt: "desc" } });
    }

    createPayment(data: Record<string, any>) { return super.create(data, WITH_DETAIL); }

    // The version and the waiting status in the filter stop two people confirming the same payment at once
    async markConfirmed(id: string, version: number, data: Record<string, any>) {
        const r = await this.model().updateMany({ where: { id, version, status: { in: WAITING } }, data: { ...data, status: "CONFIRMED", version: { increment: 1 } } });
        return r.count === 1;
    }

    async markRejected(id: string, version: number, data: Record<string, any>) {
        const r = await this.model().updateMany({ where: { id, version, status: "AWAITING_CONFIRMATION" }, data: { ...data, status: "FAILED", version: { increment: 1 } } });
        return r.count === 1;
    }

    async addAllocations(rows: NewAllocation[]) {
        if (rows.length === 0) return;
        await this.prisma.paymentAllocation.createMany({ data: rows });
    }

    async createReceipt(data: { receiptNumber: string; paymentId: string; issuedAt: Date; snapshot: unknown }) {
        await this.prisma.receipt.create({ data: data as any });
    }

    async creditRows(studentId: string): Promise<CreditRow[]> {
        const rows = await this.prisma.paymentAllocation.findMany({
            where: { studentId, invoiceId: null, reversedAt: null, payment: { status: "CONFIRMED" } },
            select: { id: true, paymentId: true, amountKobo: true, payment: { select: { receipt: { select: { receiptNumber: true } } } } },
            orderBy: [{ payment: { createdAt: "asc" } }, { createdAt: "asc" }],
        });
        return rows.map(r => ({ allocationId: r.id, paymentId: r.paymentId, receiptNumber: r.payment.receipt?.receiptNumber ?? null, amountKobo: r.amountKobo, availableKobo: r.amountKobo }));
    }

    async invoiceAllocations(invoiceId: string): Promise<AllocationRow[]> {
        return this.prisma.paymentAllocation.findMany({ where: { invoiceId, reversedAt: null }, orderBy: { createdAt: "desc" },
            select: { id: true, paymentId: true, invoiceId: true, studentId: true, amountKobo: true } });
    }

    async allocationsOfPayment(paymentId: string): Promise<AllocationRow[]> {
        return this.prisma.paymentAllocation.findMany({ where: { paymentId, reversedAt: null }, orderBy: { createdAt: "asc" },
            select: { id: true, paymentId: true, invoiceId: true, studentId: true, amountKobo: true } });
    }

    async setAllocationAmount(id: string, amountKobo: bigint) {
        if (amountKobo <= 0n) await this.prisma.paymentAllocation.delete({ where: { id } });
        else await this.prisma.paymentAllocation.update({ where: { id }, data: { amountKobo } });
    }

    async addCredit(paymentId: string, studentId: string, amountKobo: bigint, createdById: string | null) {
        const existing = await this.prisma.paymentAllocation.findFirst({ where: { paymentId, studentId, invoiceId: null, reversedAt: null }, select: { id: true } });
        if (existing) await this.prisma.paymentAllocation.update({ where: { id: existing.id }, data: { amountKobo: { increment: amountKobo } } });
        else await this.prisma.paymentAllocation.create({ data: { paymentId, studentId, invoiceId: null, amountKobo, createdById } });
    }

    async adjustUnallocated(paymentId: string, deltaKobo: bigint) {
        await this.model().update({ where: { id: paymentId }, data: { unallocatedKobo: { increment: deltaKobo } } });
    }

    async reverseAllocations(paymentId: string, when: Date) {
        await this.prisma.paymentAllocation.updateMany({ where: { paymentId, reversedAt: null }, data: { reversedAt: when } });
    }

    async markReversed(id: string, version: number, data: Record<string, any>) {
        const r = await this.model().updateMany({ where: { id, version, status: "CONFIRMED" }, data: { ...data, status: "REVERSED", version: { increment: 1 } } });
        return r.count === 1;
    }

    async findReceipt(paymentId: string): Promise<ReceiptEntity | null> {
        const raw = await this.prisma.receipt.findUnique({ where: { paymentId } });
        return raw ? this.mapperRef.receiptToDomain(raw as any) : null;
    }
}
