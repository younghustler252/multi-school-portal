import { IAttendanceRepository }  from "../repositories/attendance.repository";
import { AttendanceMapper }       from "../mappers/attendance.mapper";
import { AttendanceResponseData } from "../mappers/attendance.mapper";
import { ConflictError }          from "../../../shared/errors/domain.errors";
import { AttendanceErrorMessage } from "../domain/attendance.enums";
import { MarkAttendanceDtoType }  from "../dtos/attendance.dto";

/*
|--------------------------------------------------------------------------
| MARK ATTENDANCE USE CASE
|--------------------------------------------------------------------------
*/

interface Dependencies {
    attendanceRepository: IAttendanceRepository;
    attendanceMapper:     AttendanceMapper;
}

export class MarkAttendanceUseCase {
    private readonly attendanceRepository: IAttendanceRepository;
    private readonly attendanceMapper:     AttendanceMapper;

    constructor({ attendanceRepository, attendanceMapper }: Dependencies) {
        this.attendanceRepository = attendanceRepository;
        this.attendanceMapper     = attendanceMapper;
    }

    async execute(
        dto: MarkAttendanceDtoType,
    ): Promise<AttendanceResponseData> {

        const date = new Date(dto.date);

        // ── Check not already marked ──────────────────────────────────────
        const existing = await this.attendanceRepository
            .findByStudentAndDate(dto.studentId, date);

        if (existing) {
            throw new ConflictError(
                AttendanceErrorMessage.ALREADY_MARKED,
            );
        }

        const attendance = await this.attendanceRepository.create({
            studentId: dto.studentId,
            termId:    dto.termId,
            date,
            status:    dto.status,
            note:      dto.note,
        });

        return this.attendanceMapper.toResponse(attendance);
    }
}