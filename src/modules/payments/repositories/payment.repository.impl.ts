import { Prisma } from "../../../generated/prisma";
import { getTenantClient }       from "../../../infrastructure/database/prisma/prisma.client";
import { PaymentMapper }         from "../mappers/payment.mapper";
import { PaymentEntity }         from "../domain/payment.entity";
import { IPaymentRepository }    from "./payment.repository";
import {
    PaginateParams,
    PaginatedResult,
}                                from "../../../infrastructure/repository/base.repository";
import {
    parsePagination,
    buildPaginationMeta,
}                                from "../../../shared/utils/pagination";

export class PaymentRepositoryImpl implements IPaymentRepository {
    private readonly mapper: PaymentMapper;

    private get db() { return getTenantClient(); }

    constructor({ paymentMapper }: { paymentMapper: PaymentMapper }) {
        this.mapper = paymentMapper;
    }

    async findById(id: string): Promise<PaymentEntity | null> {
        const raw = await this.db.payment.findUnique({ where: { id } });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    async findOne(where: Record<string, any>): Promise<PaymentEntity | null> {
        const raw = await this.db.payment.findFirst({ where });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    async findMany(
        where: Record<string, any> = {},
    ): Promise<PaymentEntity[]> {
        const raws = await this.db.payment.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
        return raws.map(r => this.mapper.toDomain(r));
    }

    async paginate(
        params: PaginateParams,
    ): Promise<PaginatedResult<PaymentEntity>> {
        const { page, limit, skip } = parsePagination({
            page:  params.page,
            limit: params.limit,
        });

        const where   = params.where   ?? {};
        const orderBy = params.orderBy ?? { createdAt: "desc" };

        const [raws, total] = await Promise.all([
            this.db.payment.findMany({ where, skip, take: limit, orderBy }),
            this.db.payment.count({ where }),
        ]);

        return {
            data: raws.map(r => this.mapper.toDomain(r)),
            meta: buildPaginationMeta(total, page, limit),
        };
    }

    async create(data: Prisma.PaymentUncheckedCreateInput): Promise<PaymentEntity> {
        const raw = await this.db.payment.create({ data });
        return this.mapper.toDomain(raw);
    }

    async update(
        id:   string,
        data: Record<string, any>,
    ): Promise<PaymentEntity> {
        const raw = await this.db.payment.update({ where: { id }, data });
        return this.mapper.toDomain(raw);
    }

    async findByReference(reference: string): Promise<PaymentEntity | null> {
        return this.findOne({ reference });
    }

    async findByInvoice(invoiceId: string): Promise<PaymentEntity[]> {
        return this.findMany({ feeInvoiceId: invoiceId });
    }

    async sumPaidByInvoice(invoiceId: string): Promise<number> {
        const payments = await this.db.payment.findMany({
            where: { feeInvoiceId: invoiceId, status: "success" },
            select: { amountKobo: true },
        });
        return payments.reduce((sum, p) => sum + p.amountKobo, 0);
    }
}