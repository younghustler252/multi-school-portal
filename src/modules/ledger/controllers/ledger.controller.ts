import { Request, Response, NextFunction } from "express";
import { ListJournalsUseCase, GetJournalUseCase, ListPeriodsUseCase } from "../usecases/journal-queries.usecases";
import { PostManualJournalUseCase, ReverseJournalUseCase } from "../usecases/journal-commands.usecases";
import { SetOpeningBalanceUseCase, RecordTransferUseCase } from "../usecases/books-commands.usecases";
import { AccountBalancesUseCase, CashBookUseCase } from "../usecases/ledger-report.usecases";
import { ListAccountsUseCase, GetAccountUseCase } from "../usecases/account-queries.usecases";
import { CreateAccountUseCase, UpdateAccountUseCase, SetAccountActiveUseCase, DeleteAccountUseCase } from "../usecases/account-commands.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";
import { ListJournalsQuery, AccountBalancesQuery, CashBookQuery, ListAccountsQuery } from "../dtos/ledger.dto";

interface Dependencies {
    listJournalsUseCase: ListJournalsUseCase; getJournalUseCase: GetJournalUseCase; listPeriodsUseCase: ListPeriodsUseCase;
    postManualJournalUseCase: PostManualJournalUseCase; reverseJournalUseCase: ReverseJournalUseCase;
    setOpeningBalanceUseCase: SetOpeningBalanceUseCase; recordTransferUseCase: RecordTransferUseCase;
    accountBalancesUseCase: AccountBalancesUseCase; cashBookUseCase: CashBookUseCase;
    listAccountsUseCase: ListAccountsUseCase; getAccountUseCase: GetAccountUseCase; createAccountUseCase: CreateAccountUseCase;
    updateAccountUseCase: UpdateAccountUseCase; setAccountActiveUseCase: SetAccountActiveUseCase; deleteAccountUseCase: DeleteAccountUseCase;
}

/*
| LEDGER CONTROLLER (school realm, /finance). The school is the one the host resolved to; the person is req.auth.
| Nothing about who is acting comes from the body. Request bodies are already validated AND converted by the route
| (req.body holds BigInt kobo); query strings are parsed here (the validate middleware does not write them back).
*/
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
const idOf       = (req: Request): string => String(req.params.id);

export class LedgerController {
    constructor(private readonly d: Dependencies) {}

    listJournals = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listJournalsUseCase.execute(ListJournalsQuery.parse(req.query));
            res.status(200).json({ success: true, message: "Journals retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };

    getJournal = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getJournalUseCase.execute(idOf(req)), "Journal retrieved successfully"); } catch (e) { next(e); }
    };

    postManual = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.postManualJournalUseCase.execute(schoolIdOf(req), userIdOf(req), req.body);
            r.duplicate ? sendSuccess(res, r.journal, "Journal was already posted") : sendCreated(res, r.journal, "Journal posted successfully");
        } catch (e) { next(e); }
    };

    reverse = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, (await this.d.reverseJournalUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body)).journal, "Journal reversed successfully"); }
        catch (e) { next(e); }
    };

    openingBalance = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, (await this.d.setOpeningBalanceUseCase.execute(schoolIdOf(req), userIdOf(req), req.body)).journal, "Opening balance saved successfully"); }
        catch (e) { next(e); }
    };

    transfer = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.recordTransferUseCase.execute(schoolIdOf(req), userIdOf(req), req.body);
            r.duplicate ? sendSuccess(res, r.journal, "Transfer was already recorded") : sendCreated(res, r.journal, "Transfer recorded successfully");
        } catch (e) { next(e); }
    };

    periods = async (_req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listPeriodsUseCase.execute(), "Periods retrieved successfully"); } catch (e) { next(e); }
    };

    accountBalances = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const q = AccountBalancesQuery.parse(req.query);
            sendSuccess(res, await this.d.accountBalancesUseCase.execute(q.asOf, q.moneyOnly), "Account balances retrieved successfully");
        } catch (e) { next(e); }
    };

    cashBook = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const q = CashBookQuery.parse(req.query);
            sendSuccess(res, await this.d.cashBookUseCase.execute(q.accountId, q.from, q.to), "Cash book retrieved successfully");
        } catch (e) { next(e); }
    };

    listAccounts = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listAccountsUseCase.execute(ListAccountsQuery.parse(req.query)), "Accounts retrieved successfully"); } catch (e) { next(e); }
    };

    getAccount = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getAccountUseCase.execute(idOf(req)), "Account retrieved successfully"); } catch (e) { next(e); }
    };

    createAccount = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.createAccountUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Account created successfully"); } catch (e) { next(e); }
    };

    updateAccount = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateAccountUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Account updated successfully"); } catch (e) { next(e); }
    };

    deactivateAccount = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.setAccountActiveUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), false), "Account deactivated"); } catch (e) { next(e); }
    };

    reactivateAccount = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.setAccountActiveUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), true), "Account reactivated"); } catch (e) { next(e); }
    };

    deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.deleteAccountUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req)), "Account deleted"); } catch (e) { next(e); }
    };
}
