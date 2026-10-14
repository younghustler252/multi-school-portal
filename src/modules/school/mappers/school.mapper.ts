import { School, SchoolDocument } from "../../../generated/public";
import { IMapper } from "../../../infrastructure/repository/base.repository";
import { SchoolEntity, SchoolDocumentEntity } from "../domain/school.entity";
import { schoolState, SchoolState, requiredDocsFor } from "../domain/school.policy";

/* What the school's own staff see (school realm). Never includes the full account number. */
export interface SchoolResponseData {
    id:        string;
    name:      string;
    subdomain: string;
    email:     string;
    phone:     string | null;
    website:   string | null;
    address:   string | null;
    city:      string | null;
    state:     string | null;
    country:   string;
    timezone:  string;
    logoUrl:   string | null;
    schoolCategory:  string;
    schoolOwnership: string;
    status:    SchoolState;             // what the school should treat itself as
    verification: {
        status:           string;       // unverified | under_review | verified | rejected
        note:             string | null;
        verifiedAt:       Date | null;
        requiredDocuments: string[];
    };
    payment: {
        setupComplete: boolean;
        bankCode:      string | null;
        accountName:   string | null;
        accountLast4:  string | null;
    };
    createdAt: Date;
}

/* What platform staff see (platform realm): adds internals and operations data. */
export interface PlatformSchoolResponseData extends SchoolResponseData {
    rawStatus:           string;
    isActive:            boolean;
    schemaName:          string | null;
    schemaProvisionedAt: Date | null;
    activatedAt:         Date | null;
    suspendedAt:         Date | null;
    suspensionReason:    string | null;
    verifiedById:        string | null;
    customDomain:        string | null;
    plan:                { id: string; name: string } | null;
    mrrKobo:             number;
}

export interface SchoolDocumentResponseData {
    id:              string;
    schoolId:        string;
    type:            string;
    status:          string;
    rejectionReason: string | null;
    verifiedAt:      Date | null;
    autoVerified:    boolean;
    fileUrl:         string;      // a short-lived signed link, filled in by the use case
    createdAt:       Date;
}

export class SchoolMapper implements IMapper<School, SchoolEntity> {

    toDomain(raw: School): SchoolEntity {
        const r = raw as unknown as Record<string, unknown> & School;
        return {
            id: r.id, name: r.name, subdomain: r.subdomain,
            customDomain: r.customDomain, customDomainVerifiedAt: r.customDomainVerifiedAt,
            schemaName: r.schemaName, schemaProvisionedAt: r.schemaProvisionedAt,
            email: r.email, phone: r.phone, address: r.address, city: r.city, state: r.state,
            country: r.country, timezone: r.timezone, logoUrl: r.logoUrl, website: r.website,
            schoolCategory: r.schoolCategory, schoolOwnership: r.schoolOwnership,
            status: r.status, verificationStatus: r.verificationStatus,
            verificationNote:  (r.verificationNote  as string | null) ?? null,
            verifiedAt: r.verifiedAt, verifiedById: r.verifiedById,
            suspendedAt: r.suspendedAt, suspensionReason: r.suspensionReason,
            activatedAt:       (r.activatedAt       as Date | null)   ?? null,
            isActive: r.isActive, deletedAt: r.deletedAt,
            paystackSubaccountCode: r.paystackSubaccountCode, paystackSubaccountId: r.paystackSubaccountId,
            settlementBankCode: r.settlementBankCode, settlementAccountNumber: r.settlementAccountNumber,
            settlementAccountName:  (r.settlementAccountName  as string | null) ?? null,
            settlementAccountLast4: (r.settlementAccountLast4 as string | null) ?? null,
            createdAt: r.createdAt, updatedAt: r.updatedAt,
        };
    }

    toResponse(e: SchoolEntity): SchoolResponseData {
        return {
            id: e.id, name: e.name, subdomain: e.subdomain, email: e.email, phone: e.phone, website: e.website,
            address: e.address, city: e.city, state: e.state, country: e.country, timezone: e.timezone,
            logoUrl: e.logoUrl, schoolCategory: e.schoolCategory, schoolOwnership: e.schoolOwnership,
            status: schoolState(e),
            verification: {
                status: e.verificationStatus, note: e.verificationNote, verifiedAt: e.verifiedAt,
                requiredDocuments: requiredDocsFor(e.schoolOwnership),
            },
            payment: {
                setupComplete: !!e.paystackSubaccountCode,
                bankCode:      e.settlementBankCode,
                accountName:   e.settlementAccountName,
                accountLast4:  e.settlementAccountLast4,
            },
            createdAt: e.createdAt,
        };
    }

    toPlatformResponse(e: SchoolEntity, plan: { id: string; name: string } | null, mrrKobo: number): PlatformSchoolResponseData {
        return {
            ...this.toResponse(e),
            rawStatus: e.status, isActive: e.isActive, schemaName: e.schemaName,
            schemaProvisionedAt: e.schemaProvisionedAt, activatedAt: e.activatedAt,
            suspendedAt: e.suspendedAt, suspensionReason: e.suspensionReason, verifiedById: e.verifiedById,
            customDomain: e.customDomain, plan, mrrKobo,
        };
    }
}

export class SchoolDocumentMapper implements IMapper<SchoolDocument, SchoolDocumentEntity> {

    toDomain(raw: SchoolDocument): SchoolDocumentEntity {
        return {
            id: raw.id, schoolId: raw.schoolId, type: raw.type, idDocumentType: raw.idDocumentType,
            proprietorFullName: raw.proprietorFullName, fileUrl: raw.fileUrl, status: raw.status,
            rejectionReason: raw.rejectionReason, verifiedAt: raw.verifiedAt, verifiedById: raw.verifiedById,
            apiVerified: raw.apiVerified, createdAt: raw.createdAt, updatedAt: raw.updatedAt,
        };
    }

    // The ID number and the provider's raw response are never returned
    toResponse(e: SchoolDocumentEntity): SchoolDocumentResponseData {
        return {
            id: e.id, schoolId: e.schoolId, type: e.type, status: e.status,
            rejectionReason: e.rejectionReason, verifiedAt: e.verifiedAt,
            autoVerified: e.apiVerified, fileUrl: "", createdAt: e.createdAt,
        };
    }
}
