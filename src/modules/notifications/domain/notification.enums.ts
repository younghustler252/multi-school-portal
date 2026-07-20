export enum NotificationErrorMessage {
    NOT_FOUND = "Notification not found",
}

export enum SchoolNotificationType {
    FEE_INVOICE       = "fee_invoice",
    FEE_REMINDER      = "fee_reminder",
    FEE_RECEIPT       = "fee_receipt",
    REPORT_CARD_READY = "report_card_ready",
    ATTENDANCE_ALERT  = "attendance_alert",
    EVENT             = "event",
    HOLIDAY           = "holiday",
    BROADCAST         = "broadcast",
    CUSTOM            = "custom",
}

export enum TargetType {
    STUDENT      = "STUDENT",
    GUARDIAN     = "GUARDIAN",
    STAFF        = "STAFF",
    ALL_PARENTS  = "ALL_PARENTS",
    ALL_STUDENTS = "ALL_STUDENTS",
    ALL_STAFF    = "ALL_STAFF",
    EVERYONE     = "EVERYONE",
}