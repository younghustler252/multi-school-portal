import { asClass }                          from "awilix";
import type { AwilixContainer }             from "awilix";
import { ReportCardMapper }                 from "./mappers/report-card.mapper";
import { ReportCardRepositoryImpl }         from "./repositories/report-card.repository.impl";
import { GenerateReportCardUseCase }        from "./usecases/generate-report-card.usecase";
import { BulkGenerateReportCardsUseCase }   from "./usecases/bulk-generate-report-cards.usecase";
import { GetReportCardBulkStatusUseCase } from "./usecases/get-report-card-bulk-status.usecase";
import { GetReportCardsUseCase }            from "./usecases/get-report-cards.usecase";
import { GetReportCardUseCase } from "./usecases/get-report-card.usecase";
import { GetMyReportCardsUseCase } from "./usecases/get-my-report-cards.usecase";
import { GetMyChildrenReportCardsUseCase } from "./usecases/get-my-children-report-cards.usecase";
import { UpdateReportCardUseCase }          from "./usecases/update-report-card.usecase";
import { PublishReportCardsUseCase }        from "./usecases/publish-report-cards.usecase";
import { SendReportCardsUseCase }           from "./usecases/send-report-cards.usecase";
import { ReportCardController }             from "./controllers/report-card.controller";

export const registerReportCards = (container: AwilixContainer): void => {
    container.register({
        reportCardMapper:                 asClass(ReportCardMapper).singleton(),
        reportCardRepository:             asClass(ReportCardRepositoryImpl).scoped(),
        generateReportCardUseCase:        asClass(GenerateReportCardUseCase).scoped(),
        bulkGenerateReportCardsUseCase:   asClass(BulkGenerateReportCardsUseCase).scoped(),
        getReportCardsUseCase:            asClass(GetReportCardsUseCase).scoped(),
        getReportCardBulkStatusUseCase:   asClass(GetReportCardBulkStatusUseCase).scoped(),
        getReportCardUseCase:             asClass(GetReportCardUseCase).scoped(),
        getMyReportCardsUseCase:          asClass(GetMyReportCardsUseCase).scoped(),
        getMyChildrenReportCardsUseCase: asClass(GetMyChildrenReportCardsUseCase).scoped(),
        updateReportCardUseCase:          asClass(UpdateReportCardUseCase).scoped(),
        publishReportCardsUseCase:        asClass(PublishReportCardsUseCase).scoped(),
        sendReportCardsUseCase:           asClass(SendReportCardsUseCase).scoped(),
        reportCardController:             asClass(ReportCardController).scoped(),
    });
};