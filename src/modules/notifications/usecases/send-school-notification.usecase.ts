import { INotificationRepository }        from "../repositories/notification.repository";
import { IStudentRepository }             from "../../students/repositories/student.repository";
import { IGuardianRepository }            from "../../guardians/repositories/guardian.repository";
import { IStaffRepository }               from "../../staff/repositories/staff.repository";
import { IUserRepository }                from "../../auth/repositories/user.repository";
import { SchoolNotificationMapper }       from "../mappers/notification.mapper";
import { SchoolNotificationResponseData } from "../mappers/notification.mapper";
import { SendSchoolNotificationDtoType }  from "../dtos/notification.dto";
import { addNotificationJob }             from "../../../infrastructure/jobs/queues/notification.queue";

interface Dependencies {
    notificationRepository:   INotificationRepository;
    studentRepository:        IStudentRepository;
    guardianRepository:       IGuardianRepository;
    staffRepository:          IStaffRepository;
    userRepository:           IUserRepository;
    schoolNotificationMapper: SchoolNotificationMapper;
}

interface ResolvedRecipient {
    studentId?:  string;
    guardianId?: string;
    staffId?:    string;
    email?:      string | null;
    phone?:      string | null;
}

export class SendSchoolNotificationUseCase {
    private readonly notificationRepository:   INotificationRepository;
    private readonly studentRepository:        IStudentRepository;
    private readonly guardianRepository:       IGuardianRepository;
    private readonly staffRepository:          IStaffRepository;
    private readonly userRepository:           IUserRepository;
    private readonly schoolNotificationMapper: SchoolNotificationMapper;

    constructor(deps: Dependencies) {
        this.notificationRepository   = deps.notificationRepository;
        this.studentRepository        = deps.studentRepository;
        this.guardianRepository       = deps.guardianRepository;
        this.staffRepository          = deps.staffRepository;
        this.userRepository           = deps.userRepository;
        this.schoolNotificationMapper = deps.schoolNotificationMapper;
    }

    async execute(
        dto:     SendSchoolNotificationDtoType,
        staffId: string,
    ): Promise<SchoolNotificationResponseData> {

        const notification = await this.notificationRepository.createSchoolNotification({
            title:      dto.title,
            message:    dto.message,
            type:       dto.type,
            targetType: dto.targetType,
            sentById:   staffId,
            metadata:   dto.metadata,
            sentAt:     new Date(),
        });

        const recipients = await this.resolveRecipients(dto);

        for (const recipient of recipients) {
            for (const channel of dto.channels) {
                await this.notificationRepository.createRecipient({
                    notificationId: notification.id,
                    studentId:      recipient.studentId  ?? null,
                    guardianId:     recipient.guardianId ?? null,
                    staffId:        recipient.staffId    ?? null,
                    channel,
                    status:         "PENDING",
                });

                if (channel === "EMAIL" && recipient.email) {
                    await addNotificationJob({
                        channel: "email",
                        to:      recipient.email,
                        type:    dto.type,
                        payload: {
                            title:   dto.title,
                            message: dto.message,
                            firstName: "there",
                        },
                    });
                }

                if (channel === "SMS" && recipient.phone) {
                    await addNotificationJob({
                        channel: "sms",
                        to:      recipient.phone,
                        type:    dto.type,
                        payload: { message: `${dto.title}: ${dto.message}` },
                    });
                }
                // IN_APP channel needs no queue job — the recipient row
                // created above is the entire delivery mechanism; it's
                // just read directly via GET /notifications/me.
            }
        }

        return this.schoolNotificationMapper.toResponse(notification);
    }

    private async resolveRecipients(dto: SendSchoolNotificationDtoType): Promise<ResolvedRecipient[]> {
        const recipients: ResolvedRecipient[] = [];

        const wantsStudents  = ["STUDENT", "ALL_STUDENTS", "EVERYONE"].includes(dto.targetType);
        const wantsGuardians = ["GUARDIAN", "ALL_PARENTS", "EVERYONE"].includes(dto.targetType);
        const wantsStaff     = ["STAFF", "ALL_STAFF", "EVERYONE"].includes(dto.targetType);

        if (wantsStudents) {
            const students = dto.studentIds && dto.studentIds.length > 0
                ? await this.studentRepository.findMany({ id: { in: dto.studentIds } })
                : await this.studentRepository.findMany({ isActive: true });

            const userIds = students.map(s => s.userId).filter(Boolean) as string[];
            const users = userIds.length > 0
                ? await this.userRepository.findMany({ id: { in: userIds } })
                : [];
            const userById = new Map(users.map(u => [u.id, u]));

            for (const student of students) {
                const user = student.userId ? userById.get(student.userId) : null;
                recipients.push({
                    studentId: student.id,
                    email:     user?.email ?? null,
                    phone:     user?.phone ?? null,
                });
            }
        }

        if (wantsGuardians) {
            const guardians = dto.guardianIds && dto.guardianIds.length > 0
                ? await this.guardianRepository.findMany({ id: { in: dto.guardianIds } })
                : await this.guardianRepository.findMany({ isActive: true });

            for (const guardian of guardians) {
                recipients.push({
                    guardianId: guardian.id,
                    email:      guardian.email,
                    phone:      guardian.phone,
                });
            }
        }

        if (wantsStaff) {
            const staff = dto.staffIds && dto.staffIds.length > 0
                ? await this.staffRepository.findMany({ id: { in: dto.staffIds } })
                : await this.staffRepository.findMany({ isActive: true });

            const userIds = staff.map(s => s.userId);
            const users = userIds.length > 0
                ? await this.userRepository.findMany({ id: { in: userIds } })
                : [];
            const userById = new Map(users.map(u => [u.id, u]));

            for (const s of staff) {
                const user = userById.get(s.userId);
                recipients.push({
                    staffId: s.id,
                    email:   user?.email ?? null,
                    phone:   user?.phone ?? null,
                });
            }
        }

        return recipients;
    }
}