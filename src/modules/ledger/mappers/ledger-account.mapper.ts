import type { LedgerAccount } from "../../../generated/tenant";
import { IMapper } from "../../../infrastructure/repository/base.repository";
import { LedgerAccountEntity, LedgerAccountType } from "../domain/ledger.entity";

export class LedgerAccountMapper implements IMapper<LedgerAccount, LedgerAccountEntity> {
    toDomain(raw: LedgerAccount): LedgerAccountEntity {
        return {
            id: raw.id, code: raw.code, name: raw.name, type: raw.type as LedgerAccountType, subtype: raw.subtype,
            systemKey: raw.systemKey, parentId: raw.parentId, isMoneyAccount: raw.isMoneyAccount,
            isActive: raw.isActive, isLocked: raw.isLocked, sortOrder: raw.sortOrder, deletedAt: raw.deletedAt,
        };
    }
}
