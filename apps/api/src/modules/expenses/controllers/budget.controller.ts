import { Request, Response, NextFunction } from "express";
import {
    ListBudgetsUseCase, GetBudgetUseCase, CreateBudgetUseCase, UpdateBudgetUseCase, SetBudgetLinesUseCase, SetBudgetStatusUseCase, DeleteBudgetUseCase, BudgetVsActualUseCase,
} from "../usecases/budget.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";
import { ListBudgetsQuery } from "../dtos/budget.dto";
import { BudgetVsActualQuery } from "../dtos/expense-report.dto";

interface Dependencies {
    listBudgetsUseCase: ListBudgetsUseCase; getBudgetUseCase: GetBudgetUseCase; createBudgetUseCase: CreateBudgetUseCase; updateBudgetUseCase: UpdateBudgetUseCase;
    setBudgetLinesUseCase: SetBudgetLinesUseCase; setBudgetStatusUseCase: SetBudgetStatusUseCase; deleteBudgetUseCase: DeleteBudgetUseCase; budgetVsActualUseCase: BudgetVsActualUseCase;
}
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
const idOf       = (req: Request): string => String(req.params.id);

/* BUDGET CONTROLLER (school realm, /budgets). */
export class BudgetController {
    constructor(private readonly d: Dependencies) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listBudgetsUseCase.execute(ListBudgetsQuery.parse(req.query));
            res.status(200).json({ success: true, message: "Budgets retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getBudgetUseCase.execute(idOf(req)), "Budget retrieved successfully"); } catch (e) { next(e); }
    };
    create = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.createBudgetUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Budget created successfully"); } catch (e) { next(e); }
    };
    update = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateBudgetUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Budget updated successfully"); } catch (e) { next(e); }
    };
    setLines = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.setBudgetLinesUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Budget lines saved successfully"); } catch (e) { next(e); }
    };
    setStatus = (to: "ACTIVE" | "CLOSED") => async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.setBudgetStatusUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), to), to === "ACTIVE" ? "Budget activated" : "Budget closed"); } catch (e) { next(e); }
    };
    remove = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.deleteBudgetUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req)), "Budget deleted successfully"); } catch (e) { next(e); }
    };
    vsActual = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.budgetVsActualUseCase.execute(idOf(req), BudgetVsActualQuery.parse(req.query)), "Budget comparison retrieved successfully"); } catch (e) { next(e); }
    };
}
