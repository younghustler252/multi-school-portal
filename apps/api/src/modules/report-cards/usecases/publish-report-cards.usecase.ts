import { IReportCardRepository } from "../repositories/report-card.repository";

interface Dependencies {
    reportCardRepository: IReportCardRepository;
}

export class PublishReportCardsUseCase {
    private readonly reportCardRepository: IReportCardRepository;

    constructor({ reportCardRepository }: Dependencies) {
        this.reportCardRepository = reportCardRepository;
    }

    async execute(termId: string): Promise<{ published: number }> {
        const count = await this.reportCardRepository.publishAll(termId);
        return { published: count };
    }
}