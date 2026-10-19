/*
| STAFF ENTITY. The school's own record of a person who works there.
| The record owns the person's details (name, contact, employment). A portal LOGIN is optional:
| `userId` is set only when the person has been invited and has accepted. Cooks, drivers and guards are staff too.
*/
export type EmploymentType = "full_time" | "part_time" | "contract" | "volunteer";
export type StaffCategory  = "teaching" | "non_teaching";

export interface StaffBranchRef { id: string; name: string; code: string; isPrimary: boolean }

export interface StaffEntity {
    id:             string;
    userId:         string | null;
    employeeId:     string | null;
    firstName:      string;
    lastName:       string;
    middleName:     string | null;
    email:          string | null;
    phone:          string | null;
    photoUrl:       string | null;
    gender:         string | null;
    dateOfBirth:    Date | null;
    address:        string | null;
    department:     string | null;
    designation:    string | null;
    qualification:  string | null;
    category:       StaffCategory;
    employmentType: EmploymentType;
    joinDate:       Date | null;
    exitDate:       Date | null;
    exitReason:     string | null;
    isActive:       boolean;
    deletedAt:      Date | null;
    createdAt:      Date;
    updatedAt:      Date;
    branches?:      StaffBranchRef[];
}
