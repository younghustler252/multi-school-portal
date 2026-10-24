import { Request, Response, NextFunction } from "express";
import { SaveInstalmentPlanUseCase, GetInstalmentPlanUseCase, CancelInstalmentPlanUseCase, OpeningBalancesUseCase, RunLateFeesUseCase } from "../usecases/invoice-extras.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";

interface Dependencies {
    saveInstalmentPlanUseCase: SaveInstalmentPlanUseCase; getInstalmentPlanUseCase: GetInstalmentPlanUseCase; cancelInstalmentPlanUseCase: CancelInstalmentPlanUseCase;
    openingBalancesUseCase: OpeningBalancesUseCase; runLateFeesUseCase: RunLateFeesUseCase;
}
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
const idOf       = (req: Request): string => String(req.params.id);

/* INSTALMENTS, OPENING BALANCES AND LATE FEES (school realm, under /fees/invoices). Bodies are validated by the route. */
export class InvoiceExtrasController {
    constructor(private readonly d: Dependencies) {}

    saveInstalments = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.saveInstalmentPlanUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Instalment plan saved successfully"); } catch (e) { next(e); }
    };
    getInstalments = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getInstalmentPlanUseCase.execute(idOf(req)), "Instalment plan retrieved successfully"); } catch (e) { next(e); }
    };
    cancelInstalments = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.cancelInstalmentPlanUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req)), "Instalment plan cancelled successfully"); } catch (e) { next(e); }
    };
    openingBalances = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.openingBalancesUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Opening balances imported"); } catch (e) { next(e); }
    };
    lateFees = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.runLateFeesUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Late fees processed"); } catch (e) { next(e); }
    };
}
