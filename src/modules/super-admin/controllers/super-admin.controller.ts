import { Request, Response, NextFunction }  from "express";
import { GetPlatformStatsUseCase }          from "../usecases/get-platform-stats.usecase";
import { GetAllUsersUseCase }               from "../usecases/get-all-users.usecase";
import { ImpersonateSchoolUseCase }         from "../usecases/impersonate-school.usecase";
import { DeactivateUserUseCase }            from "../usecases/deactivate-user.usecase";
import { GetMrrTrendUseCase } from "../usecases/get-mrr-trend.usecase";
import {
    sendSuccess,
    sendPaginated,
}                                           from "../../../shared/utils/api-response";

interface Dependencies {
    getPlatformStatsUseCase:  GetPlatformStatsUseCase;
    getAllUsersUseCase:        GetAllUsersUseCase;
    impersonateSchoolUseCase: ImpersonateSchoolUseCase;
    deactivateUserUseCase:    DeactivateUserUseCase;
    getMrrTrendUseCase:       GetMrrTrendUseCase;
}

export class SuperAdminController {
    private readonly getPlatformStatsUseCase:  GetPlatformStatsUseCase;
    private readonly getAllUsersUseCase:        GetAllUsersUseCase;
    private readonly impersonateSchoolUseCase: ImpersonateSchoolUseCase;
    private readonly deactivateUserUseCase:    DeactivateUserUseCase;
    private readonly getMrrTrendUseCase:       GetMrrTrendUseCase;


    constructor({
        getPlatformStatsUseCase,
        getAllUsersUseCase,
        impersonateSchoolUseCase,
        deactivateUserUseCase,
        getMrrTrendUseCase
    }: Dependencies) {
        this.getPlatformStatsUseCase  = getPlatformStatsUseCase;
        this.getAllUsersUseCase        = getAllUsersUseCase;
        this.impersonateSchoolUseCase = impersonateSchoolUseCase;
        this.deactivateUserUseCase    = deactivateUserUseCase;
        this.getMrrTrendUseCase       = getMrrTrendUseCase;
    }

    // ── Platform stats ────────────────────────────────────────────────────
    getPlatformStats = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getPlatformStatsUseCase.execute();
            sendSuccess(res, result, "Platform stats retrieved successfully");
        } catch (err) { next(err); }
    };

    // ── Get all users ─────────────────────────────────────────────────────
    getAllUsers = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getAllUsersUseCase.execute(
                req.query as any,
            );
            sendPaginated(res, result.data, result.meta);
        } catch (err) { next(err); }
    };

    // ── Impersonate school admin ──────────────────────────────────────────
    impersonateSchool = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.impersonateSchoolUseCase.execute(
                req.params.schoolId as string,
            );
            sendSuccess(res, result, "Impersonation token generated");
        } catch (err) { next(err); }
    };

    // ── Deactivate user ───────────────────────────────────────────────────
    deactivateUser = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.deactivateUserUseCase.execute(
                req.params.userId as string,
                req.user!.id,
            );
            sendSuccess(res, null, result.message);
        } catch (err) { next(err); }
    };

     getMrrTrend = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const months = req.query.months
                ? Number(req.query.months)
                : 6;

            const result = await this.getMrrTrendUseCase.execute(months);

            sendSuccess(
                res,
                result,
                "MRR trend retrieved successfully",
            );
        } catch (err) {
            next(err);
        }
    };
}