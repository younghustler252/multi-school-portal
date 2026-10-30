export interface NotificationChannelPayload {
    recipientId: string;
    to:          string;
    title:       string;
    /** Plain text. A channel that puts it into HTML escapes it itself. */
    message:     string;
    type:        string;
    /** firstName: the recipient's first name. skipGreeting: the message already greets by name. bodyOnly: send the message without the title (SMS). */
    metadata?:   { firstName?: string | null; skipGreeting?: boolean; bodyOnly?: boolean } & Record<string, any> | null;
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
