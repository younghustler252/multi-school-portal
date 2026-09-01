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

export class MarkNotificationReadUseCase {
    private readonly notificationRepository: INotificationRepository;

    constructor({ notificationRepository }: Dependencies) {
        this.notificationRepository = notificationRepository;
    }

    async execute(recipientId: string, kind: "school" | "platform"): Promise<void> {
        if (kind === "platform") {
            return this.notificationRepository.markPlatformRecipientRead(recipientId);
        }
        return this.notificationRepository.markSchoolRecipientRead(recipientId);
    }
}
