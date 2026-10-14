export interface NotificationChannelPayload {
    recipientId: string;
    to:          string;
    title:       string;
    message:     string;
    type:        string;
    metadata?:   Record<string, any> | null;
}

export interface NotificationSendResult {
    success:            boolean;
    providerMessageId?: string;
    error?:             string;
}

export interface INotificationChannel {
    readonly channel: "EMAIL" | "SMS" | "IN_APP" | "WHATSAPP";
    send(payload: NotificationChannelPayload): Promise<NotificationSendResult>;
}