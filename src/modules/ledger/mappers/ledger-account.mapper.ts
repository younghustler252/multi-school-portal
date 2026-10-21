import type { LedgerAccount } from "../../../generated/tenant";
import { IMapper } from "../../../infrastructure/repository/base.repository";
import { LedgerAccountEntity, LedgerAccountType } from "../domain/ledger.entity";
import { koboOut } from "./kobo";

export interface LedgerAccountResponse {
    id: string; code: string; name: string; type: string; subtype: string; systemKey: string | null; parentId: string | null;
    description: string | null; isMoneyAccount: boolean; bankName: string | null; accountName: string | null; accountNumberLast4: string | null;
    isActive: boolean; isLocked: boolean; sortOrder: number; createdAt: Date;
    balanceKobo?: number | string;          // only when balances were asked for
}

export class LedgerAccountMapper implements IMapper<LedgerAccount, LedgerAccountEntity> {
    toDomain(raw: LedgerAccount): LedgerAccountEntity {
        return {
            id: raw.id, code: raw.code, name: raw.name, type: raw.type as LedgerAccountType, subtype: raw.subtype,
            systemKey: raw.systemKey, parentId: raw.parentId, isMoneyAccount: raw.isMoneyAccount,
            isActive: raw.isActive, isLocked: raw.isLocked, sortOrder: raw.sortOrder,
            description: raw.description, bankName: raw.bankName, accountName: raw.accountName, accountNumberLast4: raw.accountNumberLast4,
            createdAt: raw.createdAt, deletedAt: raw.deletedAt,
        };
    }

    toResponse(e: LedgerAccountEntity, balanceKobo?: bigint): LedgerAccountResponse {
        return {
            id: e.id, code: e.code, name: e.name, type: e.type, subtype: e.subtype, systemKey: e.systemKey, parentId: e.parentId,
            description: e.description, isMoneyAccount: e.isMoneyAccount, bankName: e.bankName, accountName: e.accountName,
            accountNumberLast4: e.accountNumberLast4, isActive: e.isActive, isLocked: e.isLocked, sortOrder: e.sortOrder, createdAt: e.createdAt,
            ...(balanceKobo !== undefined && { balanceKobo: koboOut(balanceKobo) }),
        };
    }
}
