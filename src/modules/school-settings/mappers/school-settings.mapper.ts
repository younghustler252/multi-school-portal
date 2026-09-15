import { IMapper }              from "../../../infrastructure/repository/base.repository";
import { SchoolSettingsEntity } from "../domain/school-settings.entity";
import { ReportCardTemplate } from "../domain/school-settings.enums";

export interface SchoolSettingsResponseData {
    id:                         string;
    logoUrl:                    string | null;
    primaryColor:               string | null;
    secondaryColor:             string | null;
    motto:                      string | null;
    address:                    string | null;
    website:                    string | null;
    foundedYear:                number | null;
    principalName:              string | null;
    stamp:                      string | null;
    signature:                  string | null;

    reportCardTemplate:         ReportCardTemplate;
    customReportCard:           boolean;
    reportCardLetterheadUrl:    string | null;
    letterheadContentTopMm:     number | null;
    letterheadContentBottomMm:  number | null;
    allowStudentLogin: boolean,
    updatedAt:                  Date;
}

export class SchoolSettingsMapper
    implements IMapper<any, SchoolSettingsEntity>
{
    toDomain(raw: any): SchoolSettingsEntity {
        return {
            id:                         raw.id,
            logoUrl:                    raw.logoUrl                    ?? null,
            primaryColor:               raw.primaryColor               ?? null,
            secondaryColor:             raw.secondaryColor             ?? null,
            motto:                      raw.motto                      ?? null,
            address:                    raw.address                    ?? null,
            website:                    raw.website                    ?? null,
            foundedYear:                raw.foundedYear                ?? null,
            principalName:              raw.principalName              ?? null,
            stamp:                      raw.stamp                      ?? null,
            signature:                  raw.signature                  ?? null,

            reportCardTemplate: raw.reportCardTemplate ?? "classic",
            customReportCard:           raw.customReportCard,

            reportCardLetterheadUrl:    raw.reportCardLetterheadUrl    ?? null,
            letterheadContentTopMm:     raw.letterheadContentTopMm     ?? null,
            letterheadContentBottomMm:  raw.letterheadContentBottomMm  ?? null,
            
            allowStudentLogin:          raw.allowStudentLogin,

            createdAt:                  raw.createdAt,
            updatedAt:                  raw.updatedAt,
        };
    }

    toResponse(
        entity: SchoolSettingsEntity,
    ): SchoolSettingsResponseData {
        return {
            id:                         entity.id,
            logoUrl:                    entity.logoUrl,
            primaryColor:               entity.primaryColor,
            secondaryColor:             entity.secondaryColor,
            motto:                      entity.motto,
            address:                    entity.address,
            website:                    entity.website,
            foundedYear:                entity.foundedYear,
            principalName:              entity.principalName,
            stamp:                      entity.stamp,
            signature:                  entity.signature,

            reportCardTemplate:         entity.reportCardTemplate,
            customReportCard:           entity.customReportCard,

            reportCardLetterheadUrl:    entity.reportCardLetterheadUrl,
            letterheadContentTopMm:     entity.letterheadContentTopMm,
            letterheadContentBottomMm:  entity.letterheadContentBottomMm,

            allowStudentLogin:          entity.allowStudentLogin,


            updatedAt:                  entity.updatedAt,
        };
    }
}