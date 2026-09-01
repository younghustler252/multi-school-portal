import { INotificationRepository } from "../repositories/notification.repository";
import { IStaffRepository }        from "../../staff/repositories/staff.repository";
import { IStudentRepository }      from "../../students/repositories/student.repository";
import { IGuardianRepository }     from "../../guardians/repositories/guardian.repository";
import { PaginatedResult }         from "../../../infrastructure/repository/base.repository";

interface Dependencies {
    notificationRepository: INotificationRepository;
    staffRepository:        IStaffRepository;
    studentRepository:      IStudentRepository;
    guardianRepository:     IGuardianRepository;
}

interface MyNotificationsParams {
    page?:  number;
    limit?: number;
}

export class GetMyNotificationsUseCase {
    private readonly notificationRepository: INotificationRepository;
    private readonly staffRepository:        IStaffRepository;
    private readonly studentRepository:      IStudentRepository;
    private readonly guardianRepository:     IGuardianRepository;

    constructor(deps: Dependencies) {
        this.notificationRepository = deps.notificationRepository;
        this.staffRepository        = deps.staffRepository;
        this.studentRepository      = deps.studentRepository;
        this.guardianRepository     = deps.guardianRepository;
    }

    async execute(
        userId:   string,
        role:     string,
        schoolId: string | null,
        params:   MyNotificationsParams,
    ): Promise<PaginatedResult<any>> {

        if (role === "school_admin" && schoolId) {
            return this.notificationRepository.findMyPlatformNotifications(schoolId, params);
        }

        let recipientFilter: { studentId?: string; guardianId?: string; staffId?: string } = {};

        if (role === "student") {
            const student = await this.studentRepository.findByUserId(userId);
            if (!student) return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false } };
            recipientFilter = { studentId: student.id };
        } else if (role === "guardian") {
            const guardian = await this.guardianRepository.findByUserId(userId);
            if (!guardian) return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false } };
            recipientFilter = { guardianId: guardian.id };
        } else {
            const staff = await this.staffRepository.findByUserId(userId);
            if (!staff) return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false } };
            recipientFilter = { staffId: staff.id };
        }

        return this.notificationRepository.findMySchoolNotifications(recipientFilter, params);
    }
}