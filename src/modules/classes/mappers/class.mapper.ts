import { IMapper }            from "../../../infrastructure/repository/base.repository";
import {
    ClassEntity,
    SubjectEntity,
    ClassSubjectEntity,
}                             from "../domain/class.entity";

/*
|--------------------------------------------------------------------------
| CLASS MAPPER
|--------------------------------------------------------------------------
*/

export interface ClassResponseData {
    id:        string;
    name:      string;
    level:     string | null;
    capacity:  number | null;
    createdAt: Date;
}

export interface SubjectResponseData {
    id:          string;
    name:        string;
    code:        string | null;
    description: string | null;
    createdAt:   Date;
}

export interface ClassSubjectResponseData {
    id:        string;
    classId:   string;
    subjectId: string;
    staffId:   string;
    createdAt: Date;
}

export class ClassMapper implements IMapper<any, ClassEntity> {
    toDomain(raw: any): ClassEntity {
        return {
            id:        raw.id,
            name:      raw.name,
            level:     raw.level     ?? null,
            capacity:  raw.capacity  ?? null,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        };
    }

    toResponse(entity: ClassEntity): ClassResponseData {
        return {
            id:        entity.id,
            name:      entity.name,
            level:     entity.level,
            capacity:  entity.capacity,
            createdAt: entity.createdAt,
        };
    }
}

export class SubjectMapper implements IMapper<any, SubjectEntity> {
    toDomain(raw: any): SubjectEntity {
        return {
            id:          raw.id,
            name:        raw.name,
            code:        raw.code        ?? null,
            description: raw.description ?? null,
            createdAt:   raw.createdAt,
            updatedAt:   raw.updatedAt,
        };
    }

    toResponse(entity: SubjectEntity): SubjectResponseData {
        return {
            id:          entity.id,
            name:        entity.name,
            code:        entity.code,
            description: entity.description,
            createdAt:   entity.createdAt,
        };
    }
}

export class ClassSubjectMapper implements IMapper<any, ClassSubjectEntity> {
    toDomain(raw: any): ClassSubjectEntity {
        return {
            id:        raw.id,
            classId:   raw.classId,
            subjectId: raw.subjectId,
            staffId:   raw.staffId,
            createdAt: raw.createdAt,
        };
    }

    toResponse(entity: ClassSubjectEntity): ClassSubjectResponseData {
        return {
            id:        entity.id,
            classId:   entity.classId,
            subjectId: entity.subjectId,
            staffId:   entity.staffId,
            createdAt: entity.createdAt,
        };
    }
}