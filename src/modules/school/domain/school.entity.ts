import {
    SchoolCategory,
    SchoolOwnership,
    SchoolStatus,
    VerificationStatus,
    DocumentType,
    DocumentStatus,
}                       from "../../../generated/prisma";

/*
|--------------------------------------------------------------------------
| SCHOOL DOMAIN ENTITIES
|--------------------------------------------------------------------------
*/

// ── School Entity ─────────────────────────────────────────────────────────
export interface SchoolEntity {
    id:                     string;
    name:                   string;
    subdomain:              string;
    schemaName:             string | null;
    email:                  string;
    phone:                  string | null;
    address:                string | null;
    city:                   string | null;
    state:                  string | null;
    country:                string;
    timezone:               string;
    logoUrl:                string | null;
    schoolCategory:         SchoolCategory;
    schoolOwnership:        SchoolOwnership;
    status:                 SchoolStatus;
    verificationStatus:     VerificationStatus;
    verifiedAt:             Date | null;
    verifiedById:           string | null;
    suspendedAt:            Date | null;
    suspensionReason:       string | null;
    isActive:               boolean;
    paystackSubaccountCode: string | null;
    paystackSubaccountId:   string | null;
    settlementBankCode:     string | null;
    settlementAccountNumber: string | null;
    createdAt:              Date;
    updatedAt:              Date;
}

// ── School Document Entity ────────────────────────────────────────────────
export interface SchoolDocumentEntity {
    id:              string;
    schoolId:        string;
    type:            DocumentType;
    fileUrl:         string;
    status:          DocumentStatus;
    rejectionReason: string | null;
    verifiedAt:      Date | null;
    verifiedById:    string | null;
    apiVerified:     boolean;
    apiResponse:     any | null;
    createdAt:       Date;
    updatedAt:       Date;
}