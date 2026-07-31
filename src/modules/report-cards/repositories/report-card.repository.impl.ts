import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { ReportCardMapper } from "../mappers/report-card.mapper";
import { ReportCardEntity } from "../domain/report-card.entity";
import { IReportCardRepository } from "./report-card.repository";

export class ReportCardRepositoryImpl
    extends BaseTenantRepository<ReportCardEntity>
    implements IReportCardRepository
{
    protected readonly modelName = "reportCard";

    constructor({ reportCardMapper }: { reportCardMapper: ReportCardMapper }) {
        super(reportCardMapper);
    }

    async findByStudentAndTerm(studentId: string, termId: string): Promise<ReportCardEntity | null> {
        return this.findOne({ studentId, termId });
    }

    async findByTerm(termId: string): Promise<ReportCardEntity[]> {
        return this.findMany({ termId });
    }

    async publishAll(termId: string): Promise<number> {
        const result = await this.model().updateMany({
            where: { termId, status: { not: "published" } },
            data: { status: "published" },
        });
        return result.count;
    }
}