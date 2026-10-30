import { IMapper } from "../../../infrastructure/repository/base.repository";
import { FeeTypeEntity } from "../domain/fee.entity";

// The row as the database returns it (with its income account when included)
export interface FeeTypeRow {
    id: string; code: string; name: string; description: string | null; incomeAccountId: string;
    isRefundable: boolean; isActive: boolean; sortOrder: number; createdAt: Date; deletedAt: Date | null;
    incomeAccount?: { code: string; name: string } | null;
}

export interface FeeTypeResponse {
    id: string; code: string; name: string; description: string | null; isRefundable: boolean; isActive: boolean; sortOrder: number;
    incomeAccount: { id: string; code: string | null; name: string | null }; createdAt: Date;
}

export class FeeTypeMapper implements IMapper<FeeTypeRow, FeeTypeEntity> {
    toDomain(raw: FeeTypeRow): FeeTypeEntity {
        return {
            id: raw.id, code: raw.code, name: raw.name, description: raw.description, incomeAccountId: raw.incomeAccountId,
            incomeAccountCode: raw.incomeAccount?.code ?? null, incomeAccountName: raw.incomeAccount?.name ?? null,
            isRefundable: raw.isRefundable, isActive: raw.isActive, sortOrder: raw.sortOrder, createdAt: raw.createdAt, deletedAt: raw.deletedAt,
        };
    }

    toResponse(e: FeeTypeEntity): FeeTypeResponse {
        return {
            id: e.id, code: e.code, name: e.name, description: e.description, isRefundable: e.isRefundable, isActive: e.isActive, sortOrder: e.sortOrder,
            incomeAccount: { id: e.incomeAccountId, code: e.incomeAccountCode, name: e.incomeAccountName }, createdAt: e.createdAt,
        };
    }
}
