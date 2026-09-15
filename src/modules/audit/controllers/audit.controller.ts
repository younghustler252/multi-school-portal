import { Request, Response, NextFunction } from "express";
import { GetAuditLogsUseCase }  from "../usecases/get-audit-logs.usecase";
import { GetMyOrgActivityUseCase } from "../usecases/get-my-org-activity.usecase";
import { sendPaginated }        from "../../../shared/utils/api-response";

interface Dependencies {
    getAuditLogsUseCase:        GetAuditLogsUseCase;
    getMyOrgActivityUseCase:    GetMyOrgActivityUseCase;
}

export class AuditController {
    private readonly getAuditLogsUseCase: GetAuditLogsUseCase;
    private readonly getMyOrgActivityUseCase: GetMyOrgActivityUseCase;

    constructor({ getAuditLogsUseCase, getMyOrgActivityUseCase }: Dependencies) {
        this.getAuditLogsUseCase     = getAuditLogsUseCase;
        this.getMyOrgActivityUseCase = getMyOrgActivityUseCase;
    }

    getAuditLogs = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getAuditLogsUseCase.execute(
                req.query as any,
            );
            sendPaginated(res, result.data, result.meta);
        } catch (err) { next(err); }
    };

        // ── Get my organization activity ─────────────────────────────────────
    getMyOrgActivity = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getMyOrgActivityUseCase.execute(
                req.user!.schoolId!,
                req.query as any,
            );
            sendPaginated(res, result.data, result.meta);
        } catch (err) { next(err); }
    };

}