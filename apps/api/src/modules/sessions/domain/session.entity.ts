export interface SessionEntity {
    id:        string;
    name:      string;
    startDate: Date;
    endDate:   Date;
    isCurrent: boolean;
    createdAt: Date;
    updatedAt: Date;
    terms?:    TermEntity[];
}

export interface TermEntity {
    id:        string;
    sessionId: string;
    name:      string;
    startDate: Date;
    endDate:   Date;
    isCurrent: boolean;
    createdAt: Date;
    updatedAt: Date;
}