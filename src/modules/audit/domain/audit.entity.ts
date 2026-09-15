export interface AuditLogEntity {
    id:        string;
    userId:    string | null;
    schoolId:  string | null;
    actorType: string;
    action:    string;
    entity:    string;
    entityId:  string | null;
    oldValue:  any | null;
    newValue:  any | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata:  any | null;
    createdAt: Date;
}

export interface EnrichedAuditLogEntry {
    id:         string;
    actorType:  string;
    actorId:    string | null;
    actorName:  string;       // resolved display name, or a system label
    action:     string;
    entity:     string;
    entityId:   string | null;
    oldValue:   any;
    newValue:   any;
    ipAddress:  string | null;
    metadata:   any;
    createdAt:  Date;
}