import { ReportCardEntity }  from "../domain/report-card.entity";
import { Prisma } from "../../../generated/prisma";
import {
    PaginatedResult,
    PaginateParams,
}                            from "../../../infrastructure/repository/base.repository";

export interface IReportCardRepository {
    findById(id: string):                            Promise<ReportCardEntity | null>;
    findOne(where: Record<string, any>):             Promise<ReportCardEntity | null>;
    findMany(where?: Record<string, any>):           Promise<ReportCardEntity[]>;
    paginate(params: PaginateParams):                Promise<PaginatedResult<ReportCardEntity>>;
    create(data: Prisma.ReportCardUncheckedCreateInput):               Promise<ReportCardEntity>;
    update(id: string, data: Record<string, any>):   Promise<ReportCardEntity>;
    exists(where: Record<string, any>):              Promise<boolean>;

    // ── Report card specific ──────────────────────────────────────────────
    findByStudentAndTerm(
        studentId: string,
        termId:    string,
    ):                                               Promise<ReportCardEntity | null>;
    findByTerm(termId: string):                      Promise<ReportCardEntity[]>;
    publishAll(termId: string):                      Promise<number>;
}