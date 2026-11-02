import { asClass, asFunction } from "awilix";
import type { AwilixContainer } from "awilix";
import { PdfGeneratorService } from "../../infrastructure/pdf/pdf-generator.service";
import { ReportCardsRepository } from "./repositories/report-cards.repository";
import { ReportCardBuilder } from "./services/report-card-builder.service";
import { ReportCardNotifier } from "./services/report-card-notifier.service";
import { ListReportCardsUseCase, GetReportCardUseCase, ClassOverviewUseCase } from "./usecases/report-cards-read.usecases";
import { GenerateReportCardsUseCase } from "./usecases/generate-report-cards.usecase";
import { UpdateRemarksUseCase } from "./usecases/update-remarks.usecase";
import { PublishReportCardsUseCase, UnpublishReportCardsUseCase } from "./usecases/publish-report-cards.usecases";
import { ReportCardPdfUseCase, ReportCardPreviewUseCase, ListTemplatesUseCase, TemplatePreviewUseCase, ClassPdfUseCase, ClassPdfStatusUseCase, ClassPdfJobRunner, bullClassPdfQueue } from "./usecases/report-card-render.usecases";
import { ReportCardRenderer } from "./services/report-card-renderer.service";
import { PdfCacheService, SupabasePdfCacheStore } from "./services/pdf-cache.service";
import { env } from "../../config/env";
import { ReportCardController } from "./controllers/report-card.controller";

/*
| REPORT CARDS CONTAINER.
| Requires: registerAudit (auditService), registerGradesSetup (gradesSheetsRepository), the notifications container
| (notificationDispatchService, channelPolicyService), the message templates container (messageTemplateService),
| the school container (schoolRepository) and the school settings container (schoolSettingsRepository), the foundation container (entitlementsService),
| registerShared (storageService, for the PDF cache).
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
        allowedImageHosts:            asFunction(() => [new URL(env.supabase.url).hostname]).singleton(),   // the only host printed pages may load images from
        pdfCacheStore:                asFunction(({ storageService }) => new SupabasePdfCacheStore(storageService)).singleton(),
        pdfCacheService:              asFunction(({ pdfCacheStore }) => new PdfCacheService(pdfCacheStore)).singleton(),
        reportCardRenderer:           asClass(ReportCardRenderer).scoped(),
        reportCardPdfUseCase:         asClass(ReportCardPdfUseCase).scoped(),
        reportCardPreviewUseCase:     asClass(ReportCardPreviewUseCase).scoped(),
        listTemplatesUseCase:         asClass(ListTemplatesUseCase).scoped(),
        templatePreviewUseCase:       asClass(TemplatePreviewUseCase).scoped(),
        classPdfQueue:                asFunction(bullClassPdfQueue).singleton(),
        classPdfUseCase:              asClass(ClassPdfUseCase).scoped(),
        classPdfStatusUseCase:        asClass(ClassPdfStatusUseCase).scoped(),
        classPdfJobRunner:            asClass(ClassPdfJobRunner).scoped(),   // resolved by the worker, not by any route
        reportCardController:         asClass(ReportCardController).scoped(),
    });
};
