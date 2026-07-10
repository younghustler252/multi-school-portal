import { IAttendanceRepository }    from "../repositories/attendance.repository";
import { AttendanceMapper }         from "../mappers/attendance.mapper";
import { AttendanceResponseData }   from "../mappers/attendance.mapper";
import { NotFoundError }            from "../../../shared/errors/domain.errors";
import { AttendanceErrorMessage }   from "../domain/attendance.enums";
import { UpdateAttendanceDtoType }  from "../dtos/attendance.dto";

/*
|--------------------------------------------------------------------------
| UPDATE ATTENDANCE USE CASE
|--------------------------------------------------------------------------
*/

interface Dependencies {
    attendanceRepository: IAttendanceRepository;
    attendanceMapper:     AttendanceMapper;
}

export class UpdateAttendanceUseCase {
    private readonly attendanceRepository: IAttendanceRepository;
    private readonly attendanceMapper:     AttendanceMapper;

    constructor({ attendanceRepository, attendanceMapper }: Dependencies) {
        this.attendanceRepository = attendanceRepository;
        this.attendanceMapper     = attendanceMapper;
    }

    async execute(
        id:  string,
        dto: UpdateAttendanceDtoType,
    ): Promise<AttendanceResponseData> {
        const attendance = await this.attendanceRepository.findById(id);

        if (!attendance) {
            throw new NotFoundError(AttendanceErrorMessage.NOT_FOUND);
        }

        const updated = await this.attendanceRepository.update(id, dto);
        return this.attendanceMapper.toResponse(updated);
    }
}