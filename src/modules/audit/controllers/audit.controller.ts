import { Request, Response, NextFunction } from "express";
import { GetAuditLogsUseCase }  from "../usecases/get-audit-logs.usecase";
import { sendPaginated }        from "../../../shared/utils/api-response";

interface Dependencies {
    getAuditLogsUseCase: GetAuditLogsUseCase;
}

export class AuditController {
    private readonly getAuditLogsUseCase: GetAuditLogsUseCase;

    constructor({ getAuditLogsUseCase }: Dependencies) {
        this.getAuditLogsUseCase = getAuditLogsUseCase;
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
}