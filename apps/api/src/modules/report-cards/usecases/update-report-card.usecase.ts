import { IReportCardRepository }   from "../repositories/report-card.repository";
import { ReportCardMapper }        from "../mappers/report-card.mapper";
import { ReportCardResponseData }  from "../mappers/report-card.mapper";
import { NotFoundError }           from "../../../shared/errors/domain.errors";
import { ReportCardErrorMessage }  from "../domain/report-card.enums";
import { UpdateReportCardDtoType } from "../dtos/report-card.dto";

interface Dependencies {
    reportCardRepository: IReportCardRepository;
    reportCardMapper:     ReportCardMapper;
}

export class UpdateReportCardUseCase {
    private readonly reportCardRepository: IReportCardRepository;
    private readonly reportCardMapper:     ReportCardMapper;

    constructor({ reportCardRepository, reportCardMapper }: Dependencies) {
        this.reportCardRepository = reportCardRepository;
        this.reportCardMapper     = reportCardMapper;
    }

    async execute(
        id:  string,
        dto: UpdateReportCardDtoType,
    ): Promise<ReportCardResponseData> {
        const reportCard = await this.reportCardRepository.findById(id);
        if (!reportCard) throw new NotFoundError(ReportCardErrorMessage.NOT_FOUND);

        const updated = await this.reportCardRepository.update(id, dto);
        return this.reportCardMapper.toResponse(updated);
    }
}