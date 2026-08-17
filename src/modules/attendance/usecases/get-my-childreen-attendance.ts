import { IGuardianRepository }    from "../../guardians/repositories/guardian.repository";
import { IAttendanceRepository }  from "../repositories/attendance.repository";
import { AttendanceMapper }       from "../mappers/attendance.mapper";
import { AttendanceResponseData } from "../mappers/attendance.mapper";
import { PaginatedResult }        from "../../../infrastructure/repository/base.repository";
import { ForbiddenError }         from "../../../shared/errors/domain.errors";

interface Dependencies {
    guardianRepository:   IGuardianRepository;
    attendanceRepository: IAttendanceRepository;
    attendanceMapper:     AttendanceMapper;
}

interface MyChildAttendanceParams {
    studentId?: string;
    termId?:    string;
    page?:      number;
    limit?:     number;
}

export class GetMyChildrenAttendanceUseCase {
    private readonly guardianRepository:   IGuardianRepository;
    private readonly attendanceRepository: IAttendanceRepository;
    private readonly attendanceMapper:     AttendanceMapper;

    constructor({ guardianRepository, attendanceRepository, attendanceMapper }: Dependencies) {
        this.guardianRepository   = guardianRepository;
        this.attendanceRepository = attendanceRepository;
        this.attendanceMapper     = attendanceMapper;
    }

    async execute(
        userId: string,
        params: MyChildAttendanceParams,
    ): Promise<PaginatedResult<AttendanceResponseData>> {
        const childIds = await this.guardianRepository.getChildStudentIds(userId);

        if (params.studentId && !childIds.includes(params.studentId)) {
            throw new ForbiddenError("This student is not linked to your account.");
        }

        const where: Record<string, any> = {
            studentId: params.studentId ?? { in: childIds },
        };
        if (params.termId) where.termId = params.termId;

        const result = await this.attendanceRepository.paginate({
            page:  params.page  ?? 1,
            limit: params.limit ?? 50,
            where,
        });

        return {
            data: result.data.map(a => this.attendanceMapper.toResponse(a)),
            meta: result.meta,
        };
    }
}