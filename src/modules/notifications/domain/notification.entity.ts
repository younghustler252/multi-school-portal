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