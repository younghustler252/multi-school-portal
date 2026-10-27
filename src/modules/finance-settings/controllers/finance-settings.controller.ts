import { Request, Response, NextFunction } from "express";
import { GetFinanceSettingsUseCase, UpdateFinanceSettingsUseCase } from "../usecases/finance-settings.usecases";
import { sendSuccess } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";

interface Dependencies { getFinanceSettingsUseCase: GetFinanceSettingsUseCase; updateFinanceSettingsUseCase: UpdateFinanceSettingsUseCase }

const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };

export class FinanceSettingsController {
    constructor(private readonly d: Dependencies) {}

    get = async (_req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getFinanceSettingsUseCase.execute(), "Finance settings retrieved successfully"); } catch (e) { next(e); }
    };

    update = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateFinanceSettingsUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Finance settings updated successfully"); }
        catch (e) { next(e); }
    };
}
