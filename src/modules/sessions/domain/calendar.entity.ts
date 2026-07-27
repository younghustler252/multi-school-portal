
export interface CalendarEventEntity {
    id:          string;
    termId:      string | null;
    sessionId:   string | null;
    title:       string;
    description: string | null;
    startDate:   Date;
    endDate:     Date | null;
    type:        string;
    isHoliday:   boolean;
    createdById: string | null;
    createdAt:   Date;
    updatedAt:   Date;
}