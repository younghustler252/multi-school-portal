import { IMapper }                    from "../../../infrastructure/repository/base.repository";
import {
    PlatformNotificationEntity,
    SchoolNotificationEntity,
}                                     from "../domain/notification.entity";

export interface PlatformNotificationResponseData {
    id:               string;
    title:            string;
    message:          string;
    type:             string;
    state:            string;
    createdByAdminId: string;
    sentAt:           Date | null;
    completedAt:      Date | null;
    createdAt:        Date;
}

export interface SchoolNotificationResponseData {
    id:         string;
    title:      string;
    message:    string;
    type:       string;
    targetType: string;
    sentById:   string;
    sentAt:     Date | null;
    createdAt:  Date;
}

export class PlatformNotificationMapper
    implements IMapper<any, PlatformNotificationEntity>
{
    toDomain(raw: any): PlatformNotificationEntity {
        return {
            id:               raw.id,
            title:            raw.title,
            message:          raw.message,
            type:             raw.type,
            state:            raw.state,
            createdByAdminId: raw.createdByAdminId,
            metadata:         raw.metadata  ?? null,
            sentAt:           raw.sentAt    ?? null,
            completedAt:      raw.completedAt ?? null,
            createdAt:        raw.createdAt,
            updatedAt:        raw.updatedAt,
        };
    }

    toResponse(
        entity: PlatformNotificationEntity,
    ): PlatformNotificationResponseData {
        return {
            id:               entity.id,
            title:            entity.title,
            message:          entity.message,
            type:             entity.type,
            state:            entity.state,
            createdByAdminId: entity.createdByAdminId,
            sentAt:           entity.sentAt,
            completedAt:      entity.completedAt,
            createdAt:        entity.createdAt,
        };
    }
}

export class SchoolNotificationMapper
    implements IMapper<any, SchoolNotificationEntity>
{
    toDomain(raw: any): SchoolNotificationEntity {
        return {
            id:         raw.id,
            title:      raw.title,
            message:    raw.message,
            type:       raw.type,
            targetType: raw.targetType,
            sentById:   raw.sentById,
            metadata:   raw.metadata ?? null,
            sentAt:     raw.sentAt   ?? null,
            createdAt:  raw.createdAt,
            updatedAt:  raw.updatedAt,
        };
    }

    toResponse(
        entity: SchoolNotificationEntity,
    ): SchoolNotificationResponseData {
        return {
            id:         entity.id,
            title:      entity.title,
            message:    entity.message,
            type:       entity.type,
            targetType: entity.targetType,
            sentById:   entity.sentById,
            sentAt:     entity.sentAt,
            createdAt:  entity.createdAt,
        };
    }
}