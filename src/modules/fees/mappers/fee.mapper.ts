import { IMapper }           from "../../../infrastructure/repository/base.repository";
import {
    FeeTypeEntity,
    FeeInvoiceEntity,
}                            from "../domain/fee.entity";

export interface FeeTypeResponseData {
    id:          string;
    name:        string;
    description: string | null;
    createdAt:   Date;
}

export interface FeeInvoiceResponseData {
    id:          string;
    studentId:   string;
    termId:      string;
    feeTypeId:   string;
    amountKobo:  number;
    paidKobo:    number;
    balanceKobo: number;
    status:      string;
    dueDate:     Date | null;
    note:        string | null;
    createdAt:   Date;
}

export class FeeTypeMapper implements IMapper<any, FeeTypeEntity> {
    toDomain(raw: any): FeeTypeEntity {
        return {
            id:          raw.id,
            name:        raw.name,
            description: raw.description ?? null,
            createdAt:   raw.createdAt,
            updatedAt:   raw.updatedAt,
        };
    }

    toResponse(entity: FeeTypeEntity): FeeTypeResponseData {
        return {
            id:          entity.id,
            name:        entity.name,
            description: entity.description,
            createdAt:   entity.createdAt,
        };
    }
}

export class FeeInvoiceMapper implements IMapper<any, FeeInvoiceEntity> {
    toDomain(raw: any): FeeInvoiceEntity {
        return {
            id:          raw.id,
            studentId:   raw.studentId,
            termId:      raw.termId,
            feeTypeId:   raw.feeTypeId,
            amountKobo:  raw.amountKobo,
            paidKobo:    raw.paidKobo,
            balanceKobo: raw.balanceKobo,
            status:      raw.status,
            dueDate:     raw.dueDate     ?? null,
            note:        raw.note        ?? null,
            createdAt:   raw.createdAt,
            updatedAt:   raw.updatedAt,
        };
    }

    toResponse(entity: FeeInvoiceEntity): FeeInvoiceResponseData {
        return {
            id:          entity.id,
            studentId:   entity.studentId,
            termId:      entity.termId,
            feeTypeId:   entity.feeTypeId,
            amountKobo:  entity.amountKobo,
            paidKobo:    entity.paidKobo,
            balanceKobo: entity.balanceKobo,
            status:      entity.status,
            dueDate:     entity.dueDate,
            note:        entity.note,
            createdAt:   entity.createdAt,
        };
    }
}