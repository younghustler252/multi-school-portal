import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { PdfGeneratorService } from "../../infrastructure/pdf/pdf-generator.service";
import { ReportCardsRepository } from "./repositories/report-cards.repository";
import { ReportCardBuilder } from "./services/report-card-builder.service";
import { ReportCardNotifier } from "./services/report-card-notifier.service";
import { ListReportCardsUseCase, GetReportCardUseCase, ClassOverviewUseCase } from "./usecases/report-cards-read.usecases";
import { GenerateReportCardsUseCase } from "./usecases/generate-report-cards.usecase";
import { UpdateRemarksUseCase } from "./usecases/update-remarks.usecase";
import { PublishReportCardsUseCase, UnpublishReportCardsUseCase } from "./usecases/publish-report-cards.usecases";
import { ReportCardPdfUseCase } from "./usecases/report-card-pdf.usecase";
import { ReportCardController } from "./controllers/report-card.controller";

/*
| REPORT CARDS CONTAINER.
| Requires: registerAudit (auditService), registerGradesSetup (gradesSheetsRepository), the notifications container
| (notificationDispatchService, channelPolicyService), the message templates container (messageTemplateService),
| the school container (schoolRepository) and the school settings container (schoolSettingsRepository).
*/
export const registerReportCards = (container: AwilixContainer): void => {
    container.register({
        pdfGeneratorService:          asClass(PdfGeneratorService).singleton(),
        reportCardsRepository:        asClass(ReportCardsRepository).scoped(),
        reportCardBuilder:            asClass(ReportCardBuilder).scoped(),
        reportCardNotifier:           asClass(ReportCardNotifier).scoped(),
        listReportCardsUseCase:       asClass(ListReportCardsUseCase).scoped(),
        getReportCardUseCase:         asClass(GetReportCardUseCase).scoped(),
        classOverviewUseCase:         asClass(ClassOverviewUseCase).scoped(),
        generateReportCardsUseCase:   asClass(GenerateReportCardsUseCase).scoped(),
        updateRemarksUseCase:         asClass(UpdateRemarksUseCase).scoped(),
        publishReportCardsUseCase:    asClass(PublishReportCardsUseCase).scoped(),
        unpublishReportCardsUseCase:  asClass(UnpublishReportCardsUseCase).scoped(),
        reportCardPdfUseCase:         asClass(ReportCardPdfUseCase).scoped(),
        reportCardController:         asClass(ReportCardController).scoped(),
    });
};
