import { Request, Response, NextFunction } from "express";
import { EnterGradeUseCase }          from "../usecases/enter-grade.usecase";
import { BulkEnterGradesUseCase }     from "../usecases/bulk-enter-grades.usecase";
import { GetGradesUseCase }           from "../usecases/get-grades.usecase";
import { UpdateGradeUseCase }         from "../usecases/update-grade.usecase";
import { PublishGradesUseCase }       from "../usecases/publish-grades.usecase";
import { GetGradingConfigUseCase }    from "../usecases/get-grading-config.usecase";
import { UpdateGradingConfigUseCase } from "../usecases/update-grading-config.usecase";
import {
    sendSuccess,
    sendCreated,
    sendPaginated,
}                                     from "../../../shared/utils/api-response";

/*
|--------------------------------------------------------------------------
| GRADE CONTROLLER
|--------------------------------------------------------------------------
*/

interface Dependencies {
    enterGradeUseCase:          EnterGradeUseCase;
    bulkEnterGradesUseCase:     BulkEnterGradesUseCase;
    getGradesUseCase:           GetGradesUseCase;
    updateGradeUseCase:         UpdateGradeUseCase;
    publishGradesUseCase:       PublishGradesUseCase;
    getGradingConfigUseCase:    GetGradingConfigUseCase;
    updateGradingConfigUseCase: UpdateGradingConfigUseCase;
}

export class GradeController {
    private readonly enterGradeUseCase:          EnterGradeUseCase;
    private readonly bulkEnterGradesUseCase:     BulkEnterGradesUseCase;
    private readonly getGradesUseCase:           GetGradesUseCase;
    private readonly updateGradeUseCase:         UpdateGradeUseCase;
    private readonly publishGradesUseCase:       PublishGradesUseCase;
    private readonly getGradingConfigUseCase:    GetGradingConfigUseCase;
    private readonly updateGradingConfigUseCase: UpdateGradingConfigUseCase;

    constructor({
        enterGradeUseCase,
        bulkEnterGradesUseCase,
        getGradesUseCase,
        updateGradeUseCase,
        publishGradesUseCase,
        getGradingConfigUseCase,
        updateGradingConfigUseCase,
    }: Dependencies) {
        this.enterGradeUseCase          = enterGradeUseCase;
        this.bulkEnterGradesUseCase     = bulkEnterGradesUseCase;
        this.getGradesUseCase           = getGradesUseCase;
        this.updateGradeUseCase         = updateGradeUseCase;
        this.publishGradesUseCase       = publishGradesUseCase;
        this.getGradingConfigUseCase    = getGradingConfigUseCase;
        this.updateGradingConfigUseCase = updateGradingConfigUseCase;
    }

    // ── Get grades ────────────────────────────────────────────────────────
    getGrades = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getGradesUseCase.execute(
                req.query as any,
            );
            sendPaginated(res, result.data, result.meta);
        } catch (err) { next(err); }
    };

    // ── Enter grade ───────────────────────────────────────────────────────
    enterGrade = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.enterGradeUseCase.execute(req.body);
            sendCreated(res, result, "Grade entered successfully");
        } catch (err) { next(err); }
    };

    // ── Bulk enter grades ─────────────────────────────────────────────────
    bulkEnterGrades = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.bulkEnterGradesUseCase.execute(
                req.body,
            );
            sendCreated(
                res,
                result,
                `Entered ${result.entered.length} grade(s). Skipped ${result.skipped.length}.`,
            );
        } catch (err) { next(err); }
    };

    // ── Update grade ──────────────────────────────────────────────────────
    updateGrade = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updateGradeUseCase.execute(
                req.params.id as string,
                req.body,
            );
            sendSuccess(res, result, "Grade updated successfully");
        } catch (err) { next(err); }
    };

    // ── Publish grades ────────────────────────────────────────────────────
    publishGrades = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.publishGradesUseCase.execute(req.body);
            sendSuccess(
                res,
                result,
                `${result.published} grade(s) published successfully`,
            );
        } catch (err) { next(err); }
    };

    // ── Get grading config ────────────────────────────────────────────────
    getGradingConfig = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getGradingConfigUseCase.execute();
            sendSuccess(res, result, "Grading config retrieved successfully");
        } catch (err) { next(err); }
    };

    // ── Update grading config ─────────────────────────────────────────────
    updateGradingConfig = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updateGradingConfigUseCase.execute(
                req.body,
            );
            sendSuccess(res, result, "Grading config updated successfully");
        } catch (err) { next(err); }
    };
}