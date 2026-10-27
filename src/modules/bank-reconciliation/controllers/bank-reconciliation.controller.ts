import { Request, Response, NextFunction } from "express";
import { ImportStatementUseCase, ListStatementsUseCase, DeleteStatementUseCase } from "../usecases/statement.usecases";
import {
    ListBankLinesUseCase, ListBookLinesUseCase, SuggestMatchesUseCase, AutoMatchUseCase, CreateMatchUseCase, RemoveMatchUseCase,
    ClearBookLinesUseCase, CreateEntryFromBankLineUseCase,
} from "../usecases/matching.usecases";
import {
    ReconciliationSummaryUseCase, CompleteReconciliationUseCase, ReopenReconciliationUseCase, ListReconciliationsUseCase, AccountsOverviewUseCase,
} from "../usecases/reconciliation.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";
import {
    ListStatementsQuery, BankLinesQuery, BookLinesQuery, SuggestionsQuery, SummaryQuery, ReconciliationsQuery,
} from "../dtos/bank-reconciliation.dto";

interface Dependencies {
    importStatementUseCase: ImportStatementUseCase; listStatementsUseCase: ListStatementsUseCase; deleteStatementUseCase: DeleteStatementUseCase;
    listBankLinesUseCase: ListBankLinesUseCase; listBookLinesUseCase: ListBookLinesUseCase; suggestMatchesUseCase: SuggestMatchesUseCase;
    autoMatchUseCase: AutoMatchUseCase; createMatchUseCase: CreateMatchUseCase; removeMatchUseCase: RemoveMatchUseCase;
    clearBookLinesUseCase: ClearBookLinesUseCase; createEntryFromBankLineUseCase: CreateEntryFromBankLineUseCase;
    reconciliationSummaryUseCase: ReconciliationSummaryUseCase; completeReconciliationUseCase: CompleteReconciliationUseCase;
    reopenReconciliationUseCase: ReopenReconciliationUseCase; listReconciliationsUseCase: ListReconciliationsUseCase; accountsOverviewUseCase: AccountsOverviewUseCase;
}

/*
| BANK RECONCILIATION CONTROLLER (school realm, /finance/reconciliation). The school is the one the host resolved to; the person is req.auth.
| Request bodies are already validated AND converted by the route (BigInt kobo); query strings are parsed here.
*/
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
const idOf       = (req: Request): string => String(req.params.id);

export class BankReconciliationController {
    constructor(private readonly d: Dependencies) {}

    accounts = async (_req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.accountsOverviewUseCase.execute(), "Bank accounts retrieved successfully"); } catch (e) { next(e); }
    };

    importStatement = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.importStatementUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Bank statement imported successfully"); } catch (e) { next(e); }
    };

    listStatements = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listStatementsUseCase.execute(ListStatementsQuery.parse(req.query));
            res.status(200).json({ success: true, message: "Bank statements retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };

    deleteStatement = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.deleteStatementUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req)), "Bank statement deleted successfully"); } catch (e) { next(e); }
    };

    bankLines = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listBankLinesUseCase.execute(BankLinesQuery.parse(req.query));
            res.status(200).json({ success: true, message: "Bank lines retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };

    bookLines = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listBookLinesUseCase.execute(BookLinesQuery.parse(req.query));
            res.status(200).json({ success: true, message: "Book entries retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };

    suggestions = async (req: Request, res: Response, next: NextFunction) => {
        try { const q = SuggestionsQuery.parse(req.query); sendSuccess(res, await this.d.suggestMatchesUseCase.execute(q.accountId, q.asOf), "Suggested matches retrieved successfully"); }
        catch (e) { next(e); }
    };

    autoMatch = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.autoMatchUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Automatic matching finished"); } catch (e) { next(e); }
    };

    createMatch = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.createMatchUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Lines matched successfully"); } catch (e) { next(e); }
    };

    removeMatch = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.removeMatchUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req)), "Match removed successfully"); } catch (e) { next(e); }
    };

    clearBookLines = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.clearBookLinesUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Entries cleared successfully"); } catch (e) { next(e); }
    };

    createEntry = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.createEntryFromBankLineUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Entry recorded and matched successfully"); }
        catch (e) { next(e); }
    };

    summary = async (req: Request, res: Response, next: NextFunction) => {
        try { const q = SummaryQuery.parse(req.query); sendSuccess(res, await this.d.reconciliationSummaryUseCase.execute(q.accountId, q.periodId, q.statementBalanceKobo), "Reconciliation retrieved successfully"); }
        catch (e) { next(e); }
    };

    listReconciliations = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listReconciliationsUseCase.execute(ReconciliationsQuery.parse(req.query).accountId), "Reconciliations retrieved successfully"); }
        catch (e) { next(e); }
    };

    complete = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.completeReconciliationUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Reconciliation completed successfully"); } catch (e) { next(e); }
    };

    reopen = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.reopenReconciliationUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Reconciliation reopened successfully"); } catch (e) { next(e); }
    };
}
