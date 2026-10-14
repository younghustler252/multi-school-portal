import { INotificationChannel, NotificationChannelPayload, NotificationSendResult } from "../channel.interface";

export class WhatsAppNotificationChannel implements INotificationChannel {
    readonly channel = "WHATSAPP" as const;

    async send(_payload: NotificationChannelPayload): Promise<NotificationSendResult> {
        throw new Error("WhatsApp channel not implemented — add WHATSAPP to NotificationChannel enum first.");
    }
}