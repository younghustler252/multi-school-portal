import { IMapper } from "../../../infrastructure/repository/base.repository";
import {
    ClassEntity,
    SubjectEntity,
    ClassSubjectEntity,
} from "../domain/class.entity";

import {
    ClassResponseData,
    SubjectResponseData,
    ClassSubjectResponseData,
} from "../types/class.types";

/*
|--------------------------------------------------------------------------
| CLASS MAPPER
|--------------------------------------------------------------------------
*/

export class ClassMapper implements IMapper<any, ClassEntity> {
    toDomain(raw: any): ClassEntity {
        return {
            id: raw.id,
            name: raw.name,
            level: raw.level ?? null,
            capacity: raw.capacity ?? null,
            classTeacherId: raw.classTeacherId ?? null,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        };
    }

    toResponse(entity: ClassEntity): ClassResponseData {
        return {
            id: entity.id,
            name: entity.name,
            level: entity.level,
            capacity: entity.capacity,
            classTeacherId: entity.classTeacherId,
            classTeacherName: null,
            studentCount: 0,
            createdAt: entity.createdAt,
        };
    }
}

/*
|--------------------------------------------------------------------------
| SUBJECT MAPPER
|--------------------------------------------------------------------------
*/

export class SubjectMapper implements IMapper<any, SubjectEntity> {
    toDomain(raw: any): SubjectEntity {
        return {
            id: raw.id,
            name: raw.name,
            code: raw.code ?? null,
            description: raw.description ?? null,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        };
    }

    toResponse(entity: SubjectEntity): SubjectResponseData {
        return {
            id: entity.id,
            name: entity.name,
            code: entity.code,
            description: entity.description,
            createdAt: entity.createdAt,
        };
    }
}

/*
|--------------------------------------------------------------------------
| CLASS SUBJECT MAPPER
|--------------------------------------------------------------------------
*/

export class ClassSubjectMapper implements IMapper<any, ClassSubjectEntity> {
    toDomain(raw: any): ClassSubjectEntity {
        return {
            id: raw.id,
            classId: raw.classId,
            subjectId: raw.subjectId,
            staffId: raw.staffId,
            createdAt: raw.createdAt,
        };
    }

    toResponse(entity: ClassSubjectEntity): ClassSubjectResponseData {
        return {
            id: entity.id,
            classId: entity.classId,
            subjectId: entity.subjectId,
            staffId: entity.staffId,
            createdAt: entity.createdAt,
        };
    }
}