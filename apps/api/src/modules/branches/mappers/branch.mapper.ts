import { Branch } from "../../../generated/tenant";
import { IMapper } from "../../../infrastructure/repository/base.repository";
import { BranchEntity } from "../domain/branch.entity";

export interface BranchResponseData {
    id: string; name: string; code: string; isMain: boolean;
    address: string | null; city: string | null; state: string | null; phone: string | null; email: string | null;
    principalStaffId: string | null; isActive: boolean; createdAt: Date;
}

export class BranchMapper implements IMapper<Branch, BranchEntity> {
    toDomain(raw: Branch): BranchEntity {
        return {
            id: raw.id, name: raw.name, code: raw.code, isMain: raw.isMain, address: raw.address, city: raw.city, state: raw.state,
            phone: raw.phone, email: raw.email, principalStaffId: raw.principalStaffId, isActive: raw.isActive,
            deletedAt: raw.deletedAt, createdAt: raw.createdAt, updatedAt: raw.updatedAt,
        };
    }

    toResponse(e: BranchEntity): BranchResponseData {
        return {
            id: e.id, name: e.name, code: e.code, isMain: e.isMain, address: e.address, city: e.city, state: e.state,
            phone: e.phone, email: e.email, principalStaffId: e.principalStaffId, isActive: e.isActive, createdAt: e.createdAt,
        };
    }
}
