import { IAttendanceRepository }  from "../repositories/attendance.repository";
import { AttendanceMapper }       from "../mappers/attendance.mapper";
import { AttendanceResponseData } from "../mappers/attendance.mapper";
import { AttendanceSummary }      from "../mappers/attendance.mapper";
import { PaginatedResult }        from "../../../infrastructure/repository/base.repository";
import { ListAttendanceDtoType }  from "../dtos/attendance.dto";

/*
|--------------------------------------------------------------------------
| GET ATTENDANCE USE CASE
|--------------------------------------------------------------------------
*/

interface Dependencies {
    attendanceRepository: IAttendanceRepository;
    attendanceMapper:     AttendanceMapper;
}

export class GetAttendanceUseCase {
    private readonly attendanceRepository: IAttendanceRepository;
    private readonly attendanceMapper:     AttendanceMapper;

    constructor({ attendanceRepository, attendanceMapper }: Dependencies) {
        this.attendanceRepository = attendanceRepository;
        this.attendanceMapper     = attendanceMapper;
    }

    async execute(
        dto: ListAttendanceDtoType,
    ): Promise<PaginatedResult<AttendanceResponseData>> {
        const where: Record<string, any> = {};

        if (dto.studentId) where.studentId = dto.studentId;
        if (dto.termId)    where.termId    = dto.termId;
        if (dto.status)    where.status    = dto.status;

        if (dto.date) {
            const date = new Date(dto.date);
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            where.date = { gte: startOfDay, lte: endOfDay };
        }

        if (dto.startDate && dto.endDate) {
            where.date = {
                gte: new Date(dto.startDate),
                lte: new Date(dto.endDate),
            };
        }

        const result = await this.attendanceRepository.paginate({
            page:    Number(dto.page)  || 1,
            limit:   Number(dto.limit) || 50,
            where,
            orderBy: { date: "desc" },
        });

        return {
            data: result.data.map(a =>
                this.attendanceMapper.toResponse(a),
            ),
            meta: result.meta,
        };
    }
}