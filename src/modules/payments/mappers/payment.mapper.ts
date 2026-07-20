import { IMapper }        from "../../../infrastructure/repository/base.repository";
import { PaymentEntity }  from "../domain/payment.entity";

export interface PaymentResponseData {
    id:               string;
    feeInvoiceId:     string;
    guardianId:       string | null;
    amountKobo:       number;
    method:           string;
    channel:          string | null;
    reference:        string | null;
    status:           string;
    webhookVerified:  boolean;
    receiptUrl:       string | null;
    paidAt:           Date | null;
    createdAt:        Date;
}

export class PaymentMapper implements IMapper<any, PaymentEntity> {

    toDomain(raw: any): PaymentEntity {
        return {
            id:               raw.id,
            feeInvoiceId:     raw.feeInvoiceId,
            guardianId:       raw.guardianId       ?? null,
            amountKobo:       raw.amountKobo,
            method:           raw.method,
            channel:          raw.channel          ?? null,
            reference:        raw.reference        ?? null,
            status:           raw.status,
            webhookVerified:  raw.webhookVerified,
            providerResponse: raw.providerResponse ?? null,
            receiptUrl:       raw.receiptUrl       ?? null,
            recordedById:     raw.recordedById     ?? null,
            paidAt:           raw.paidAt           ?? null,
            createdAt:        raw.createdAt,
            updatedAt:        raw.updatedAt,
        };
    }

    toResponse(entity: PaymentEntity): PaymentResponseData {
        return {
            id:              entity.id,
            feeInvoiceId:    entity.feeInvoiceId,
            guardianId:      entity.guardianId,
            amountKobo:      entity.amountKobo,
            method:          entity.method,
            channel:         entity.channel,
            reference:       entity.reference,
            status:          entity.status,
            webhookVerified: entity.webhookVerified,
            receiptUrl:      entity.receiptUrl,
            paidAt:          entity.paidAt,
            createdAt:       entity.createdAt,
        };
    }
}