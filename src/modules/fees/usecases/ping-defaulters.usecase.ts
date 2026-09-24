import { IFeeRepository }         from "../repositories/fee.repository";
import { INotificationRepository } from "../../notifications/repositories/notification.repository";
import { MailService }            from "../../../infrastructure/mail/mail.service";

interface Dependencies {
    feeRepository:            IFeeRepository;
    notificationRepository:   INotificationRepository;
    mailService:               MailService;
}

export class PingDefaultersUseCase {
    constructor(private readonly deps: Dependencies) {}

    async execute(termId: string, sentById: string) {
        const defaulters = await this.deps.feeRepository.findDefaultersSummaryByTerm(termId);
        let pinged = 0;

        for (const d of defaulters) {
            const links = await this.deps.feeRepository.findGuardianLinksByStudent(d.studentId); // reuse existing guardian-link lookup

            const notification = await this.deps.notificationRepository.createSchoolNotification({
                title: "Fee payment reminder",
                message: `You have an outstanding balance of ₦${(d.totalOwedKobo / 100).toLocaleString()}.`,
                type: "fee_reminder",
                targetType: "GUARDIAN",
                sentById,
                sentAt: new Date(),
            });

            for (const link of links) {
                await this.deps.notificationRepository.createRecipient({
                    notificationId: notification.id, guardianId: link.guardianId, channel: "IN_APP", status: "SENT",
                });

                try {
                    await this.deps.mailService.sendLetter(link.guardian.email, {
                        subject: "Fee payment reminder",
                        title: "Outstanding balance",
                        greeting: `Hi ${link.guardian.firstName},`,
                        paragraphs: [`You have an outstanding balance of ₦${(d.totalOwedKobo / 100).toLocaleString()} for your child.`],
                        footer: "Please log in to your parent portal to settle this.",
                    });
                    await this.deps.notificationRepository.createRecipient({
                        notificationId: notification.id, guardianId: link.guardianId, channel: "EMAIL", status: "SENT",
                    });
                } catch { /* one failed email shouldn't block others */ }
            }
            pinged++;
        }

        return { message: `${pinged} defaulter(s) notified.` };
    }
}