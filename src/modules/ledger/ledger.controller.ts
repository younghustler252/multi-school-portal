import { Request, Response, NextFunction } from "express";
import type { PostingService } from "./ledger.posting";
import { todayInFinanceZone } from "./ledger.posting";
import type { BooksService } from "./ledger.books";
import type { LedgerReportService } from "./ledger.reports";
import type { LedgerQueryService } from "./ledger.queries";
import { journalSummary, journalDetail, periodOut, balanceRowOut, cashBookOut } from "./ledger.mapper";
import { ListJournalsQuery, AccountBalancesQuery, CashBookQuery } from "./ledger.dto";
import { sendSuccess, sendCreated } from "../../shared/utils/api-response";
import { UnauthorizedError } from "../../shared/errors/domain.errors";

interface Dependencies {
    postingService: PostingService; booksService: BooksService; ledgerReportService: LedgerReportService; ledgerQueryService: LedgerQueryService;
}

/*
| LEDGER CONTROLLER (school realm, /finance). The acting person comes only from the verified session.
| Request bodies are already validated AND converted by the route (req.body holds BigInt kobo); query strings are parsed here (the validate middleware
| does not write query values back). Money leaves as whole kobo (see ledger.mapper).
*/
const actorId = (req: Request): string => {
    if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING");
    return req.auth.userId;
};

export class LedgerController {
    constructor(private readonly d: Dependencies) {}

    listJournals = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const q = ListJournalsQuery.parse(req.query);
            const { rows, total } = await this.d.ledgerQueryService.listJournals(q);
            const totalPages = Math.max(1, Math.ceil(total / q.limit));
            res.status(200).json({
                success: true, message: "Journals retrieved successfully", data: rows.map(journalSummary),
                meta: { total, page: q.page, limit: q.limit, totalPages, hasNext: q.page < totalPages, hasPrev: q.page > 1 },
            });
        } catch (e) { next(e); }
    };

    getJournal = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, journalDetail(await this.d.ledgerQueryService.getJournal(String(req.params.id))), "Journal retrieved successfully"); }
        catch (e) { next(e); }
    };

    postManual = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.booksService.manualJournal({ ...req.body, actorUserId: actorId(req) });
            (r.duplicate ? sendSuccess : sendCreated)(res, journalSummary(r.journal), r.duplicate ? "Journal was already posted" : "Journal posted successfully");
        } catch (e) { next(e); }
    };

    reverse = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.postingService.reverse(String(req.params.id), { ...req.body, actorUserId: actorId(req) });
            sendCreated(res, journalSummary(r.journal), "Journal reversed successfully");
        } catch (e) { next(e); }
    };

    openingBalance = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.booksService.openingBalance({ ...req.body, actorUserId: actorId(req) });
            sendCreated(res, journalSummary(r.journal), "Opening balance saved successfully");
        } catch (e) { next(e); }
    };

    transfer = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.booksService.transfer({ ...req.body, actorUserId: actorId(req) });
            (r.duplicate ? sendSuccess : sendCreated)(res, journalSummary(r.journal), r.duplicate ? "Transfer was already recorded" : "Transfer recorded successfully");
        } catch (e) { next(e); }
    };

    periods = async (_req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, (await this.d.ledgerQueryService.listPeriods()).map(periodOut), "Periods retrieved successfully"); }
        catch (e) { next(e); }
    };

    accountBalances = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const q = AccountBalancesQuery.parse(req.query);
            const asOf = q.asOf ?? todayInFinanceZone(new Date());
            const rows = await this.d.ledgerReportService.accountBalances(asOf, { moneyOnly: q.moneyOnly });
            sendSuccess(res, { asOf, accounts: rows.map(balanceRowOut) }, "Account balances retrieved successfully");
        } catch (e) { next(e); }
    };

    cashBook = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const q = CashBookQuery.parse(req.query);
            sendSuccess(res, cashBookOut(await this.d.ledgerReportService.cashBook(q.accountId, q.from, q.to)), "Cash book retrieved successfully");
        } catch (e) { next(e); }
    };
}
