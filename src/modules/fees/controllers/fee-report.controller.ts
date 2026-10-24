import { Request, Response, NextFunction } from "express";
import { AgeingReportUseCase, DefaultersReportUseCase, CollectionsReportUseCase, StatementUseCase, MyChildrenUseCase, MyInvoicesUseCase, MyStatementUseCase } from "../usecases/fee-report.usecases";
import { sendSuccess } from "../../../shared/utils/api-response";
import { AgeingQuery, DefaultersQuery, CollectionsQuery, StatementQuery, MyInvoicesQuery } from "../dtos/report.dto";

interface Dependencies {
    ageingReportUseCase: AgeingReportUseCase; defaultersReportUseCase: DefaultersReportUseCase; collectionsReportUseCase: CollectionsReportUseCase;
    statementUseCase: StatementUseCase; myChildrenUseCase: MyChildrenUseCase; myInvoicesUseCase: MyInvoicesUseCase; myStatementUseCase: MyStatementUseCase;
}

/* REPORT CONTROLLER (school realm, /fees/reports, /fees/statements, /fees/my). Queries are parsed here. */
const viewerOf = (req: Request) => ({ persona: req.access?.persona ?? null, personaEntityId: req.access?.personaEntityId ?? null });

export class FeeReportController {
    constructor(private readonly d: Dependencies) {}

    ageing = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.ageingReportUseCase.execute(AgeingQuery.parse(req.query)), "Ageing report retrieved successfully"); } catch (e) { next(e); }
    };
    defaulters = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.defaultersReportUseCase.execute(DefaultersQuery.parse(req.query)), "Defaulters retrieved successfully"); } catch (e) { next(e); }
    };
    collections = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.collectionsReportUseCase.execute(CollectionsQuery.parse(req.query)), "Collections report retrieved successfully"); } catch (e) { next(e); }
    };
    statement = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.statementUseCase.execute(String(req.params.studentId), StatementQuery.parse(req.query)), "Statement retrieved successfully"); } catch (e) { next(e); }
    };
    myChildren = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.myChildrenUseCase.execute(viewerOf(req)), "Children retrieved successfully"); } catch (e) { next(e); }
    };
    myInvoices = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.myInvoicesUseCase.execute(viewerOf(req), MyInvoicesQuery.parse(req.query).studentId), "Invoices retrieved successfully"); } catch (e) { next(e); }
    };
    myStatement = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.myStatementUseCase.execute(viewerOf(req), String(req.params.studentId), StatementQuery.parse(req.query)), "Statement retrieved successfully"); } catch (e) { next(e); }
    };
}
