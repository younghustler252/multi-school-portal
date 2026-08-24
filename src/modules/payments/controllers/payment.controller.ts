import { Request, Response, NextFunction } from "express";

import { InitializePaymentUseCase }  from "../usecases/initialize-payment.usecase";
import { VerifyPaymentUseCase }      from "../usecases/verify-payment.usecase";
import { HandleWebhookUseCase }      from "../usecases/handle-webhook.usecase";
import { GetPaymentsUseCase }        from "../usecases/get-payments.usecase";
import { GetMyPaymentsUseCase }      from "../usecases/get-my-payments.usecase";
import { ListBanksUseCase }          from "../usecases/list-banks.usecaase";
import { VerifyBankAccountUseCase }  from "../usecases/verify-bank-account.usecase";

import {
    sendSuccess,
    sendPaginated,
} from "../../../shared/utils/api-response";


interface Dependencies {
    initializePaymentUseCase: InitializePaymentUseCase;
    verifyPaymentUseCase:     VerifyPaymentUseCase;
    handleWebhookUseCase:     HandleWebhookUseCase;
    getMyPaymentsUseCase:     GetMyPaymentsUseCase;
    getPaymentsUseCase:       GetPaymentsUseCase;

    // ── Bank verification ────────────────────────────────────────────────
    listBanksUseCase:         ListBanksUseCase;
    verifyBankAccountUseCase: VerifyBankAccountUseCase;
}


export class PaymentController {
    private readonly initializePaymentUseCase: InitializePaymentUseCase;
    private readonly verifyPaymentUseCase:     VerifyPaymentUseCase;
    private readonly handleWebhookUseCase:     HandleWebhookUseCase;
    private readonly getPaymentsUseCase:       GetPaymentsUseCase;
    private readonly getMyPaymentsUseCase:     GetMyPaymentsUseCase;

    // ── Bank verification ────────────────────────────────────────────────
    private readonly listBanksUseCase:         ListBanksUseCase;
    private readonly verifyBankAccountUseCase: VerifyBankAccountUseCase;


    constructor({
        initializePaymentUseCase,
        verifyPaymentUseCase,
        handleWebhookUseCase,
        getPaymentsUseCase,
        getMyPaymentsUseCase,
        listBanksUseCase,
        verifyBankAccountUseCase,
    }: Dependencies) {

        this.initializePaymentUseCase = initializePaymentUseCase;
        this.verifyPaymentUseCase     = verifyPaymentUseCase;
        this.handleWebhookUseCase     = handleWebhookUseCase;
        this.getPaymentsUseCase       = getPaymentsUseCase;
        this.getMyPaymentsUseCase     = getMyPaymentsUseCase;

        // ── Bank verification ────────────────────────────────────────────
        this.listBanksUseCase         = listBanksUseCase;
        this.verifyBankAccountUseCase = verifyBankAccountUseCase;
    }


    // ── Get payments ──────────────────────────────────────────────────────
    getPayments = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getPaymentsUseCase.execute(
                req.query as any,
            );

            sendPaginated(
                res,
                result.data,
                result.meta,
            );
        } catch (err) {
            next(err);
        }
    };


    // ── Get my payments ───────────────────────────────────────────────────
    getMyPayments = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getMyPaymentsUseCase.execute(
                req.user!.id,
                {
                    page: req.query.page
                        ? Number(req.query.page)
                        : undefined,

                    limit: req.query.limit
                        ? Number(req.query.limit)
                        : undefined,
                },
            );

            sendPaginated(
                res,
                result.data,
                result.meta,
            );
        } catch (err) {
            next(err);
        }
    };


    // ── Initialize payment ────────────────────────────────────────────────
    initializePayment = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.initializePaymentUseCase.execute(
                req.body,
                req.user!.id,
                req.user!.schoolId!,
            );

            sendSuccess(
                res,
                result,
                "Payment initialized successfully",
            );
        } catch (err) {
            next(err);
        }
    };


    // ── Verify payment (callback) ─────────────────────────────────────────
    verifyPayment = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.verifyPaymentUseCase.execute({
                reference: req.params.reference as string,
            });

            sendSuccess(
                res,
                result,
                "Payment verified successfully",
            );
        } catch (err) {
            next(err);
        }
    };


    // ── List Nigerian banks ───────────────────────────────────────────────
    listBanks = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.listBanksUseCase.execute();

            sendSuccess(
                res,
                result,
                "Banks retrieved successfully",
            );
        } catch (err) {
            next(err);
        }
    };


    // ── Verify bank account ───────────────────────────────────────────────
    verifyBankAccount = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.verifyBankAccountUseCase.execute({
                accountNumber: req.body.accountNumber,
                bankCode:      req.body.bankCode,
            });

            sendSuccess(
                res,
                result,
                "Bank account verified successfully",
            );
        } catch (err) {
            next(err);
        }
    };


    // ── Paystack webhook ──────────────────────────────────────────────────
    handleWebhook = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const signature =
                req.headers["x-paystack-signature"] as string;

            const payload = JSON.stringify(req.body);

            const result =
                await this.handleWebhookUseCase.execute(
                    payload,
                    signature,
                );

            // Always return 200 to Paystack immediately
            res.status(200).json({
                received: true,
                ...result,
            });

        } catch (err) {

            // Still return 200 so Paystack doesn't retry
            res.status(200).json({
                received: true,
                error: "Processing failed",
            });
        }
    };
}