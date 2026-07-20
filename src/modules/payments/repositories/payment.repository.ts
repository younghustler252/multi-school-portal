import { PaymentEntity }     from "../domain/payment.entity";
import {
    PaginatedResult,
    PaginateParams,
}                            from "../../../infrastructure/repository/base.repository";

export interface IPaymentRepository {
    findById(id: string):                           Promise<PaymentEntity | null>;
    findOne(where: Record<string, any>):            Promise<PaymentEntity | null>;
    findMany(where?: Record<string, any>):          Promise<PaymentEntity[]>;
    paginate(params: PaginateParams):               Promise<PaginatedResult<PaymentEntity>>;
    create(data: Record<string, any>):              Promise<PaymentEntity>;
    update(id: string, data: Record<string, any>):  Promise<PaymentEntity>;
    findByReference(reference: string):             Promise<PaymentEntity | null>;
    findByInvoice(invoiceId: string):               Promise<PaymentEntity[]>;
    sumPaidByInvoice(invoiceId: string):            Promise<number>;
}