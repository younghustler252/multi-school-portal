import { Role } from "../../../generated/public";
import { Request, Response, NextFunction } from "express";
import { EnterGradeUseCase }          from "../usecases/enter-grade.usecase";
import { BulkEnterGradesUseCase }     from "../usecases/bulk-enter-grades.usecase";
import { GetGradesUseCase }           from "../usecases/get-grades.usecase";
import { UpdateGradeUseCase }         from "../usecases/update-grade.usecase";
import { PublishGradesUseCase }       from "../usecases/publish-grades.usecase";
import { GetGradingConfigUseCase }    from "../usecases/get-grading-config.usecase";
import { GetMyChildrenGradesUseCase } from "../usecases/get-my-children-grade.usecase";
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

    getMyChildrenGradesUseCase: GetMyChildrenGradesUseCase;
}

export class GradeController {
    private readonly enterGradeUseCase:          EnterGradeUseCase;
    private readonly bulkEnterGradesUseCase:     BulkEnterGradesUseCase;
    private readonly getGradesUseCase:           GetGradesUseCase;
    private readonly updateGradeUseCase:         UpdateGradeUseCase;
    private readonly publishGradesUseCase:       PublishGradesUseCase;
    private readonly getGradingConfigUseCase:    GetGradingConfigUseCase;
    private readonly updateGradingConfigUseCase: UpdateGradingConfigUseCase;

    private readonly getMyChildrenGradesUseCase: GetMyChildrenGradesUseCase;

    constructor({
        enterGradeUseCase,
        bulkEnterGradesUseCase,
        getGradesUseCase,
        updateGradeUseCase,
        publishGradesUseCase,
        getGradingConfigUseCase,
        updateGradingConfigUseCase,
        getMyChildrenGradesUseCase
    }: Dependencies) {
        this.enterGradeUseCase          = enterGradeUseCase;
        this.bulkEnterGradesUseCase     = bulkEnterGradesUseCase;
        this.getGradesUseCase           = getGradesUseCase;
        this.updateGradeUseCase         = updateGradeUseCase;
        this.publishGradesUseCase       = publishGradesUseCase;
        this.getGradingConfigUseCase    = getGradingConfigUseCase;
        this.updateGradingConfigUseCase = updateGradingConfigUseCase;
        this.getMyChildrenGradesUseCase = getMyChildrenGradesUseCase;
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

    enterGrade = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.enterGradeUseCase.execute(
                req.body,
                req.user!.id,
                req.user!.role as Role,
            );

            sendCreated(res, result, "Grade entered successfully");
        } catch (err) { next(err); }
    };


    // ── Bulk enter grades ─────────────────────────────────────────────────
    bulkEnterGrades = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const requestingUserId = req.user?.id as string;
            const requestingUserRole = req.user?.role as Role;

            const result = await this.bulkEnterGradesUseCase.execute(
                req.body,
                requestingUserId,
                requestingUserRole,
            );

            sendCreated(
                res,
                result,
                `Entered ${result.entered.length} grade(s). Skipped ${result.skipped.length}.`,
            );
        } catch (err) {
            next(err);
        }
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

    // ── Get my children's grades ─────────────────────────────────────────────
    getMyChildrenGrades = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getMyChildrenGradesUseCase.execute(
                    req.user?.id as string,
                    {
                        studentId: req.query.studentId as string | undefined,
                        termId: req.query.termId as string | undefined,
                        page: req.query.page
                            ? Number(req.query.page)
                            : undefined,
                        limit: req.query.limit
                            ? Number(req.query.limit)
                            : undefined,
                    },
                );

            sendPaginated(res, result.data, result.meta);
        } catch (err) {
            next(err);
        }
    };
}