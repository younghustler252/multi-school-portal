import { Request, Response, NextFunction }    from "express";
import { GenerateReportCardUseCase }          from "../usecases/generate-report-card.usecase";
import { BulkGenerateReportCardsUseCase }     from "../usecases/bulk-generate-report-cards.usecase";
import { GetReportCardsUseCase }              from "../usecases/get-report-cards.usecase";
import { GetReportCardUseCase }               from "../usecases/get-report-card.usecase";
import { UpdateReportCardUseCase }            from "../usecases/update-report-card.usecase";
import { PublishReportCardsUseCase }          from "../usecases/publish-report-cards.usecase";
import { SendReportCardsUseCase }             from "../usecases/send-report-cards.usecase";
import {
    sendSuccess,
    sendCreated,
    sendPaginated,
}                                             from "../../../shared/utils/api-response";

interface Dependencies {
    generateReportCardUseCase:      GenerateReportCardUseCase;
    bulkGenerateReportCardsUseCase: BulkGenerateReportCardsUseCase;
    getReportCardsUseCase:          GetReportCardsUseCase;
    getReportCardUseCase:           GetReportCardUseCase;
    updateReportCardUseCase:        UpdateReportCardUseCase;
    publishReportCardsUseCase:      PublishReportCardsUseCase;
    sendReportCardsUseCase:         SendReportCardsUseCase;
}

export class ReportCardController {
    private readonly generateReportCardUseCase:      GenerateReportCardUseCase;
    private readonly bulkGenerateReportCardsUseCase: BulkGenerateReportCardsUseCase;
    private readonly getReportCardsUseCase:          GetReportCardsUseCase;
    private readonly getReportCardUseCase:           GetReportCardUseCase;
    private readonly updateReportCardUseCase:        UpdateReportCardUseCase;
    private readonly publishReportCardsUseCase:      PublishReportCardsUseCase;
    private readonly sendReportCardsUseCase:         SendReportCardsUseCase;

    constructor({
        generateReportCardUseCase,
        bulkGenerateReportCardsUseCase,
        getReportCardsUseCase,
        getReportCardUseCase,
        updateReportCardUseCase,
        publishReportCardsUseCase,
        sendReportCardsUseCase,
    }: Dependencies) {
        this.generateReportCardUseCase      = generateReportCardUseCase;
        this.bulkGenerateReportCardsUseCase = bulkGenerateReportCardsUseCase;
        this.getReportCardsUseCase          = getReportCardsUseCase;
        this.getReportCardUseCase           = getReportCardUseCase;
        this.updateReportCardUseCase        = updateReportCardUseCase;
        this.publishReportCardsUseCase      = publishReportCardsUseCase;
        this.sendReportCardsUseCase         = sendReportCardsUseCase;
    }

    // ── List report cards ─────────────────────────────────────────────────
    getReportCards = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getReportCardsUseCase.execute(
                req.query as any,
            );
            sendPaginated(res, result.data, result.meta);
        } catch (err) { next(err); }
    };

    // ── Get single report card with full details ───────────────────────────
    getReportCard = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getReportCardUseCase.execute(
                req.params.id as string,
            );
            sendSuccess(res, result, "Report card retrieved successfully");
        } catch (err) { next(err); }
    };

    // ── Generate single report card ───────────────────────────────────────
    generateReportCard = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.generateReportCardUseCase.execute(
                req.body,
            );
            sendCreated(res, result, "Report card generated successfully");
        } catch (err) { next(err); }
    };

    // ── Bulk generate ─────────────────────────────────────────────────────
    bulkGenerateReportCards = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.bulkGenerateReportCardsUseCase.execute(
                req.body,
            );
            sendCreated(
                res,
                result,
                `Generated ${result.generated.length} report card(s). Skipped ${result.skipped.length}.`,
            );
        } catch (err) { next(err); }
    };

    // ── Update report card remarks ────────────────────────────────────────
    updateReportCard = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updateReportCardUseCase.execute(
                req.params.id as string,
                req.body,
            );
            sendSuccess(res, result, "Report card updated successfully");
        } catch (err) { next(err); }
    };

    // ── Publish report cards ──────────────────────────────────────────────
    publishReportCards = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.publishReportCardsUseCase.execute(
                req.body.termId as string,
            );
            sendSuccess(
                res,
                result,
                `${result.published} report card(s) published`,
            );
        } catch (err) { next(err); }
    };

    // ── Send report card notification ─────────────────────────────────────
    sendReportCard = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.sendReportCardsUseCase.execute(
                req.params.id as string,
                req.body.schoolName  ?? "School",
                req.body.subdomain   ?? "",
                req.body.termName    ?? "Term",
            );
            sendSuccess(res, null, result.message);
        } catch (err) { next(err); }
    };
}