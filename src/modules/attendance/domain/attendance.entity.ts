/*
|--------------------------------------------------------------------------
| ATTENDANCE DOMAIN ENTITY
| Tenant-level entity
|--------------------------------------------------------------------------
*/

export interface AttendanceEntity {
    id:        string;
    studentId: string;
    termId:    string;
    date:      Date;
    status:    string;
    note:      string | null;
    createdAt: Date;
}