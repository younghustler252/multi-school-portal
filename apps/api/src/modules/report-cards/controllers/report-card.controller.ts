import { Request, Response, NextFunction } from "express";
import { ListReportCardsUseCase, GetReportCardUseCase, ClassOverviewUseCase } from "../usecases/report-cards-read.usecases";
import { GenerateReportCardsUseCase } from "../usecases/generate-report-cards.usecase";
import { UpdateRemarksUseCase } from "../usecases/update-remarks.usecase";
import { PublishReportCardsUseCase, UnpublishReportCardsUseCase } from "../usecases/publish-report-cards.usecases";
import { ReportCardPdfUseCase, ReportCardPreviewUseCase, ListTemplatesUseCase, TemplatePreviewUseCase, ClassPdfUseCase, ClassPdfStatusUseCase } from "../usecases/report-card-render.usecases";
import { sendSuccess } from "../../../shared/utils/api-response";
import { getAccess } from "../../../infrastructure/middleware/rbac.middleware";
import { CardParams, TemplateQuery, ListCardsQuery, OverviewQuery, GenerateDto, RemarksDto, PublishDto, UnpublishDto, ClassPdfQuery, ClassPdfJobParams } from "../dtos/report-card.dto";
import { reportCardErrors } from "../domain/report-cards.errors";

interface Dependencies {
    listReportCardsUseCase: ListReportCardsUseCase; getReportCardUseCase: GetReportCardUseCase; classOverviewUseCase: ClassOverviewUseCase;
    generateReportCardsUseCase: GenerateReportCardsUseCase; updateRemarksUseCase: UpdateRemarksUseCase;
    publishReportCardsUseCase: PublishReportCardsUseCase; unpublishReportCardsUseCase: UnpublishReportCardsUseCase; reportCardPdfUseCase: ReportCardPdfUseCase;
    reportCardPreviewUseCase: ReportCardPreviewUseCase; listTemplatesUseCase: ListTemplatesUseCase; templatePreviewUseCase: TemplatePreviewUseCase;
    classPdfUseCase: ClassPdfUseCase; classPdfStatusUseCase: ClassPdfStatusUseCase;
}

/* REPORT CARD CONTROLLER (school realm). The acting person comes ONLY from the verified session, never the body. */
const schoolIdOf = (req: Request): string => req.schoolId as string;
const tenantSchemaOf = (req: Request): string => req.tenantSchema as string;
const actorOf = (req: Request) => { if (!req.auth) throw reportCardErrors.notFound(); return { userId: req.auth.userId }; };
const idOf = (req: Request): string => CardParams.parse(req.params).id;

export class ReportCardController {
    constructor(private readonly d: Dependencies) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
        try { const r = await this.d.listReportCardsUseCase.execute(ListCardsQuery.parse(req.query), getAccess(req)); res.status(200).json({ success: true, message: "Report cards retrieved successfully", data: r.data, meta: r.meta }); } catch (e) { next(e); }
    };
    overview = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.classOverviewUseCase.execute(OverviewQuery.parse(req.query), getAccess(req)), "Class report card overview retrieved successfully"); } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getReportCardUseCase.execute(idOf(req), getAccess(req)), "Report card retrieved successfully"); } catch (e) { next(e); }
    };
    generate = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.generateReportCardsUseCase.execute(GenerateDto.parse(req.body), schoolIdOf(req), getAccess(req), actorOf(req)), "Report cards generated"); } catch (e) { next(e); }
    };
    remarks = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateRemarksUseCase.execute(idOf(req), RemarksDto.parse(req.body), schoolIdOf(req), getAccess(req), actorOf(req)), "Remarks saved"); } catch (e) { next(e); }
    };
    publish = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.publishReportCardsUseCase.execute(PublishDto.parse(req.body), schoolIdOf(req), getAccess(req), actorOf(req)), "Report cards published"); } catch (e) { next(e); }
    };
    unpublish = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.unpublishReportCardsUseCase.execute(UnpublishDto.parse(req.body), schoolIdOf(req), getAccess(req), actorOf(req)), "Report cards taken back to draft"); } catch (e) { next(e); }
    };
    pdf = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { buffer, filename } = await this.d.reportCardPdfUseCase.execute(idOf(req), schoolIdOf(req), getAccess(req), TemplateQuery.parse(req.query).template);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
            res.status(200).send(buffer);
        } catch (e) { next(e); }
    };
    preview = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.reportCardPreviewUseCase.execute(idOf(req), schoolIdOf(req), getAccess(req), TemplateQuery.parse(req.query).template), "Report card preview"); } catch (e) { next(e); }
    };
    templates = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listTemplatesUseCase.execute(schoolIdOf(req), getAccess(req)), "Report card templates retrieved successfully"); } catch (e) { next(e); }
    };
    templatePreview = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.templatePreviewUseCase.execute(schoolIdOf(req), getAccess(req), TemplateQuery.parse(req.query).template), "Template preview"); } catch (e) { next(e); }
    };
    /** A cache hit answers with the PDF. A miss answers 202 with a job id to poll at GET /class-pdf/status/:jobId; repeat this same request once it is done. */
    classPdf = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.classPdfUseCase.execute(ClassPdfQuery.parse(req.query), schoolIdOf(req), tenantSchemaOf(req), getAccess(req));
            if (r.status === "ready") {
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", `inline; filename="${r.filename}"`);
                res.status(200).send(r.buffer);
                return;
            }
            sendSuccess(res, { status: "queued", jobId: r.jobId, filename: r.filename, cardCount: r.cardCount, pollUrl: `/report-cards/class-pdf/status/${r.jobId}` }, "Report card PDFs are being prepared", 202);
        } catch (e) { next(e); }
    };
    classPdfStatus = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.classPdfStatusUseCase.execute(ClassPdfJobParams.parse(req.params).jobId), "Class PDF job status"); } catch (e) { next(e); }
    };
}
