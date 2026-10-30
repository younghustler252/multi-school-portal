import { Request, Response, NextFunction } from "express";
import { ListAdjustmentsUseCase, GetAdjustmentUseCase, RequestAdjustmentUseCase, DecideAdjustmentUseCase } from "../usecases/fee-adjustment.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";
import { ListAdjustmentsQuery } from "../dtos/adjustment.dto";

interface Dependencies {
    listAdjustmentsUseCase: ListAdjustmentsUseCase; getAdjustmentUseCase: GetAdjustmentUseCase;
    requestAdjustmentUseCase: RequestAdjustmentUseCase; decideAdjustmentUseCase: DecideAdjustmentUseCase;
}

/* ADJUSTMENT CONTROLLER (school realm, /fees/adjustments). Bodies are already validated and converted by the route; queries are parsed here. */
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
const idOf       = (req: Request): string => String(req.params.id);

export class FeeAdjustmentController {
    constructor(private readonly d: Dependencies) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listAdjustmentsUseCase.execute(ListAdjustmentsQuery.parse(req.query));
            res.status(200).json({ success: true, message: "Adjustments retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getAdjustmentUseCase.execute(idOf(req)), "Adjustment retrieved successfully"); } catch (e) { next(e); }
    };
    request = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.requestAdjustmentUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Adjustment requested successfully"); } catch (e) { next(e); }
    };
    approve = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.decideAdjustmentUseCase.approve(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Adjustment approved successfully"); } catch (e) { next(e); }
    };
    reject = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.decideAdjustmentUseCase.reject(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Adjustment rejected successfully"); } catch (e) { next(e); }
    };
}
