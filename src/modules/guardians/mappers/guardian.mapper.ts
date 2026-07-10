import { IMapper }           from "../../../infrastructure/repository/base.repository";
import { GuardianEntity }    from "../domain/guardian.entity";

/*
|--------------------------------------------------------------------------
| GUARDIAN MAPPER
|--------------------------------------------------------------------------
*/

export interface GuardianResponseData {
    id:         string;
    userId:     string | null;
    firstName:  string;
    lastName:   string;
    email:      string;
    phone:      string | null;
    occupation: string | null;
    address:    string | null;
    isActive:   boolean;
    createdAt:  Date;
}

export class GuardianMapper implements IMapper<any, GuardianEntity> {

    toDomain(raw: any): GuardianEntity {
        return {
            id:         raw.id,
            userId:     raw.userId     ?? null,
            firstName:  raw.firstName,
            lastName:   raw.lastName,
            email:      raw.email,
            phone:      raw.phone      ?? null,
            occupation: raw.occupation ?? null,
            address:    raw.address    ?? null,
            isActive:   raw.isActive,
            createdAt:  raw.createdAt,
            updatedAt:  raw.updatedAt,
        };
    }

    toResponse(entity: GuardianEntity): GuardianResponseData {
        return {
            id:         entity.id,
            userId:     entity.userId,
            firstName:  entity.firstName,
            lastName:   entity.lastName,
            email:      entity.email,
            phone:      entity.phone,
            occupation: entity.occupation,
            address:    entity.address,
            isActive:   entity.isActive,
            createdAt:  entity.createdAt,
        };
    }
}