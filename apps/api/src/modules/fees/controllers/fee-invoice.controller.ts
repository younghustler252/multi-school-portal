import { Request, Response, NextFunction } from "express";
import { ListInvoicesUseCase, GetInvoiceUseCase } from "../usecases/invoice-queries.usecases";
import { GenerateInvoicesUseCase, CreateInvoiceUseCase, UpdateDraftInvoiceUseCase, DeleteDraftInvoiceUseCase } from "../usecases/invoice-drafts.usecases";
import { IssueInvoiceUseCase, BulkIssueInvoicesUseCase, VoidInvoiceUseCase } from "../usecases/invoice-issue.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";
import { ListInvoicesQuery } from "../dtos/invoice.dto";

interface Dependencies {
    listInvoicesUseCase: ListInvoicesUseCase; getInvoiceUseCase: GetInvoiceUseCase;
    generateInvoicesUseCase: GenerateInvoicesUseCase; createInvoiceUseCase: CreateInvoiceUseCase;
    updateDraftInvoiceUseCase: UpdateDraftInvoiceUseCase; deleteDraftInvoiceUseCase: DeleteDraftInvoiceUseCase;
    issueInvoiceUseCase: IssueInvoiceUseCase; bulkIssueInvoicesUseCase: BulkIssueInvoicesUseCase; voidInvoiceUseCase: VoidInvoiceUseCase;
}

/* INVOICE CONTROLLER (school realm, /fees/invoices). Bodies are already validated and converted by the route; queries are parsed here. */
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
const idOf       = (req: Request): string => String(req.params.id);

export class FeeInvoiceController {
    constructor(private readonly d: Dependencies) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listInvoicesUseCase.execute(ListInvoicesQuery.parse(req.query));
            res.status(200).json({ success: true, message: "Invoices retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getInvoiceUseCase.execute(idOf(req)), "Invoice retrieved successfully"); } catch (e) { next(e); }
    };
    generate = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.generateInvoicesUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Draft invoices generated successfully"); } catch (e) { next(e); }
    };
    create = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.createInvoiceUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Draft invoice created successfully"); } catch (e) { next(e); }
    };
    update = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateDraftInvoiceUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Draft invoice updated successfully"); } catch (e) { next(e); }
    };
    remove = async (req: Request, res: Response, next: NextFunction) => {
        try { await this.d.deleteDraftInvoiceUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req)); sendSuccess(res, null, "Draft invoice deleted successfully"); } catch (e) { next(e); }
    };
    issue = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.issueInvoiceUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Invoice issued successfully"); } catch (e) { next(e); }
    };
    bulkIssue = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.bulkIssueInvoicesUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Invoices issued"); } catch (e) { next(e); }
    };
    voidInvoice = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.voidInvoiceUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Invoice voided successfully"); } catch (e) { next(e); }
    };
}
