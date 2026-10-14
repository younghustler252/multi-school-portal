export interface PlatformNotificationEntity {
    id:               string;
    title:            string;
    message:          string;
    type:             string;
    state:            string;
    createdByAdminId: string;
    metadata:         any | null;
    sentAt:           Date | null;
    completedAt:      Date | null;
    createdAt:        Date;
    updatedAt:        Date;
}

export interface SchoolNotificationEntity {
    id:         string;
    title:      string;
    message:    string;
    type:       string;
    targetType: string;
    sentById:   string;
    metadata:   any | null;
    sentAt:     Date | null;
    createdAt:  Date;
    updatedAt:  Date;
}

export interface PlatformNotificationRecipientEntity {
    id:             string;
    notificationId: string;
    schoolId:       string;
    channel:        string;
    status:         string;
    retryCount:     number;
    failedReason:   string | null;
    providerMsgId:  string | null;
    idempotencyKey: string | null;
    queuedAt:       Date | null;
    sentAt:         Date | null;
    failedAt:       Date | null;
    cancelledAt:    Date | null;
    nextRetryAt:    Date | null;
    readAt:         Date | null;
    deliveredAt:    Date | null;
    createdAt:      Date;
    updatedAt:      Date;
}

// NEW — was missing entirely; createRecipient() had no typed return because of this gap
export interface SchoolNotificationRecipientEntity {
    id:             string;
    notificationId: string;
    studentId:      string | null;
    guardianId:     string | null;
    staffId:        string | null;
    channel:        string;
    status:         string;
    priority:       string;
    retryCount:     number;
    failedReason:   string | null;
    providerMsgId:  string | null;
    idempotencyKey: string | null;
    queuedAt:       Date | null;
    sentAt:         Date | null;
    failedAt:       Date | null;
    cancelledAt:    Date | null;
    nextRetryAt:    Date | null;
    readAt:         Date | null;
    deliveredAt:    Date | null;
    createdAt:      Date;
    updatedAt:      Date;
}