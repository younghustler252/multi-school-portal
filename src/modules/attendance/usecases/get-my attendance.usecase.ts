import { IStudentRepository }     from "../../students/repositories/student.repository";
import { IAttendanceRepository }  from "../repositories/attendance.repository";
import { AttendanceMapper }       from "../mappers/attendance.mapper";
import { AttendanceResponseData } from "../mappers/attendance.mapper";
import { PaginatedResult }        from "../../../infrastructure/repository/base.repository";
import { NotFoundError }          from "../../../shared/errors/domain.errors";
import { StudentErrorMessage }    from "../../students/domain/student.enums";

interface Dependencies {
    studentRepository:    IStudentRepository;
    attendanceRepository: IAttendanceRepository;
    attendanceMapper:     AttendanceMapper;
}

interface MyAttendanceParams {
    termId?: string;
    page?:   number;
    limit?:  number;
}

export class GetMyAttendanceUseCase {
    private readonly studentRepository:    IStudentRepository;
    private readonly attendanceRepository: IAttendanceRepository;
    private readonly attendanceMapper:     AttendanceMapper;

    constructor({ studentRepository, attendanceRepository, attendanceMapper }: Dependencies) {
        this.studentRepository    = studentRepository;
        this.attendanceRepository = attendanceRepository;
        this.attendanceMapper     = attendanceMapper;
    }

    async execute(
        userId: string,
        params: MyAttendanceParams,
    ): Promise<PaginatedResult<AttendanceResponseData>> {
        const student = await this.studentRepository.findByUserId(userId);

        if (!student) {
            throw new NotFoundError(StudentErrorMessage.NOT_FOUND);
        }

        const where: Record<string, any> = { studentId: student.id };
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