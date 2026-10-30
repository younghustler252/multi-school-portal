import { IMapper } from "../../../infrastructure/repository/base.repository";
import { koboOut, dayOut } from "../../ledger/mappers/kobo";
import { FeeStructureEntity, FeeStudentType } from "../domain/fee.entity";

export interface FeeStructureRow {
    id: string; name: string; sessionId: string; termId: string; classId: string | null; branchId: string | null;
    studentType: string; dueDate: Date | null; description: string | null; isActive: boolean; createdAt: Date; deletedAt: Date | null;
    items?: { id: string; feeTypeId: string; amountKobo: bigint; sortOrder: number; feeType: { code: string; name: string } }[];
}

export interface FeeStructureResponse {
    id: string; name: string; sessionId: string; termId: string; classId: string | null; branchId: string | null; studentType: string;
    dueDate: string | null; description: string | null; isActive: boolean; totalKobo: number | string;
    items: { id: string; feeTypeId: string; feeTypeCode: string; feeTypeName: string; amountKobo: number | string; sortOrder: number }[];
    createdAt: Date;
}

export class FeeStructureMapper implements IMapper<FeeStructureRow, FeeStructureEntity> {
    toDomain(raw: FeeStructureRow): FeeStructureEntity {
        return {
            id: raw.id, name: raw.name, sessionId: raw.sessionId, termId: raw.termId, classId: raw.classId, branchId: raw.branchId,
            studentType: raw.studentType as FeeStudentType, dueDate: raw.dueDate, description: raw.description, isActive: raw.isActive,
            items: (raw.items ?? []).map(i => ({ id: i.id, feeTypeId: i.feeTypeId, feeTypeCode: i.feeType.code, feeTypeName: i.feeType.name, amountKobo: i.amountKobo, sortOrder: i.sortOrder })),
            createdAt: raw.createdAt, deletedAt: raw.deletedAt,
        };
    }

    toResponse(e: FeeStructureEntity): FeeStructureResponse {
        return {
            id: e.id, name: e.name, sessionId: e.sessionId, termId: e.termId, classId: e.classId, branchId: e.branchId, studentType: e.studentType,
            dueDate: e.dueDate ? dayOut(e.dueDate) : null, description: e.description, isActive: e.isActive,
            totalKobo: koboOut(e.items.reduce((sum, i) => sum + i.amountKobo, 0n)),
            items: e.items.map(i => ({ id: i.id, feeTypeId: i.feeTypeId, feeTypeCode: i.feeTypeCode, feeTypeName: i.feeTypeName, amountKobo: koboOut(i.amountKobo), sortOrder: i.sortOrder })),
            createdAt: e.createdAt,
        };
    }
}
