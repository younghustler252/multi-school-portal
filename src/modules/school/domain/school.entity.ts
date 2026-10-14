import {
    SchoolCategory, SchoolOwnership, SchoolStatus, VerificationStatus, DocumentType, DocumentStatus, IdDocumentType,
} from "../../../generated/public";

export interface SchoolEntity {
    id:                      string;
    name:                    string;
    subdomain:               string;
    customDomain:            string | null;
    customDomainVerifiedAt:  Date | null;
    schemaName:              string | null;
    schemaProvisionedAt:     Date | null;
    email:                   string;
    phone:                   string | null;
    address:                 string | null;
    city:                    string | null;
    state:                   string | null;
    country:                 string;
    timezone:                string;
    logoUrl:                 string | null;
    website:                 string | null;
    schoolCategory:          SchoolCategory;
    schoolOwnership:         SchoolOwnership;
    status:                  SchoolStatus;
    verificationStatus:      VerificationStatus;
    verificationNote:        string | null;
    verifiedAt:              Date | null;
    verifiedById:            string | null;
    suspendedAt:             Date | null;
    suspensionReason:        string | null;
    activatedAt:             Date | null;
    isActive:                boolean;
    deletedAt:               Date | null;
    paystackSubaccountCode:  string | null;
    paystackSubaccountId:    string | null;
    settlementBankCode:      string | null;
    settlementAccountNumber: string | null;   // stored ENCRYPTED
    settlementAccountName:   string | null;
    settlementAccountLast4:  string | null;
    createdAt:               Date;
    updatedAt:               Date;
}

export interface SchoolDocumentEntity {
    id:                 string;
    schoolId:           string;
    type:               DocumentType;
    idDocumentType:     IdDocumentType | null;
    proprietorFullName: string | null;
    fileUrl:            string;      // storage path, never a public URL
    status:             DocumentStatus;
    rejectionReason:    string | null;
    verifiedAt:         Date | null;
    verifiedById:       string | null;
    apiVerified:        boolean;
    createdAt:          Date;
    updatedAt:          Date;
}

// A platform-list row: the school plus its current plan
export interface PlatformSchoolRow {
    school:   SchoolEntity;
    plan:     { id: string; name: string } | null;
    mrrKobo:  number;
}
