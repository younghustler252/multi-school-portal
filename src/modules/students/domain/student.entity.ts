/*
|--------------------------------------------------------------------------
| STUDENT DOMAIN ENTITY
| Tenant-level entity — no schoolId needed
|--------------------------------------------------------------------------
*/

export interface StudentEntity {
    id:              string;
    userId:          string | null;
    admissionNumber: string | null;
    firstName:       string;
    lastName:        string;
    middleName:      string | null;
    dateOfBirth:     Date | null;
    gender:          string | null;
    bloodGroup:      string | null;
    address:         string | null;
    photoUrl:        string | null;
    religion:        string | null;
    nationality:     string | null;
    stateOfOrigin:   string | null;
    isActive:        boolean;
    graduatedAt:     Date | null;       // set only by the promotion run; separate from isActive
    graduatedTermId: string | null;
    admittedAt:      Date | null;
    createdAt:       Date;
    updatedAt:       Date;
}