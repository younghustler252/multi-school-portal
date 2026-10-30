import { Request, Response, NextFunction } from "express";
import {
    ListRecurringUseCase, GetRecurringUseCase, CreateRecurringUseCase, UpdateRecurringUseCase, SetRecurringActiveUseCase, DeleteRecurringUseCase, RunRecurringExpensesUseCase,
} from "../usecases/recurring.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { PermissionDeniedError, UnauthorizedError } from "../../../shared/errors/domain.errors";
import { ListRecurringQuery } from "../dtos/recurring.dto";

interface Dependencies {
    listRecurringUseCase: ListRecurringUseCase; getRecurringUseCase: GetRecurringUseCase; createRecurringUseCase: CreateRecurringUseCase;
    updateRecurringUseCase: UpdateRecurringUseCase; setRecurringActiveUseCase: SetRecurringActiveUseCase; deleteRecurringUseCase: DeleteRecurringUseCase;
    runRecurringExpensesUseCase: RunRecurringExpensesUseCase;
}
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
const idOf       = (req: Request): string => String(req.params.id);

/* Turning on "approve by itself" skips the approver, so it needs the approval permission as well as the permission to manage repeating expenses. */
const requireApprovalRightForAutoApprove = (req: Request): void => {
    if (req.body?.autoApprove === true && !req.access?.can("expenses.approve")) throw new PermissionDeniedError("expenses.approve");
};

/* RECURRING EXPENSE CONTROLLER (school realm, /recurring-expenses). */
export class RecurringController {
    constructor(private readonly d: Dependencies) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listRecurringUseCase.execute(ListRecurringQuery.parse(req.query));
            res.status(200).json({ success: true, message: "Recurring expenses retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getRecurringUseCase.execute(idOf(req)), "Recurring expense retrieved successfully"); } catch (e) { next(e); }
    };
    create = async (req: Request, res: Response, next: NextFunction) => {
        try { requireApprovalRightForAutoApprove(req); sendCreated(res, await this.d.createRecurringUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Recurring expense created successfully"); } catch (e) { next(e); }
    };
    update = async (req: Request, res: Response, next: NextFunction) => {
        try { requireApprovalRightForAutoApprove(req); sendSuccess(res, await this.d.updateRecurringUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Recurring expense updated successfully"); } catch (e) { next(e); }
    };
    setActive = (isActive: boolean) => async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.setRecurringActiveUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), isActive), isActive ? "Recurring expense resumed" : "Recurring expense paused"); } catch (e) { next(e); }
    };
    remove = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.deleteRecurringUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req)), "Recurring expense deleted successfully"); } catch (e) { next(e); }
    };
    /* "Run now": the same work as the daily job, for this school only. */
    runNow = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.runRecurringExpensesUseCase.execute(schoolIdOf(req)), "Recurring expenses processed"); } catch (e) { next(e); }
    };
}
