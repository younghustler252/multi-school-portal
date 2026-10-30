import { Request, Response, NextFunction } from "express";
import {
    ListAutomationsUseCase, GetAutomationUseCase, UpdateAutomationUseCase, DryRunAutomationUseCase,
    RunAutomationNowUseCase, ListAutomationRunsUseCase,
} from "../usecases/automation.usecases";
import { sendSuccess } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";

interface Dependencies {
    listAutomationsUseCase: ListAutomationsUseCase; getAutomationUseCase: GetAutomationUseCase;
    updateAutomationUseCase: UpdateAutomationUseCase; dryRunAutomationUseCase: DryRunAutomationUseCase;
    runAutomationNowUseCase: RunAutomationNowUseCase; listAutomationRunsUseCase: ListAutomationRunsUseCase;
}
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
const id = (req: Request): string => String(req.params.id);

export class AutomationController {
    constructor(private readonly d: Dependencies) {}
    list = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listAutomationsUseCase.execute(schoolIdOf(req)), "Automations retrieved successfully"); } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getAutomationUseCase.execute(id(req)), "Automation retrieved successfully"); } catch (e) { next(e); }
    };
    update = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateAutomationUseCase.execute(schoolIdOf(req), userIdOf(req), id(req), req.body), "Automation updated successfully"); } catch (e) { next(e); }
    };
    dryRun = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.dryRunAutomationUseCase.execute(schoolIdOf(req), id(req)), "Test run complete. Nothing was sent"); } catch (e) { next(e); }
    };
    run = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.runAutomationNowUseCase.execute(schoolIdOf(req), userIdOf(req), id(req)), "Automation run complete"); } catch (e) { next(e); }
    };
    runs = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listAutomationRunsUseCase.execute(id(req), Number(req.query.limit) || 20), "Runs retrieved successfully"); } catch (e) { next(e); }
    };
}
