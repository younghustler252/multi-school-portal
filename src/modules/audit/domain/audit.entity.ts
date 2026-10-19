export interface AuditLogEntity {
    id:        string;
    userId:    string | null;
    schoolId:  string | null;
    actorType: string;
    actorMembershipId: string | null;
    module:    string | null;
    requestId: string | null;
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
    impersonatedByName: string | null;   // set when a platform person was acting as this user
    module:     string | null;
    requestId:  string | null;
    action:     string;
    entity:     string;
    entityId:   string | null;
    oldValue:   any;
    newValue:   any;
    ipAddress:  string | null;
    metadata:   any;
    createdAt:  Date;
}