import { INotificationRepository } from "../repositories/notification.repository";
import { IStudentRepository }      from "../../students/repositories/student.repository";
import { IGuardianRepository }     from "../../guardians/repositories/guardian.repository";
import { IStaffRepository }        from "../../staff/repositories/staff.repository";
import { IUserRepository }         from "../../auth/repositories/user.repository";
import { ChannelRegistry }         from "../../../infrastructure/notifications/channel.registry";

interface Dependencies {
    notificationRepository: INotificationRepository;
    studentRepository:      IStudentRepository;
    guardianRepository:     IGuardianRepository;
    staffRepository:        IStaffRepository;
    userRepository:         IUserRepository;
    channelRegistry:        ChannelRegistry;
}

const TERMINAL_STATUSES = new Set(["SENT", "DELIVERED", "READ", "CANCELLED"]);

export class NotificationDeliveryService {
    private readonly notificationRepository: INotificationRepository;
    private readonly studentRepository:      IStudentRepository;
    private readonly guardianRepository:     IGuardianRepository;
    private readonly staffRepository:        IStaffRepository;
    private readonly userRepository:         IUserRepository;
    private readonly channelRegistry:        ChannelRegistry;

    constructor(deps: Dependencies) {
        this.notificationRepository = deps.notificationRepository;
        this.studentRepository      = deps.studentRepository;
        this.guardianRepository     = deps.guardianRepository;
        this.staffRepository        = deps.staffRepository;
        this.userRepository         = deps.userRepository;
        this.channelRegistry        = deps.channelRegistry;
    }

    async deliverSchoolRecipient(recipientId: string): Promise<void> {
        const recipient = await this.notificationRepository.findSchoolRecipientById(recipientId);
        if (!recipient || TERMINAL_STATUSES.has(recipient.status)) return; // gone, or already delivered — idempotent no-op

        const notification = await this.notificationRepository.findSchoolNotificationById(recipient.notificationId);
        if (!notification) {
            await this.notificationRepository.markSchoolRecipientFailed(recipientId, "Parent notification no longer exists");
            return;
        }

        const contact = await this.resolveSchoolContact(recipient);
        const to = recipient.channel === "EMAIL" ? contact?.email : contact?.phone;

        if (!to) {
            await this.notificationRepository.markSchoolRecipientFailed(
                recipientId,
                `No ${recipient.channel.toLowerCase()} contact on file`,
            );
            return;
        }

        const result = await this.channelRegistry.get(recipient.channel).send({
            recipientId,
            to,
            title:   notification.title,
            message: notification.message,
            type:    notification.type,
            metadata: { firstName: contact?.firstName ?? null },
        });

        if (result.success) {
            await this.notificationRepository.markSchoolRecipientSent(recipientId, result.providerMessageId);
        } else {
            await this.notificationRepository.markSchoolRecipientFailed(recipientId, result.error ?? "Unknown delivery error");
        }
    }

    async deliverPlatformRecipient(recipientId: string): Promise<void> {
        const recipient = await this.notificationRepository.findPlatformRecipientById(recipientId);
        if (!recipient || TERMINAL_STATUSES.has(recipient.status)) return;

        const notification = await this.notificationRepository.findPlatformNotificationById(recipient.notificationId);
        if (!notification) {
            await this.notificationRepository.markPlatformRecipientFailed(recipientId, "Parent notification no longer exists");
            return;
        }

        const adminUser = await this.userRepository.findOne({ schoolId: recipient.schoolId, role: "school_admin" });
        const to = recipient.channel === "EMAIL" ? adminUser?.email : adminUser?.phone;

        if (!to) {
            await this.notificationRepository.markPlatformRecipientFailed(recipientId, "No school admin contact on file");
            return;
        }

        const result = await this.channelRegistry.get(recipient.channel).send({
            recipientId,
            to,
            title:   notification.title,
            message: notification.message,
            type:    notification.type,
            metadata: { firstName: adminUser?.firstName ?? null },
        });

        if (result.success) {
            await this.notificationRepository.markPlatformRecipientSent(recipientId, result.providerMessageId);
        } else {
            await this.notificationRepository.markPlatformRecipientFailed(recipientId, result.error ?? "Unknown delivery error");
        }
    }

    private async resolveSchoolContact(
        recipient: { studentId: string | null; guardianId: string | null; staffId: string | null },
    ): Promise<{ email: string | null; phone: string | null; firstName: string | null } | null> {
        if (recipient.guardianId) {
            const guardian = await this.guardianRepository.findById(recipient.guardianId);
            return guardian
                ? { email: guardian.email ?? null, phone: guardian.phone ?? null, firstName: guardian.firstName }
                : null;
        }

        if (recipient.studentId) {
            const student = await this.studentRepository.findById(recipient.studentId);
            if (!student?.userId) return null;
            const user = await this.userRepository.findById(student.userId);
            return user
                ? { email: user.email ?? null, phone: user.phone ?? null, firstName: user.firstName ?? student.firstName }
                : null;
        }

        if (recipient.staffId) {
            const staff = await this.staffRepository.findById(recipient.staffId);
            if (!staff?.userId) return null;
            const user = await this.userRepository.findById(staff.userId);
            return user ? { email: user.email ?? null, phone: user.phone ?? null, firstName: user.firstName } : null;
        }

        return null;
    }
}