/*
|--------------------------------------------------------------------------
| GUARDIAN DOMAIN ENTITY
| Tenant-level entity
|--------------------------------------------------------------------------
*/

export interface GuardianEntity {
    id:         string;
    userId:     string | null;
    firstName:  string;
    lastName:   string;
    email:      string;
    phone:      string | null;
    occupation: string | null;
    address:    string | null;
    isActive:   boolean;
    createdAt:  Date;
    updatedAt:  Date;
}

export interface StudentGuardianEntity {
    id:         string;
    studentId:  string;
    guardianId: string;
    relation:   string;
    isPrimary:  boolean;
    createdAt:  Date;
}