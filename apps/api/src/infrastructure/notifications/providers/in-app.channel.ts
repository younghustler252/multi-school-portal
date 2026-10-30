import { INotificationChannel, NotificationChannelPayload, NotificationSendResult } from "../channel.interface";

/**
 * IN_APP has no external delivery step — the recipient row itself is the
 * delivery artifact (read via GET /notifications/me). Registered for
 * interface-completeness / future use (websocket push), but the worker
 * never enqueues IN_APP jobs — those recipients are marked SENT at creation.
 */
export class InAppNotificationChannel implements INotificationChannel {
    readonly channel = "IN_APP" as const;

    async send(_payload: NotificationChannelPayload): Promise<NotificationSendResult> {
        return { success: true };
    }
}