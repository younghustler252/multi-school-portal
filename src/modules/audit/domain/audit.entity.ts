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