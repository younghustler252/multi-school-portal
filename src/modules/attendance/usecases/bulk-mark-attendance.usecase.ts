import { IAttendanceRepository }      from "../repositories/attendance.repository";
import { AttendanceMapper }           from "../mappers/attendance.mapper";
import { AttendanceResponseData }     from "../mappers/attendance.mapper";
import { BulkMarkAttendanceDtoType }  from "../dtos/attendance.dto";

/*
|--------------------------------------------------------------------------
| BULK MARK ATTENDANCE USE CASE
| Mark attendance for an entire class at once
|--------------------------------------------------------------------------
*/

interface Dependencies {
    attendanceRepository: IAttendanceRepository;
    attendanceMapper:     AttendanceMapper;
}

export class BulkMarkAttendanceUseCase {
    private readonly attendanceRepository: IAttendanceRepository;
    private readonly attendanceMapper:     AttendanceMapper;

    constructor({ attendanceRepository, attendanceMapper }: Dependencies) {
        this.attendanceRepository = attendanceRepository;
        this.attendanceMapper     = attendanceMapper;
    }

    async execute(dto: BulkMarkAttendanceDtoType): Promise<{
        marked:   AttendanceResponseData[];
        skipped:  string[];
    }> {
        const date    = new Date(dto.date);
        const marked:  AttendanceResponseData[] = [];
        const skipped: string[]                 = [];

        for (const record of dto.records) {
            // Skip if already marked
            const existing = await this.attendanceRepository
                .findByStudentAndDate(record.studentId, date);

            if (existing) {
                skipped.push(record.studentId);
                continue;
            }

            const attendance = await this.attendanceRepository.create({
                studentId: record.studentId,
                termId:    dto.termId,
                date,
                status:    record.status,
                note:      record.note,
            });

            marked.push(this.attendanceMapper.toResponse(attendance));
        }

        return { marked, skipped };
    }
}