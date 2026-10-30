import { INotificationRepository } from "../repositories/notification.repository";
import { IStudentRepository }      from "../../students/repositories/student.repository";
import { IGuardianRepository }     from "../../guardians/repositories/guardian.repository";
import { IStaffRepository }        from "../../staff/repositories/staff.repository";
import { IUserRepository }         from "../../auth/repositories/user.repository";
import { ChannelRegistry }         from "../../../infrastructure/notifications/channel.registry";
import { RecipientKind }           from "../domain/notification.entity";

interface Dependencies {
    notificationRepository: INotificationRepository;
    studentRepository:      IStudentRepository;
    guardianRepository:     IGuardianRepository;
    staffRepository:        IStaffRepository;
    userRepository:         IUserRepository;
    channelRegistry:        ChannelRegistry;
}

const TERMINAL_STATUSES = new Set(["SENT", "DELIVERED", "READ", "CANCELLED"]);

/**
 * sent          delivered to the provider
 * skipped       nothing to do (already delivered, or the row is gone)
 * undeliverable can never work (no contact on file): recorded, never retried
 * failed        the provider refused or was down: recorded, the worker retries
 */
export type DeliveryOutcome = { outcome: "sent" | "skipped" | "undeliverable" | "failed"; reason?: string };

export class NotificationDeliveryService {
    constructor(private readonly d: Dependencies) {}

    async deliverSchoolRecipient(recipientId: string): Promise<DeliveryOutcome> {
        const recipient = await this.d.notificationRepository.findSchoolRecipientById(recipientId);
        if (!recipient || TERMINAL_STATUSES.has(recipient.status)) return { outcome: "skipped" };   // gone, or already delivered: nothing to do

        const notification = await this.d.notificationRepository.findSchoolNotificationById(recipient.notificationId);
        if (!notification) {
            await this.d.notificationRepository.markSchoolRecipientFailed(recipientId, "Parent notification no longer exists");
            return { outcome: "undeliverable", reason: "Parent notification no longer exists" };
        }

        const contact = await this.resolveSchoolContact(recipient.recipientType, recipient.recipientEntityId);
        const to = recipient.channel === "EMAIL" ? contact?.email : contact?.phone;
        if (!to) {
            const reason = `No ${recipient.channel.toLowerCase()} contact on file`;
            await this.d.notificationRepository.markSchoolRecipientFailed(recipientId, reason);
            return { outcome: "undeliverable", reason };
        }

        const delivery = (notification.metadata?.delivery ?? {}) as { skipGreeting?: boolean; bodyOnly?: boolean };
        const result = await this.d.channelRegistry.get(recipient.channel).send({
            recipientId, to, title: notification.title, message: notification.message, type: notification.type,
            metadata: { firstName: contact?.firstName ?? null, skipGreeting: !!delivery.skipGreeting, bodyOnly: !!delivery.bodyOnly },
        });

        if (result.success) {
            await this.d.notificationRepository.markSchoolRecipientSent(recipientId, result.providerMessageId);
            return { outcome: "sent" };
        }
        const reason = result.error ?? "Unknown delivery error";
        await this.d.notificationRepository.markSchoolRecipientFailed(recipientId, reason);
        return { outcome: "failed", reason };
    }

    async deliverPlatformRecipient(recipientId: string): Promise<DeliveryOutcome> {
        const recipient = await this.d.notificationRepository.findPlatformRecipientById(recipientId);
        if (!recipient || TERMINAL_STATUSES.has(recipient.status)) return { outcome: "skipped" };

        const notification = await this.d.notificationRepository.findPlatformNotificationById(recipient.notificationId);
        if (!notification) {
            await this.d.notificationRepository.markPlatformRecipientFailed(recipientId, "Parent notification no longer exists");
            return { outcome: "undeliverable", reason: "Parent notification no longer exists" };
        }

        const adminUser = await this.d.notificationRepository.findSchoolAdminContact(recipient.schoolId);
        const to = recipient.channel === "EMAIL" ? adminUser?.email : adminUser?.phone;
        if (!to) {
            await this.d.notificationRepository.markPlatformRecipientFailed(recipientId, "No school admin contact on file");
            return { outcome: "undeliverable", reason: "No school admin contact on file" };
        }

        const result = await this.d.channelRegistry.get(recipient.channel).send({
            recipientId, to, title: notification.title, message: notification.message, type: notification.type,
            metadata: { firstName: adminUser?.firstName ?? null },
        });
        if (result.success) {
            await this.d.notificationRepository.markPlatformRecipientSent(recipientId, result.providerMessageId);
            return { outcome: "sent" };
        }
        const reason = result.error ?? "Unknown delivery error";
        await this.d.notificationRepository.markPlatformRecipientFailed(recipientId, reason);
        return { outcome: "failed", reason };
    }

    private async resolveSchoolContact(type: RecipientKind, entityId: string): Promise<{ email: string | null; phone: string | null; firstName: string | null } | null> {
        if (type === "GUARDIAN") {
            const guardian = await this.d.guardianRepository.findById(entityId);
            return guardian ? { email: guardian.email ?? null, phone: guardian.phone ?? null, firstName: guardian.firstName } : null;
        }
        if (type === "STUDENT") {
            const student = await this.d.studentRepository.findById(entityId);
            if (!student?.userId) return null;
            const user = await this.d.userRepository.findById(student.userId);
            return user ? { email: user.email ?? null, phone: user.phone ?? null, firstName: user.firstName ?? student.firstName } : null;
        }
        const staff = await this.d.staffRepository.findById(entityId);
        if (!staff?.userId) return null;
        const user = await this.d.userRepository.findById(staff.userId);
        return user ? { email: user.email ?? null, phone: user.phone ?? null, firstName: user.firstName } : null;
    }
}
