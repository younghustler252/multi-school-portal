import { IMapper } from "../../../infrastructure/repository/base.repository";
import { koboOut } from "../../ledger/mappers/kobo";
import { FeeDiscountRuleEntity, FeeDiscountKind, FeeDiscountType, StudentDiscountEntity } from "../domain/fee.entity";

export interface FeeDiscountRuleRow {
    id: string; name: string; kind: string; type: string; value: bigint; feeTypeId: string | null;
    isActive: boolean; createdAt: Date; deletedAt: Date | null;
}

export interface FeeDiscountRuleResponse {
    id: string; name: string; kind: string; type: string; value: number | string; feeTypeId: string | null; isActive: boolean; createdAt: Date;
}

export class FeeDiscountRuleMapper implements IMapper<FeeDiscountRuleRow, FeeDiscountRuleEntity> {
    toDomain(raw: FeeDiscountRuleRow): FeeDiscountRuleEntity {
        return {
            id: raw.id, name: raw.name, kind: raw.kind as FeeDiscountKind, type: raw.type as FeeDiscountType, value: raw.value,
            feeTypeId: raw.feeTypeId, isActive: raw.isActive, createdAt: raw.createdAt, deletedAt: raw.deletedAt,
        };
    }

    toResponse(e: FeeDiscountRuleEntity): FeeDiscountRuleResponse {
        return { id: e.id, name: e.name, kind: e.kind, type: e.type, value: koboOut(e.value), feeTypeId: e.feeTypeId, isActive: e.isActive, createdAt: e.createdAt };
    }
}

export interface StudentDiscountRow {
    id: string; studentId: string; ruleId: string; sessionId: string | null; note: string | null; createdAt: Date; deletedAt: Date | null;
    rule?: { name: string } | null;
}

export class StudentDiscountMapper implements IMapper<StudentDiscountRow, StudentDiscountEntity> {
    toDomain(raw: StudentDiscountRow): StudentDiscountEntity {
        return { id: raw.id, studentId: raw.studentId, ruleId: raw.ruleId, ruleName: raw.rule?.name ?? null, sessionId: raw.sessionId, note: raw.note, createdAt: raw.createdAt, deletedAt: raw.deletedAt };
    }

    toResponse(e: StudentDiscountEntity) {
        return { id: e.id, studentId: e.studentId, ruleId: e.ruleId, ruleName: e.ruleName, sessionId: e.sessionId, note: e.note, createdAt: e.createdAt };
    }
}
