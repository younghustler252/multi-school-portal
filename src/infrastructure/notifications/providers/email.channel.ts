import { INotificationChannel, NotificationChannelPayload, NotificationSendResult } from "../channel.interface";
import { MailService } from "../../mail/mail.service";

export class EmailNotificationChannel implements INotificationChannel {
    readonly channel = "EMAIL" as const;

    constructor(private readonly mailService: MailService) {}

    async send(payload: NotificationChannelPayload): Promise<NotificationSendResult> {
        try {
            await this.mailService.sendLetter(payload.to, {
                subject:    payload.title,
                title:      payload.title,
                greeting:   `Hi ${payload.metadata?.firstName ?? "there"},`,
                paragraphs: [payload.message],
                footer:     "This is an automated notification from SchoolPortal.",
            });
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown email error" };
        }
    }
}