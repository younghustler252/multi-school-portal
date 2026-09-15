import { Request, Response, NextFunction } from "express";
import { CreateFeeTypeUseCase }        from "../usecases/create-fee-type.usecase";
import { GetFeeTypesUseCase }          from "../usecases/get-fee-types.usecase";
import { CreateInvoiceUseCase }        from "../usecases/create-invoice.usecase";
import { UpdateInvoiceUseCase } from "../usecases/update-invoice.usecase";
import { BulkCreateInvoicesUseCase }   from "../usecases/bulk-create-invoices.usecase";
import { GetInvoicesUseCase }          from "../usecases/get-invoices.usecase";
import { GetInvoiceByIdUseCase } from "../usecases/get-invoice-by-id.usecase";
import { GetDefaultersUseCase }        from "../usecases/get-defaulters.usecase";
import { UpdateInvoiceItemUseCase }        from "../usecases/update-invoice-item.usecase";
import { RemoveInvoiceItemUseCase } from "../usecases/remove-invoice-item.usecase";
import { InvoiceClassUseCase }  from "../usecases/invoice-class.usecase";
import { RecordPaymentUseCase } from "../usecases/record-payment.usecase";
import { GetMyChildrenInvoicesUseCase } from "../usecases/get-my-children-invoices.usecase";
import { WaiveInvoiceUseCase } from "../usecases/waive-invoice.usecase";
import { GetInvoicePaymentsUseCase } from "../usecases/get-invoice-payments.usecase"
import {
    sendSuccess,
    sendCreated,
    sendPaginated,
}                                      from "../../../shared/utils/api-response";

interface Dependencies {
    createFeeTypeUseCase:      CreateFeeTypeUseCase;
    getFeeTypesUseCase:        GetFeeTypesUseCase;
    createInvoiceUseCase:      CreateInvoiceUseCase;
    updateInvoiceUseCase:      UpdateInvoiceUseCase;
    bulkCreateInvoicesUseCase: BulkCreateInvoicesUseCase;
    getInvoicesUseCase:        GetInvoicesUseCase;
    getInvoiceByIdUseCase:       GetInvoiceByIdUseCase;
    getDefaultersUseCase:      GetDefaultersUseCase;
    updateInvoiceItemUseCase:      UpdateInvoiceItemUseCase;
    removeInvoiceItemUseCase: RemoveInvoiceItemUseCase;
    invoiceClassUseCase:       InvoiceClassUseCase;
    recordPaymentUseCase:      RecordPaymentUseCase;
    getInvoicePaymentsUseCase: GetInvoicePaymentsUseCase;
    waiveInvoiceUseCase:       WaiveInvoiceUseCase;
    getMyChildrenInvoicesUseCase:  GetMyChildrenInvoicesUseCase;
}

export class FeeController {
    private readonly createFeeTypeUseCase:      CreateFeeTypeUseCase;
    private readonly getFeeTypesUseCase:        GetFeeTypesUseCase;
    private readonly createInvoiceUseCase:      CreateInvoiceUseCase;
    private readonly bulkCreateInvoicesUseCase: BulkCreateInvoicesUseCase;
    private readonly updateInvoiceUseCase:      UpdateInvoiceUseCase;
    private readonly getInvoicesUseCase:        GetInvoicesUseCase;
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase;
    private readonly getDefaultersUseCase:      GetDefaultersUseCase;
    private readonly updateInvoiceItemUseCase:      UpdateInvoiceItemUseCase;
    private readonly removeInvoiceItemUseCase:      RemoveInvoiceItemUseCase;
    private readonly invoiceClassUseCase:       InvoiceClassUseCase;
    private readonly recordPaymentUseCase:      RecordPaymentUseCase;
    private readonly getMyChildrenInvoicesUseCase: GetMyChildrenInvoicesUseCase;
    private readonly getInvoicePaymentsUseCase: GetInvoicePaymentsUseCase;
    private readonly waiveInvoiceUseCase: WaiveInvoiceUseCase;

    constructor({
        createFeeTypeUseCase,
        getFeeTypesUseCase,
        createInvoiceUseCase,
        bulkCreateInvoicesUseCase,
        updateInvoiceUseCase,
        getInvoicesUseCase,
        getInvoiceByIdUseCase,
        getDefaultersUseCase,
        updateInvoiceItemUseCase,
        removeInvoiceItemUseCase,
        invoiceClassUseCase,
        recordPaymentUseCase,
        getMyChildrenInvoicesUseCase,
        getInvoicePaymentsUseCase,
        waiveInvoiceUseCase,

    }: Dependencies) {
        this.createFeeTypeUseCase      = createFeeTypeUseCase;
        this.getFeeTypesUseCase        = getFeeTypesUseCase;
        this.createInvoiceUseCase      = createInvoiceUseCase;
        this.bulkCreateInvoicesUseCase = bulkCreateInvoicesUseCase;
        this.updateInvoiceUseCase      = updateInvoiceUseCase;
        this.getInvoicesUseCase        = getInvoicesUseCase;
        this.getInvoiceByIdUseCase       = getInvoiceByIdUseCase;
        this.getDefaultersUseCase      = getDefaultersUseCase;
        this.updateInvoiceItemUseCase      = updateInvoiceItemUseCase;
        this.removeInvoiceItemUseCase     = removeInvoiceItemUseCase;
        this.invoiceClassUseCase       = invoiceClassUseCase;
        this.recordPaymentUseCase      = recordPaymentUseCase;
        this.getMyChildrenInvoicesUseCase = getMyChildrenInvoicesUseCase;
        this.getInvoicePaymentsUseCase = getInvoicePaymentsUseCase;
        this.waiveInvoiceUseCase = waiveInvoiceUseCase;
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

    getInvoiceById = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getInvoiceByIdUseCase.execute(
                req.params.id as string
            );
            sendSuccess(res, result, "Invoice retrieved successfully");
        } catch (err) {
            next(err);
        }
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
        } catch (err) {
            next(err);
        }
    };


    updateInvoiceItem = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updateInvoiceItemUseCase.execute(
                req.params.itemId as string,
                req.body.amountKobo,
            );
            sendSuccess(res, result, "Invoice item updated successfully");
        } catch (err) {
            next(err);
        }
    };

    removeInvoiceItem = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.removeInvoiceItemUseCase.execute(
                req.params.itemId as string,
            );
            sendSuccess(res, result, "Invoice item removed successfully");
        } catch (err) {
            next(err);
        }
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
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { amountKobo, method, note } = req.body;

            const result = await this.recordPaymentUseCase.execute({
                invoiceId: req.params.invoiceId as string,
                amountKobo,
                method,
                recordedById: req.user?.id as string,
                note,
            });

            sendSuccess(res, result, "Payment recorded successfully");
        } catch (err) {
            next(err);
        }
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

    getInvoicePayments = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getInvoicePaymentsUseCase.execute(
                req.params.id as string,
            );

            sendSuccess(
                res,
                result,
                "Invoice payments retrieved successfully",
            );
        } catch (err) {
            next(err);
        }
    };

    waiveInvoice = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.waiveInvoiceUseCase.execute(
                req.params.id as string,
                req.body.reason,
                req.user?.id as string,
            );

            sendSuccess(
                res,
                result,
                "Invoice waived successfully",
            );
        } catch (err) {
            next(err);
        }
    };
}