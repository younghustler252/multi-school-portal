// src/modules/school/types/school-status.types.ts

export interface SchoolStatusFields {
    id:                 string;
    name:               string;
    subdomain:          string;
    status:             string;
    isActive:           boolean;
    verificationStatus: string;
}