import { IMapper } from "../../../infrastructure/repository/base.repository";
import {
    ClassEntity,
    SubjectEntity,
    ClassSubjectEntity,
    ClassProgressionEntity,
} from "../domain/class.entity";

import { ClassSubjectAssignmentSource } from "../domain/class.enums";

import {
    ClassResponseData,
    SubjectResponseData,
    ClassSubjectResponseData,
    ClassProgressionResponseData,
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
            defaultTeacherId: raw.defaultTeacherId ?? null,
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
            defaultTeacherId: entity.defaultTeacherId,
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
            termId: raw.termId,
            assignedVia: raw.assignedVia as ClassSubjectAssignmentSource,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        };
    }

    toResponse(entity: ClassSubjectEntity): ClassSubjectResponseData {
        return {
            id: entity.id,
            classId: entity.classId,
            subjectId: entity.subjectId,
            staffId: entity.staffId,
            termId: entity.termId,
            assignedVia: entity.assignedVia,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        };
    }
}

/*
|--------------------------------------------------------------------------
| CLASS PROGRESSION MAPPER
|--------------------------------------------------------------------------
*/

export class ClassProgressionMapper
    implements IMapper<any, ClassProgressionEntity>
{
    toDomain(raw: any): ClassProgressionEntity {
        return {
            id: raw.id,
            fromClassId: raw.fromClassId,
            toClassId: raw.toClassId ?? null,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        };
    }

    toResponse(entity: ClassProgressionEntity): ClassProgressionResponseData {
        return {
            id: entity.id,
            fromClassId: entity.fromClassId,
            fromClassName: "",
            toClassId: entity.toClassId,
            toClassName: null,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        };
    }
}
