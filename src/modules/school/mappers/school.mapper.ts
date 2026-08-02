import { School, SchoolDocument } from "../../../generated/public";
import { IMapper } from "../../../infrastructure/repository/base.repository";
import { SchoolStatusFields } from "../types/school-status.types";
import {
    SchoolEntity,
    SchoolDocumentEntity,
} from "../domain/school.entity";

export interface SchoolResponseData extends SchoolStatusFields {
    email:              string;
    phone:              string | null;
    address:            string | null;
    city:               string | null;
    state:              string | null;
    country:            string;
    timezone:           string;
    logoUrl:            string | null;
    schoolCategory:     string;
    schoolOwnership:    string;
    createdAt:          Date;
}

export interface SchoolDocumentResponseData {
    id:              string;
    schoolId:        string;
    type:            string;
    fileUrl:         string;
    status:          string;
    rejectionReason: string | null;
    verifiedAt:      Date | null;
    createdAt:       Date;
}

export class SchoolMapper implements IMapper<School, SchoolEntity> {

    toDomain(raw: School): SchoolEntity {
        return {
            id:                      raw.id,
            name:                    raw.name,
            subdomain:               raw.subdomain,
            schemaName:              raw.schemaName,
            email:                   raw.email,
            phone:                   raw.phone,
            address:                 raw.address,
            city:                    raw.city,
            state:                   raw.state,
            country:                 raw.country,
            timezone:                raw.timezone,
            logoUrl:                 raw.logoUrl,
            schoolCategory:          raw.schoolCategory,
            schoolOwnership:         raw.schoolOwnership,
            status:                  raw.status,
            verificationStatus:      raw.verificationStatus,
            verifiedAt:              raw.verifiedAt,
            verifiedById:            raw.verifiedById,
            suspendedAt:             raw.suspendedAt,
            suspensionReason:        raw.suspensionReason,
            isActive:                raw.isActive,
            paystackSubaccountCode:  raw.paystackSubaccountCode,
            paystackSubaccountId:    raw.paystackSubaccountId,
            settlementBankCode:      raw.settlementBankCode,
            settlementAccountNumber: raw.settlementAccountNumber,
            createdAt:               raw.createdAt,
            updatedAt:               raw.updatedAt,
        };
    }

    toResponse(entity: SchoolEntity): SchoolResponseData {
        return {
            id:                 entity.id,
            name:               entity.name,
            subdomain:          entity.subdomain,
            email:              entity.email,
            phone:              entity.phone,
            address:            entity.address,
            city:               entity.city,
            state:              entity.state,
            country:            entity.country,
            timezone:           entity.timezone,
            logoUrl:            entity.logoUrl,
            schoolCategory:     entity.schoolCategory,
            schoolOwnership:    entity.schoolOwnership,
            status:             entity.status,
            verificationStatus: entity.verificationStatus,
            isActive:           entity.isActive,
            createdAt:          entity.createdAt,
        };
    }
}

export class SchoolDocumentMapper
    implements IMapper<SchoolDocument, SchoolDocumentEntity>
{
    toDomain(raw: SchoolDocument): SchoolDocumentEntity {
        return {
            id:              raw.id,
            schoolId:        raw.schoolId,
            type:            raw.type,
            fileUrl:         raw.fileUrl,
            status:          raw.status,
            rejectionReason: raw.rejectionReason,
            verifiedAt:      raw.verifiedAt,
            verifiedById:    raw.verifiedById,
            apiVerified:     raw.apiVerified,
            apiResponse:     raw.apiResponse,
            createdAt:       raw.createdAt,
            updatedAt:       raw.updatedAt,
        };
    }

    toResponse(entity: SchoolDocumentEntity): SchoolDocumentResponseData {
        return {
            id:              entity.id,
            schoolId:        entity.schoolId,
            type:            entity.type,
            fileUrl:         entity.fileUrl,
            status:          entity.status,
            rejectionReason: entity.rejectionReason,
            verifiedAt:      entity.verifiedAt,
            createdAt:       entity.createdAt,
        };
    }
}