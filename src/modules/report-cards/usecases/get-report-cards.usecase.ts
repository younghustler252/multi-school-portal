import { IReportCardRepository }   from "../repositories/report-card.repository";
import { ReportCardMapper }        from "../mappers/report-card.mapper";
import { ReportCardResponseData }  from "../mappers/report-card.mapper";
import { PaginatedResult }         from "../../../infrastructure/repository/base.repository";
import { ListReportCardsDtoType }  from "../dtos/report-card.dto";

interface Dependencies {
    reportCardRepository: IReportCardRepository;
    reportCardMapper:     ReportCardMapper;
}

export class GetReportCardsUseCase {
    private readonly reportCardRepository: IReportCardRepository;
    private readonly reportCardMapper:     ReportCardMapper;

    constructor({ reportCardRepository, reportCardMapper }: Dependencies) {
        this.reportCardRepository = reportCardRepository;
        this.reportCardMapper     = reportCardMapper;
    }

    async execute(
        dto: ListReportCardsDtoType,
    ): Promise<PaginatedResult<ReportCardResponseData>> {
        const where: Record<string, any> = {};

        if (dto.termId)    where.termId    = dto.termId;
        if (dto.studentId) where.studentId = dto.studentId;
        if (dto.status)    where.status    = dto.status;

        const result = await this.reportCardRepository.paginate({
            page:    Number(dto.page)  || 1,
            limit:   Number(dto.limit) || 20,
            where,
            orderBy: { createdAt: "desc" },
        });

        return {
            data: result.data.map(r => this.reportCardMapper.toResponse(r)),
            meta: result.meta,
        };
    }
}