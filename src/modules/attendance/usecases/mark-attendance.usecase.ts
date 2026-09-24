import { IAttendanceRepository } from "../repositories/attendance.repository";
import { IStaffRepository }      from "../../staff/repositories/staff.repository";
import { IClassRepository }      from "../../classes/repositories/class.repository";
import { AttendanceMapper }      from "../mappers/attendance.mapper";
import { AttendanceResponseData } from "../mappers/attendance.mapper";
import {
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from "../../../shared/errors/domain.errors";
import { AttendanceErrorMessage } from "../domain/attendance.enums";
import { MarkAttendanceDtoType } from "../dtos/attendance.dto";
import { Role } from "../../../generated/public";

interface Dependencies {
    attendanceRepository: IAttendanceRepository;
    staffRepository:      IStaffRepository;
    classRepository:      IClassRepository;
    attendanceMapper:     AttendanceMapper;
}

export class MarkAttendanceUseCase {
    private readonly attendanceRepository: IAttendanceRepository;
    private readonly staffRepository:      IStaffRepository;
    private readonly classRepository:      IClassRepository;
    private readonly attendanceMapper:     AttendanceMapper;

    constructor({
        attendanceRepository,
        staffRepository,
        classRepository,
        attendanceMapper,
    }: Dependencies) {
        this.attendanceRepository = attendanceRepository;
        this.staffRepository      = staffRepository;
        this.classRepository      = classRepository;
        this.attendanceMapper     = attendanceMapper;
    }

    async execute(
        dto: MarkAttendanceDtoType,
        classId: string,
        requestingUserId: string,
        requestingUserRole: string,
    ): Promise<AttendanceResponseData> {
        const staff = await this.staffRepository.findByUserId(
            requestingUserId,
        );

        if (!staff) {
            throw new NotFoundError(
                "Staff record not found for this account",
            );
        }

        if (requestingUserRole === Role.teacher) {
            await this.assertCanMarkAttendance(
                staff.id,
                classId,
                dto.termId,
            );
        }

        const date = new Date(dto.date);

        const existing =
            await this.attendanceRepository.findByStudentAndDate(
                dto.studentId,
                date,
            );

        if (existing) {
            throw new ConflictError(
                AttendanceErrorMessage.ALREADY_MARKED,
            );
        }

        const attendance = await this.attendanceRepository.create({
            studentId: dto.studentId,
            termId: dto.termId,
            date,
            status: dto.status,
            note: dto.note,
        });

        return this.attendanceMapper.toResponse(attendance);
    }

    private async assertCanMarkAttendance(
        staffId: string,
        classId: string,
        termId: string,
    ): Promise<void> {
        const cls = await this.classRepository.findClassById(classId);

        if (cls?.classTeacherId === staffId) {
            return;
        }

        const assignments =
            await this.classRepository.findClassSubjects(
                classId,
                termId,
            );

        const isSubjectTeacher = assignments.some(
            a => a.staffId === staffId,
        );

        if (isSubjectTeacher) {
            return;
        }

        throw new ForbiddenError(
            "You are not assigned to this class.",
        );
    }
}
