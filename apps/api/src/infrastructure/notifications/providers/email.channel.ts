import { INotificationChannel, NotificationChannelPayload, NotificationSendResult } from "../channel.interface";
import { MailService } from "../../mail/mail.service";
import { escapeHtml, singleLine, textToParagraphs } from "../../../shared/utils/html";

/* Messages are plain text. Everything that goes into the email's HTML (title, name, paragraphs) is escaped HERE, so a
   title, a message or a student's name can never inject markup into a parent's inbox. */
export class EmailNotificationChannel implements INotificationChannel {
    readonly channel = "EMAIL" as const;

    constructor(private readonly mailService: MailService) {}

    async send(payload: NotificationChannelPayload): Promise<NotificationSendResult> {
        try {
            const meta = payload.metadata ?? {};
            await this.mailService.sendLetter(payload.to, {
                subject:    singleLine(payload.title),
                title:      escapeHtml(singleLine(payload.title)),
                greeting:   meta.skipGreeting ? undefined : `Hi ${escapeHtml(meta.firstName ?? "there")},`,
                paragraphs: textToParagraphs(payload.message),
                footer:     "This is an automated notification from SchoolPortal.",
            });
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown email error" };
        }
    }
}
