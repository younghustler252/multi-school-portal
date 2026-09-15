import { IMapper } from "../../../infrastructure/repository/base.repository";
import { FeeTypeEntity } from "../domain/fee.entity";

export interface FeeTypeResponseData {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
}

export class FeeTypeMapper implements IMapper<any, FeeTypeEntity> {
    toDomain(raw: any): FeeTypeEntity {
        return {
            id: raw.id,
            name: raw.name,
            description: raw.description ?? null,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        };
    }

    toResponse(entity: FeeTypeEntity): FeeTypeResponseData {
        return {
            id: entity.id,
            name: entity.name,
            description: entity.description,
            createdAt: entity.createdAt,
        };
    }
}
