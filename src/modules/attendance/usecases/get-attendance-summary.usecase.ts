import { IAttendanceRepository } from "../repositories/attendance.repository";
import { AttendanceSummary }     from "../mappers/attendance.mapper";

/*
|--------------------------------------------------------------------------
| GET ATTENDANCE SUMMARY USE CASE
| Returns attendance statistics for a student in a term
|--------------------------------------------------------------------------
*/

interface Dependencies {
    attendanceRepository: IAttendanceRepository;
}

export class GetAttendanceSummaryUseCase {
    private readonly attendanceRepository: IAttendanceRepository;

    constructor({ attendanceRepository }: Dependencies) {
        this.attendanceRepository = attendanceRepository;
    }

    async execute(
        studentId: string,
        termId:    string,
    ): Promise<AttendanceSummary> {
        const [present, absent, late, excused] = await Promise.all([
            this.attendanceRepository.countByStatus(
                studentId, termId, "present",
            ),
            this.attendanceRepository.countByStatus(
                studentId, termId, "absent",
            ),
            this.attendanceRepository.countByStatus(
                studentId, termId, "late",
            ),
            this.attendanceRepository.countByStatus(
                studentId, termId, "excused",
            ),
        ]);

        const total      = present + absent + late + excused;
        const percentage = total > 0
            ? Math.round(((present + late) / total) * 100)
            : 0;

        return {
            studentId,
            termId,
            total,
            present,
            absent,
            late,
            excused,
            percentage,
        };
    }
}