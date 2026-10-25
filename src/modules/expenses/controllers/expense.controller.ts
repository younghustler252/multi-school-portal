import { Request, Response, NextFunction } from "express";
import { ListExpensesUseCase, GetExpenseUseCase } from "../usecases/expense-queries.usecases";
import { CreateExpenseUseCase, UpdateExpenseUseCase, DeleteExpenseUseCase, SubmitExpenseUseCase, ApproveExpenseUseCase, RejectExpenseUseCase, VoidExpenseUseCase } from "../usecases/expense-commands.usecases";
import { PayExpenseUseCase, ReverseExpensePaymentUseCase } from "../usecases/expense-payments.usecases";
import { ExpenseReportUseCase, CreditorsReportUseCase, PettyCashUseCase } from "../usecases/expense-report.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";
import { ListExpensesQuery } from "../dtos/expense.dto";
import { ExpenseReportQuery, CreditorsQuery, PettyCashQuery } from "../dtos/expense-report.dto";

interface Dependencies {
    listExpensesUseCase: ListExpensesUseCase; getExpenseUseCase: GetExpenseUseCase;
    createExpenseUseCase: CreateExpenseUseCase; updateExpenseUseCase: UpdateExpenseUseCase; deleteExpenseUseCase: DeleteExpenseUseCase;
    submitExpenseUseCase: SubmitExpenseUseCase; approveExpenseUseCase: ApproveExpenseUseCase; rejectExpenseUseCase: RejectExpenseUseCase; voidExpenseUseCase: VoidExpenseUseCase;
    payExpenseUseCase: PayExpenseUseCase; reverseExpensePaymentUseCase: ReverseExpensePaymentUseCase;
    expenseReportUseCase: ExpenseReportUseCase; creditorsReportUseCase: CreditorsReportUseCase; pettyCashUseCase: PettyCashUseCase;
}

/* EXPENSE CONTROLLER (school realm, /expenses). Bodies are already validated and converted by the route; queries are parsed here. */
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
const idOf       = (req: Request): string => String(req.params.id);

export class ExpenseController {
    constructor(private readonly d: Dependencies) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listExpensesUseCase.execute(ListExpensesQuery.parse(req.query));
            res.status(200).json({ success: true, message: "Expenses retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getExpenseUseCase.execute(idOf(req)), "Expense retrieved successfully"); } catch (e) { next(e); }
    };
    create = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.createExpenseUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Draft expense created successfully"); } catch (e) { next(e); }
    };
    update = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateExpenseUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Expense updated successfully"); } catch (e) { next(e); }
    };
    remove = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.deleteExpenseUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req)), "Expense deleted successfully"); } catch (e) { next(e); }
    };
    submit = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.submitExpenseUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Expense submitted successfully"); } catch (e) { next(e); }
    };
    approve = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.approveExpenseUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Expense approved successfully"); } catch (e) { next(e); }
    };
    reject = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.rejectExpenseUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Expense rejected"); } catch (e) { next(e); }
    };
    voidExpense = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.voidExpenseUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Expense voided successfully"); } catch (e) { next(e); }
    };
    pay = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.payExpenseUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Payment recorded successfully"); } catch (e) { next(e); }
    };
    reversePayment = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.reverseExpensePaymentUseCase.execute(idOf(req), String(req.params.paymentId), schoolIdOf(req), userIdOf(req), req.body), "Payment reversed successfully"); } catch (e) { next(e); }
    };

    expenseReport = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.expenseReportUseCase.execute(ExpenseReportQuery.parse(req.query)), "Expense report retrieved successfully"); } catch (e) { next(e); }
    };
    creditors = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.creditorsReportUseCase.execute(CreditorsQuery.parse(req.query)), "Creditors retrieved successfully"); } catch (e) { next(e); }
    };
    pettyCash = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.pettyCashUseCase.execute(PettyCashQuery.parse(req.query)), "Petty cash retrieved successfully"); } catch (e) { next(e); }
    };
}
