import { IMapper }           from "../../../infrastructure/repository/base.repository";
import { EnrolmentEntity }   from "../domain/enrolment.entity";

/*
|--------------------------------------------------------------------------
| ENROLMENT MAPPER
|--------------------------------------------------------------------------
*/

export interface EnrolmentResponseData {
    id:        string;
    studentId: string;
    classId:   string;
    termId:    string;
    status:    string;
    createdAt: Date;
}

export class EnrolmentMapper implements IMapper<any, EnrolmentEntity> {

    toDomain(raw: any): EnrolmentEntity {
        return {
            id:        raw.id,
            studentId: raw.studentId,
            classId:   raw.classId,
            termId:    raw.termId,
            status:    raw.status,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        };
    }

    toResponse(entity: EnrolmentEntity): EnrolmentResponseData {
        return {
            id:        entity.id,
            studentId: entity.studentId,
            classId:   entity.classId,
            termId:    entity.termId,
            status:    entity.status,
            createdAt: entity.createdAt,
        };
    }
}