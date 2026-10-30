import { Request, Response, NextFunction } from "express";
import {
    StartTransfersUseCase, SendTransfersUseCase, ReconcileTransfersUseCase, RetryTransferUseCase, CancelTransferUseCase, GetRunTransfersUseCase, ListTransfersUseCase,
} from "../usecases/transfer.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";
import { ListTransfersQuery } from "../dtos/transfer.dto";

interface Dependencies {
    startTransfersUseCase: StartTransfersUseCase; sendTransfersUseCase: SendTransfersUseCase; reconcileTransfersUseCase: ReconcileTransfersUseCase;
    retryTransferUseCase: RetryTransferUseCase; cancelTransferUseCase: CancelTransferUseCase; getRunTransfersUseCase: GetRunTransfersUseCase; listTransfersUseCase: ListTransfersUseCase;
}
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };

/* SALARY TRANSFERS CONTROLLER (school realm, /payroll/transfers). Bodies are validated by the route. */
export class TransferController {
    constructor(private readonly d: Dependencies) {}

    start = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.startTransfersUseCase.execute(String(req.params.runId), schoolIdOf(req), userIdOf(req), req.body), "Salary transfers prepared successfully"); } catch (e) { next(e); }
    };
    send = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.sendTransfersUseCase.execute(String(req.params.runId), schoolIdOf(req), userIdOf(req)), "Salary transfers sent"); } catch (e) { next(e); }
    };
    runTransfers = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getRunTransfersUseCase.execute(String(req.params.runId)), "Salary transfers retrieved successfully"); } catch (e) { next(e); }
    };
    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listTransfersUseCase.execute(ListTransfersQuery.parse(req.query));
            res.status(200).json({ success: true, message: "Salary transfers retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };
    reconcile = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.reconcileTransfersUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Salary transfers checked"); } catch (e) { next(e); }
    };
    retry = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.retryTransferUseCase.execute(String(req.params.id), schoolIdOf(req), userIdOf(req), req.body), "Salary transfer retried as a new attempt"); } catch (e) { next(e); }
    };
    cancel = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.cancelTransferUseCase.execute(String(req.params.id), schoolIdOf(req), userIdOf(req)), "Salary transfer cancelled"); } catch (e) { next(e); }
    };
}
