import { IMapper }            from "../../../infrastructure/repository/base.repository";
import { ReportCardEntity }   from "../domain/report-card.entity";

export interface ReportCardResponseData {
    id:              string;
    studentId:       string;
    termId:          string;
    status:          string;
    teacherRemark:   string | null;
    principalRemark: string | null;
    totalScore:      number | null;
    averageScore:    number | null;
    position:        number | null;
    totalStudents:   number | null;
    pdfUrl:          string | null;
    emailSentAt:     Date | null;
    smsSentAt:       Date | null;
    generatedAt:     Date | null;
    createdAt:       Date;
}

export class ReportCardMapper implements IMapper<any, ReportCardEntity> {

    toDomain(raw: any): ReportCardEntity {
        return {
            id:              raw.id,
            studentId:       raw.studentId,
            termId:          raw.termId,
            status:          raw.status,
            teacherRemark:   raw.teacherRemark   ?? null,
            principalRemark: raw.principalRemark ?? null,
            totalScore:      raw.totalScore      ?? null,
            averageScore:    raw.averageScore     ?? null,
            position:        raw.position        ?? null,
            totalStudents:   raw.totalStudents   ?? null,
            pdfUrl:          raw.pdfUrl          ?? null,
            emailSentAt:     raw.emailSentAt     ?? null,
            smsSentAt:       raw.smsSentAt       ?? null,
            generatedAt:     raw.generatedAt     ?? null,
            createdAt:       raw.createdAt,
            updatedAt:       raw.updatedAt,
        };
    }

    toResponse(entity: ReportCardEntity): ReportCardResponseData {
        return {
            id:              entity.id,
            studentId:       entity.studentId,
            termId:          entity.termId,
            status:          entity.status,
            teacherRemark:   entity.teacherRemark,
            principalRemark: entity.principalRemark,
            totalScore:      entity.totalScore,
            averageScore:    entity.averageScore,
            position:        entity.position,
            totalStudents:   entity.totalStudents,
            pdfUrl:          entity.pdfUrl,
            emailSentAt:     entity.emailSentAt,
            smsSentAt:       entity.smsSentAt,
            generatedAt:     entity.generatedAt,
            createdAt:       entity.createdAt,
        };
    }
}