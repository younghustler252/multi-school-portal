/*
|--------------------------------------------------------------------------
| CLASS DOMAIN ENTITIES
| Tenant-level entities
|--------------------------------------------------------------------------
*/

export interface ClassEntity {
    id:        string;
    name:      string;
    level:     string | null;
    capacity:  number | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface SubjectEntity {
    id:          string;
    name:        string;
    code:        string | null;
    description: string | null;
    createdAt:   Date;
    updatedAt:   Date;
}

export interface ClassSubjectEntity {
    id:        string;
    classId:   string;
    subjectId: string;
    staffId:   string;
    createdAt: Date;
}