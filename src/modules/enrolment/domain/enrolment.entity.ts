/*
|--------------------------------------------------------------------------
| ENROLMENT DOMAIN ENTITY
| Tenant-level entity — assigns students to classes per term
|--------------------------------------------------------------------------
*/

export interface EnrolmentEntity {
    id:        string;
    studentId: string;
    classId:   string;
    termId:    string;
    status:    string;
    createdAt: Date;
    updatedAt: Date;
}