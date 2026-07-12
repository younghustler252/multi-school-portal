import { IMapper }              from "../../../infrastructure/repository/base.repository";
import {
    GradeEntity,
    GradingConfigEntity,
}                               from "../domain/grade.entity";

/*
|--------------------------------------------------------------------------
| GRADE MAPPER
|--------------------------------------------------------------------------
*/

export interface GradeResponseData {
    id:             string;
    studentId:      string;
    termId:         string;
    classSubjectId: string;
    caScore:        number | null;
    examScore:      number | null;
    total:          number | null;
    grade:          string | null;
    remark:         string | null;
    position:       number | null;
    totalStudents:  number | null;
    isPublished:    boolean;
    createdAt:      Date;
}

export interface GradingConfigResponseData {
    id:        string;
    minScore:  number;
    maxScore:  number;
    grade:     string;
    remark:    string;
    isDefault: boolean;
}

export class GradeMapper implements IMapper<any, GradeEntity> {

    toDomain(raw: any): GradeEntity {
        return {
            id:             raw.id,
            studentId:      raw.studentId,
            termId:         raw.termId,
            classSubjectId: raw.classSubjectId,
            caScore:        raw.caScore        ?? null,
            examScore:      raw.examScore      ?? null,
            total:          raw.total          ?? null,
            grade:          raw.grade          ?? null,
            remark:         raw.remark         ?? null,
            position:       raw.position       ?? null,
            totalStudents:  raw.totalStudents  ?? null,
            isPublished:    raw.isPublished,
            createdAt:      raw.createdAt,
            updatedAt:      raw.updatedAt,
        };
    }

    toResponse(entity: GradeEntity): GradeResponseData {
        return {
            id:             entity.id,
            studentId:      entity.studentId,
            termId:         entity.termId,
            classSubjectId: entity.classSubjectId,
            caScore:        entity.caScore,
            examScore:      entity.examScore,
            total:          entity.total,
            grade:          entity.grade,
            remark:         entity.remark,
            position:       entity.position,
            totalStudents:  entity.totalStudents,
            isPublished:    entity.isPublished,
            createdAt:      entity.createdAt,
        };
    }
}

export class GradingConfigMapper
    implements IMapper<any, GradingConfigEntity>
{
    toDomain(raw: any): GradingConfigEntity {
        return {
            id:        raw.id,
            minScore:  raw.minScore,
            maxScore:  raw.maxScore,
            grade:     raw.grade,
            remark:    raw.remark,
            isDefault: raw.isDefault,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        };
    }

    toResponse(entity: GradingConfigEntity): GradingConfigResponseData {
        return {
            id:        entity.id,
            minScore:  entity.minScore,
            maxScore:  entity.maxScore,
            grade:     entity.grade,
            remark:    entity.remark,
            isDefault: entity.isDefault,
        };
    }
}