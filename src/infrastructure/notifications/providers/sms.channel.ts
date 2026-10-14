import { INotificationChannel, NotificationChannelPayload, NotificationSendResult } from "../channel.interface";
import { SmsService } from "../../sms/sms.service";

export class SmsNotificationChannel implements INotificationChannel {
    readonly channel = "SMS" as const;

    constructor(private readonly smsService: SmsService) {}

    async send(payload: NotificationChannelPayload): Promise<NotificationSendResult> {
        try {
            const result = await this.smsService.send(payload.to, `${payload.title}: ${payload.message}`);
            return { success: true, providerMessageId: (result as any)?.messageId };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Unknown SMS error" };
        }
    }
}