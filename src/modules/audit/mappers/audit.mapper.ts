import { IMapper }        from "../../../infrastructure/repository/base.repository";
import { AuditLogEntity } from "../domain/audit.entity";

export interface AuditLogResponseData {
    id:        string;
    userId:    string | null;
    schoolId:  string | null;
    actorType: string;
    action:    string;
    entity:    string;
    entityId:  string | null;
    oldValue:  any | null;
    newValue:  any | null;
    ipAddress: string | null;
    metadata:  any | null;
    createdAt: Date;
}

export class AuditMapper implements IMapper<any, AuditLogEntity> {

    toDomain(raw: any): AuditLogEntity {
        return {
            id:        raw.id,
            userId:    raw.userId    ?? null,
            schoolId:  raw.schoolId  ?? null,
            actorType: raw.actorType,
            action:    raw.action,
            entity:    raw.entity,
            entityId:  raw.entityId  ?? null,
            oldValue:  raw.oldValue  ?? null,
            newValue:  raw.newValue  ?? null,
            ipAddress: raw.ipAddress ?? null,
            userAgent: raw.userAgent ?? null,
            metadata:  raw.metadata  ?? null,
            createdAt: raw.createdAt,
        };
    }

    toResponse(entity: AuditLogEntity): AuditLogResponseData {
        return {
            id:        entity.id,
            userId:    entity.userId,
            schoolId:  entity.schoolId,
            actorType: entity.actorType,
            action:    entity.action,
            entity:    entity.entity,
            entityId:  entity.entityId,
            oldValue:  entity.oldValue,
            newValue:  entity.newValue,
            ipAddress: entity.ipAddress,
            metadata:  entity.metadata,
            createdAt: entity.createdAt,
        };
    }
}