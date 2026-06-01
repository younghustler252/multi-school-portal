import { Types } from "mongoose";
import { UserRole } from "../../domain/enums/user-role";

/* ============================
   Notification Types
=========================== */
export enum NotificationType {
    INFO = "info",
    WARNING = "warning",
    ALERT = "alert",
    EXAM = "exam",
    ANNOUNCEMENT = "announcement"
}

/* ============================
   Notification Sender Types
=========================== */
export enum NotificationSender {
    SYSTEM = "system",
    USER = "user"
}

export interface NotificationChannels {
    inApp?: boolean;  
    email?: boolean;  
    push?: boolean;   
}

export interface NotificationMeta {
    emailSent?: boolean;
    pushSent?: boolean;
    [key: string]: any; // allows any extra custom info without breaking TS
}


/* ============================
   Notification Interface
=========================== */
export interface INotification {
    tenantId: Types.ObjectId;
    recipientId: Types.ObjectId;
    recipientRole: UserRole;
    title: string;
    message: string;
    type: NotificationType;
    isRead: boolean;
    createdAt: Date;
    sender: NotificationSender;
    channels?: NotificationChannels;  
    meta?: NotificationMeta;
    link: string;
}
