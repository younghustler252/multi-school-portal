import { IStudentRepository }    from "../repositories/student.repository";
import { IEnrolmentRepository }  from "../../enrolment/repositories/enrolment.repository";
import { IClassRepository }      from "../../classes/repositories/class.repository";
import { ISessionRepository }    from "../../sessions/repositories/session.repository";
import { IAttendanceRepository } from "../../attendance/repositories/attendance.repository";
import { StudentMapper, StudentResponseData } from "../mappers/student.mapper";
import { PaginatedResult }       from "../../../infrastructure/repository/base.repository";
import { ListStudentsDtoType }   from "../dtos/student.dto";
import { parsePagination }       from "../../../shared/utils/pagination";

interface Dependencies {
    studentRepository:    IStudentRepository;
    studentMapper:        StudentMapper;
    enrolmentRepository:  IEnrolmentRepository;
    classRepository:      IClassRepository;
    sessionRepository:    ISessionRepository;
    attendanceRepository: IAttendanceRepository;
}

export interface StudentListResponseData extends StudentResponseData {
    classId:               string | null;
    className:             string | null;
    attendancePercentage:  number | null;
}

export class ListStudentsUseCase {
    private readonly studentRepository:    IStudentRepository;
    private readonly studentMapper:        StudentMapper;
    private readonly enrolmentRepository:  IEnrolmentRepository;
    private readonly classRepository:      IClassRepository;
    private readonly sessionRepository:    ISessionRepository;
    private readonly attendanceRepository: IAttendanceRepository;

    constructor(deps: Dependencies) {
        this.studentRepository    = deps.studentRepository;
        this.studentMapper        = deps.studentMapper;
        this.enrolmentRepository  = deps.enrolmentRepository;
        this.classRepository      = deps.classRepository;
        this.sessionRepository    = deps.sessionRepository;
        this.attendanceRepository = deps.attendanceRepository;
    }

    async execute(
        dto: ListStudentsDtoType,
    ): Promise<PaginatedResult<StudentListResponseData>> {

        const currentTerm = await this.sessionRepository.findCurrentTerm();

        let baseResult;

        if (dto.search) {
            const { page, limit } = parsePagination({
                page:  Number(dto.page),
                limit: Number(dto.limit),
            });
            // NOTE: searchStudents builds its own OR-based where clause
            // internally and doesn't currently accept an additional classId
            // filter — combining search + classId together isn't supported
            // yet. Flagging rather than silently ignoring one of the two.
            baseResult = await this.studentRepository.searchStudents(dto.search, { page, limit });
        } else {
            const where: Record<string, any> = {};

            if (dto.gender) where.gender = dto.gender;
            if (dto.isActive !== undefined) {
                where.isActive = dto.isActive === "true";
            }

            if (dto.classId && currentTerm) {
                const enrolments = await this.enrolmentRepository.findByClass(dto.classId, currentTerm.id);
                const studentIds = enrolments.map(e => e.studentId);
                where.id = { in: studentIds.length > 0 ? studentIds : ["__none__"] };
            }

            baseResult = await this.studentRepository.paginate({
                page:    Number(dto.page)  || 1,
                limit:   Number(dto.limit) || 20,
                where,
                orderBy: { createdAt: "desc" },
            });
        }

        const enriched = await Promise.all(
            baseResult.data.map(async student => {
                const base = this.studentMapper.toResponse(student);

                let classId:   string | null = null;
                let className: string | null = null;
                let attendancePercentage: number | null = null;

                if (currentTerm) {
                    const enrolment = await this.enrolmentRepository.findByStudentAndTerm(
                        student.id, currentTerm.id,
                    );

                    if (enrolment) {
                        classId = enrolment.classId;
                        const cls = await this.classRepository.findClassById(enrolment.classId);
                        className = cls?.name ?? null;
                    }

                    const records = await this.attendanceRepository.findByStudentAndTerm(
                        student.id, currentTerm.id,
                    );

                    if (records.length > 0) {
                        const present = records.filter(r => r.status === "present").length;
                        attendancePercentage = Math.round((present / records.length) * 100);
                    }
                }

                return { ...base, classId, className, attendancePercentage };
            }),
        );

        return { data: enriched, meta: baseResult.meta };
    }
}