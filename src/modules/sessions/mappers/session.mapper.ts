import { IMapper } from "../../../infrastructure/repository/base.repository";
import { SessionEntity, TermEntity } from "../domain/session.entity";

/*
| Responses carry NAMES, not just ids: a term comes with its session ({ id, name }). Terms listed inside a
| session omit it (they would repeat their parent).
*/
export interface SessionRef { id: string; name: string }

export interface TermResponseData {
    id:        string;
    name:      string;
    startDate: Date;
    endDate:   Date;
    isCurrent: boolean;
    createdAt: Date;
    session?:  SessionRef;
}

export interface SessionResponseData {
    id:        string;
    name:      string;
    startDate: Date;
    endDate:   Date;
    isCurrent: boolean;
    createdAt: Date;
    terms:     TermResponseData[];
}

export class TermMapper implements IMapper<any, TermEntity> {
    toDomain(raw: any): TermEntity {
        return {
            id: raw.id, sessionId: raw.sessionId, name: raw.name, startDate: raw.startDate, endDate: raw.endDate,
            isCurrent: raw.isCurrent, createdAt: raw.createdAt, updatedAt: raw.updatedAt,
        };
    }
    toResponse(entity: TermEntity, session?: SessionRef): TermResponseData {
        return {
            id: entity.id, name: entity.name, startDate: entity.startDate, endDate: entity.endDate,
            isCurrent: entity.isCurrent, createdAt: entity.createdAt, ...(session ? { session } : {}),
        };
    }
}

export class SessionMapper implements IMapper<any, SessionEntity> {
    private readonly terms = new TermMapper();

    toDomain(raw: any): SessionEntity {
        return {
            id: raw.id, name: raw.name, startDate: raw.startDate, endDate: raw.endDate, isCurrent: raw.isCurrent,
            createdAt: raw.createdAt, updatedAt: raw.updatedAt,
            terms: raw.terms ? raw.terms.map((t: any) => this.terms.toDomain(t)) : undefined,
        };
    }
    toResponse(entity: SessionEntity): SessionResponseData {
        return {
            id: entity.id, name: entity.name, startDate: entity.startDate, endDate: entity.endDate, isCurrent: entity.isCurrent,
            createdAt: entity.createdAt, terms: (entity.terms ?? []).map(t => this.terms.toResponse(t)),
        };
    }
}
