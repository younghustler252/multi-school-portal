import { IAttendanceRepository }      from "../repositories/attendance.repository";
import { AttendanceMapper }           from "../mappers/attendance.mapper";
import { AttendanceResponseData }     from "../mappers/attendance.mapper";
import { BulkMarkAttendanceDtoType }  from "../dtos/attendance.dto";

/*
|--------------------------------------------------------------------------
| BULK MARK ATTENDANCE USE CASE
| Mark or Update attendance for an entire class at once
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
            try {
                const existing = await this.attendanceRepository
                    .findByStudentAndDate(record.studentId, date);

                let attendance;

                if (existing) {
                    // ── UPDATE EXISTING RECORD ─────────────────────────────────────
                    // If the record exists, update its status and note field
                    attendance = await this.attendanceRepository.update(existing.id, {
                        status: record.status,
                        note:   record.note,
                    });
                } else {
                    // ── CREATE NEW RECORD ──────────────────────────────────────────
                    attendance = await this.attendanceRepository.create({
                        studentId: record.studentId,
                        termId:    dto.termId,
                        date,
                        status:    record.status,
                        note:      record.note,
                    });
                }

                marked.push(this.attendanceMapper.toResponse(attendance));
            } catch (err) {
                // Safely track failures if a specific row operation crashes
                skipped.push(record.studentId);
            }
        }

        return { marked, skipped };
    }
}
