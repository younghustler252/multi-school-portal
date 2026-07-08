/*
|--------------------------------------------------------------------------
| STAFF DOMAIN ENTITY
| Tenant-level entity — no schoolId needed
|--------------------------------------------------------------------------
*/

export interface StaffEntity {
    id:            string;
    userId:        string;
    employeeId:    string | null;
    department:    string | null;
    designation:   string | null;
    qualification: string | null;
    gender:        string | null;
    dateOfBirth:   Date | null;
    address:       string | null;
    joinDate:      Date | null;
    role:          string;
    isActive:      boolean;
    createdAt:     Date;
    updatedAt:     Date;

    // Joined from public.User via userId
    firstName?:    string | null;
    lastName?:     string | null;
    email?:        string;
    phone?:        string | null;
    photoUrl?:     string | null;
}