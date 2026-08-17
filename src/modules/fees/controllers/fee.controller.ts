import { Request, Response, NextFunction } from "express";
import { CreateFeeTypeUseCase }        from "../usecases/create-fee-type.usecase";
import { GetFeeTypesUseCase }          from "../usecases/get-fee-types.usecase";
import { CreateInvoiceUseCase }        from "../usecases/create-invoice.usecase";
import { BulkCreateInvoicesUseCase }   from "../usecases/bulk-create-invoices.usecase";
import { GetInvoicesUseCase }          from "../usecases/get-invoices.usecase";
import { GetDefaultersUseCase }        from "../usecases/get-defaulters.usecase";
import { UpdateInvoiceUseCase }        from "../usecases/update-invoice.usecase";
import { InvoiceClassUseCase }  from "../usecases/invoice-class.usecase";
import { RecordPaymentUseCase } from "../usecases/record-payment.usecase";
import { GetMyChildrenInvoicesUseCase } from "../usecases/get-my-children-invoices.usecase";
import {
    sendSuccess,
    sendCreated,
    sendPaginated,
}                                      from "../../../shared/utils/api-response";

interface Dependencies {
    createFeeTypeUseCase:      CreateFeeTypeUseCase;
    getFeeTypesUseCase:        GetFeeTypesUseCase;
    createInvoiceUseCase:      CreateInvoiceUseCase;
    bulkCreateInvoicesUseCase: BulkCreateInvoicesUseCase;
    getInvoicesUseCase:        GetInvoicesUseCase;
    getDefaultersUseCase:      GetDefaultersUseCase;
    updateInvoiceUseCase:      UpdateInvoiceUseCase;
    invoiceClassUseCase:       InvoiceClassUseCase;
    recordPaymentUseCase:      RecordPaymentUseCase;

    getMyChildrenInvoicesUseCase:  GetMyChildrenInvoicesUseCase;
}

export class FeeController {
    private readonly createFeeTypeUseCase:      CreateFeeTypeUseCase;
    private readonly getFeeTypesUseCase:        GetFeeTypesUseCase;
    private readonly createInvoiceUseCase:      CreateInvoiceUseCase;
    private readonly bulkCreateInvoicesUseCase: BulkCreateInvoicesUseCase;
    private readonly getInvoicesUseCase:        GetInvoicesUseCase;
    private readonly getDefaultersUseCase:      GetDefaultersUseCase;
    private readonly updateInvoiceUseCase:      UpdateInvoiceUseCase;
    private readonly invoiceClassUseCase:       InvoiceClassUseCase;
    private readonly recordPaymentUseCase:      RecordPaymentUseCase;
    private readonly getMyChildrenInvoicesUseCase: GetMyChildrenInvoicesUseCase;

    constructor({
        createFeeTypeUseCase,
        getFeeTypesUseCase,
        createInvoiceUseCase,
        bulkCreateInvoicesUseCase,
        getInvoicesUseCase,
        getDefaultersUseCase,
        updateInvoiceUseCase,
        invoiceClassUseCase,
        recordPaymentUseCase,
        getMyChildrenInvoicesUseCase
    }: Dependencies) {
        this.createFeeTypeUseCase      = createFeeTypeUseCase;
        this.getFeeTypesUseCase        = getFeeTypesUseCase;
        this.createInvoiceUseCase      = createInvoiceUseCase;
        this.bulkCreateInvoicesUseCase = bulkCreateInvoicesUseCase;
        this.getInvoicesUseCase        = getInvoicesUseCase;
        this.getDefaultersUseCase      = getDefaultersUseCase;
        this.updateInvoiceUseCase      = updateInvoiceUseCase;
        this.invoiceClassUseCase       = invoiceClassUseCase;
        this.recordPaymentUseCase      = recordPaymentUseCase;
        this.getMyChildrenInvoicesUseCase = getMyChildrenInvoicesUseCase;
    }

    // ── Fee Types ─────────────────────────────────────────────────────────
    getFeeTypes = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getFeeTypesUseCase.execute();
            sendSuccess(res, result, "Fee types retrieved successfully");
        } catch (err) { next(err); }
    };

    createFeeType = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.createFeeTypeUseCase.execute(req.body);
            sendCreated(res, result, "Fee type created successfully");
        } catch (err) { next(err); }
    };

    // ── Invoices ──────────────────────────────────────────────────────────
    getInvoices = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getInvoicesUseCase.execute(
                req.query as any,
            );
            sendPaginated(res, result.data, result.meta);
        } catch (err) { next(err); }
    };

    createInvoice = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.createInvoiceUseCase.execute(req.body);
            sendCreated(res, result, "Invoice created successfully");
        } catch (err) { next(err); }
    };

    bulkCreateInvoices = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.bulkCreateInvoicesUseCase.execute(
                req.body,
            );
            sendCreated(
                res,
                result,
                `Created ${result.created.length} invoice(s). Skipped ${result.skipped.length}.`,
            );
        } catch (err) { next(err); }
    };

    updateInvoice = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updateInvoiceUseCase.execute(
                req.params.id as string,
                req.body,
            );
            sendSuccess(res, result, "Invoice updated successfully");
        } catch (err) { next(err); }
    };

    getDefaulters = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getDefaultersUseCase.execute(
                req.query.termId as string,
            );
            sendSuccess(res, result, "Defaulters retrieved successfully");
        } catch (err) { next(err); }
    };


    invoiceClass = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.invoiceClassUseCase.execute(req.body);
            sendCreated(
                res,
                result,
                `Created ${result.created.length} invoice(s). Skipped ${result.skipped.length}.`,
            );
        } catch (err) { next(err); }
    };

    recordPayment = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.recordPaymentUseCase.execute({
                invoiceId:    req.body.invoiceId,
                amountKobo:   req.body.amountKobo,
                recordedById: req.user!.id,
                note:         req.body.note,
            });
            sendSuccess(res, result, "Payment recorded successfully");
        } catch (err) { next(err); }
    };

    // ── Get my children's invoices ───────────────────────────────────────────
    getMyChildrenInvoices = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getMyChildrenInvoicesUseCase.execute(
                req.user?.id as string,
                {
                    studentId: req.query.studentId as string | undefined,
                    termId: req.query.termId as string | undefined,
                    status: req.query.status as string | undefined,
                    page: req.query.page
                        ? Number(req.query.page)
                        : undefined,
                    limit: req.query.limit
                        ? Number(req.query.limit)
                        : undefined,
                },
            );

            sendPaginated(res, result.data, result.meta);
        } catch (err) {
            next(err);
        }
    };
}