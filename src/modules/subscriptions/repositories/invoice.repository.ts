import { PrismaClient } from "../../../generated/public/client";
import { InvoiceEntity, PaymentMethodEntity } from "../domain/subscription.entity";

export const toInvoice = (r: any): InvoiceEntity => ({
    id: r.id, number: r.number, subscriptionId: r.subscriptionId, schoolId: r.schoolId, planId: r.planId, billingCycle: r.billingCycle,
    reason: r.reason, status: r.status, periodStart: r.periodStart, periodEnd: r.periodEnd, subtotalKobo: r.subtotalKobo,
    discountKobo: r.discountKobo, totalKobo: r.totalKobo, amountPaidKobo: r.amountPaidKobo, couponId: r.couponId, dueDate: r.dueDate,
    issuedAt: r.issuedAt, paidAt: r.paidAt, voidedAt: r.voidedAt, attemptCount: r.attemptCount, nextAttemptAt: r.nextAttemptAt,
    lastFailureReason: r.lastFailureReason, note: r.note, createdAt: r.createdAt,
    items: r.items?.map((x: any) => ({ id: x.id, kind: x.kind, description: x.description, amountKobo: x.amountKobo })),
});

export const toPaymentMethod = (r: any): PaymentMethodEntity => ({
    id: r.id, schoolId: r.schoolId, brand: r.brand, last4: r.last4, expMonth: r.expMonth, expYear: r.expYear,
    bank: r.bank, isDefault: r.isDefault, createdAt: r.createdAt,
});

/* Read access to invoices and saved cards. Writes go through the billing services (they need transactions). */
export class InvoiceRepository {
    private readonly prisma: PrismaClient;
    constructor({ prismaClient }: { prismaClient: PrismaClient }) { this.prisma = prismaClient; }

    async findById(id: string): Promise<InvoiceEntity | null> {
        const r = await this.prisma.subscriptionInvoice.findUnique({ where: { id }, include: { items: { orderBy: { createdAt: "asc" } } } });
        return r ? toInvoice(r) : null;
    }

    async findByIdForSchool(id: string, schoolId: string): Promise<InvoiceEntity | null> {
        const r = await this.prisma.subscriptionInvoice.findFirst({ where: { id, schoolId }, include: { items: { orderBy: { createdAt: "asc" } } } });
        return r ? toInvoice(r) : null;
    }

    async findOpenForSubscription(subscriptionId: string): Promise<InvoiceEntity[]> {
        const rows = await this.prisma.subscriptionInvoice.findMany({
            where: { subscriptionId, status: "open" }, orderBy: { dueDate: "asc" }, include: { items: true },
        });
        return rows.map(toInvoice);
    }

    async paginate(where: Record<string, unknown>, page: number, limit: number) {
        const [total, rows] = await Promise.all([
            this.prisma.subscriptionInvoice.count({ where: where as never }),
            this.prisma.subscriptionInvoice.findMany({
                where: where as never, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, include: { items: true },
            }),
        ]);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        return { data: rows.map(toInvoice), meta: { total, page, limit, totalPages, hasNext: page < totalPages, hasPrev: page > 1 } };
    }

    async listMethods(schoolId: string): Promise<PaymentMethodEntity[]> {
        const rows = await this.prisma.paymentMethod.findMany({ where: { schoolId, removedAt: null }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
        return rows.map(toPaymentMethod);
    }
}
