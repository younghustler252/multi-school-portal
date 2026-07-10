import { IMapper }             from "../../../infrastructure/repository/base.repository";
import { AttendanceEntity }    from "../domain/attendance.entity";

/*
|--------------------------------------------------------------------------
| ATTENDANCE MAPPER
|--------------------------------------------------------------------------
*/

export interface AttendanceResponseData {
    id:        string;
    studentId: string;
    termId:    string;
    date:      Date;
    status:    string;
    note:      string | null;
    createdAt: Date;
}

export interface AttendanceSummary {
    studentId:  string;
    termId:     string;
    total:      number;
    present:    number;
    absent:     number;
    late:       number;
    excused:    number;
    percentage: number;
}

export class AttendanceMapper implements IMapper<any, AttendanceEntity> {

    toDomain(raw: any): AttendanceEntity {
        return {
            id:        raw.id,
            studentId: raw.studentId,
            termId:    raw.termId,
            date:      raw.date,
            status:    raw.status,
            note:      raw.note      ?? null,
            createdAt: raw.createdAt,
        };
    }

    toResponse(entity: AttendanceEntity): AttendanceResponseData {
        return {
            id:        entity.id,
            studentId: entity.studentId,
            termId:    entity.termId,
            date:      entity.date,
            status:    entity.status,
            note:      entity.note,
            createdAt: entity.createdAt,
        };
    }
}