import { INotificationRepository } from "../repositories/notification.repository";
import { IStaffRepository }        from "../../staff/repositories/staff.repository";
import { IStudentRepository }      from "../../students/repositories/student.repository";
import { IGuardianRepository }     from "../../guardians/repositories/guardian.repository";

interface Dependencies {
    notificationRepository: INotificationRepository;
    staffRepository:        IStaffRepository;
    studentRepository:      IStudentRepository;
    guardianRepository:     IGuardianRepository;
}



export class MarkAllNotificationsReadUseCase {
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

    async execute(userId: string, role: string): Promise<{ marked: number }> {
        let recipientFilter: { studentId?: string; guardianId?: string; staffId?: string } = {};

        if (role === "student") {
            const student = await this.studentRepository.findByUserId(userId);
            if (!student) return { marked: 0 };
            recipientFilter = { studentId: student.id };
        } else if (role === "guardian") {
            const guardian = await this.guardianRepository.findByUserId(userId);
            if (!guardian) return { marked: 0 };
            recipientFilter = { guardianId: guardian.id };
        } else {
            const staff = await this.staffRepository.findByUserId(userId);
            if (!staff) return { marked: 0 };
            recipientFilter = { staffId: staff.id };
        }

        const marked = await this.notificationRepository.markAllSchoolRecipientsRead(recipientFilter);
        return { marked };
    }
}