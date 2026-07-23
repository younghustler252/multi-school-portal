import { IMapper }         from "../../../infrastructure/repository/base.repository";
import {
    SessionEntity,
    TermEntity,
}                          from "../domain/session.entity";

export interface SessionResponseData {
    id:        string;
    name:      string;
    startDate: Date;
    endDate:   Date;
    isCurrent: boolean;
    createdAt: Date;
    terms?:    TermResponseData[];
}

export interface TermResponseData {
    id:        string;
    sessionId: string;
    name:      string;
    startDate: Date;
    endDate:   Date;
    isCurrent: boolean;
    createdAt: Date;
}

export class SessionMapper implements IMapper<any, SessionEntity> {
    toDomain(raw: any): SessionEntity {
        return {
            id:        raw.id,
            name:      raw.name,
            startDate: raw.startDate,
            endDate:   raw.endDate,
            isCurrent: raw.isCurrent,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
            terms:     raw.terms?.map((t: any) => new TermMapper().toDomain(t)),
        };
    }

    toResponse(entity: SessionEntity): SessionResponseData {
        return {
            id:        entity.id,
            name:      entity.name,
            startDate: entity.startDate,
            endDate:   entity.endDate,
            isCurrent: entity.isCurrent,
            createdAt: entity.createdAt,
            terms:     entity.terms?.map(t => new TermMapper().toResponse(t)),
        };
    }
}

export class TermMapper implements IMapper<any, TermEntity> {
    toDomain(raw: any): TermEntity {
        return {
            id:        raw.id,
            sessionId: raw.sessionId,
            name:      raw.name,
            startDate: raw.startDate,
            endDate:   raw.endDate,
            isCurrent: raw.isCurrent,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        };
    }

    toResponse(entity: TermEntity): TermResponseData {
        return {
            id:        entity.id,
            sessionId: entity.sessionId,
            name:      entity.name,
            startDate: entity.startDate,
            endDate:   entity.endDate,
            isCurrent: entity.isCurrent,
            createdAt: entity.createdAt,
        };
    }
}