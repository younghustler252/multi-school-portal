import { Request, Response, NextFunction } from "express";
import { InitializePaymentUseCase }  from "../usecases/initialize-payment.usecase";
import { VerifyPaymentUseCase }      from "../usecases/verify-payment.usecase";
import { HandleWebhookUseCase }      from "../usecases/handle-webhook.usecase";
import { GetPaymentsUseCase }        from "../usecases/get-payments.usecase";
import {
    sendSuccess,
    sendPaginated,
}                                    from "../../../shared/utils/api-response";

interface Dependencies {
    initializePaymentUseCase: InitializePaymentUseCase;
    verifyPaymentUseCase:     VerifyPaymentUseCase;
    handleWebhookUseCase:     HandleWebhookUseCase;
    getPaymentsUseCase:       GetPaymentsUseCase;
}

export class PaymentController {
    private readonly initializePaymentUseCase: InitializePaymentUseCase;
    private readonly verifyPaymentUseCase:     VerifyPaymentUseCase;
    private readonly handleWebhookUseCase:     HandleWebhookUseCase;
    private readonly getPaymentsUseCase:       GetPaymentsUseCase;

    constructor({
        initializePaymentUseCase,
        verifyPaymentUseCase,
        handleWebhookUseCase,
        getPaymentsUseCase,
    }: Dependencies) {
        this.initializePaymentUseCase = initializePaymentUseCase;
        this.verifyPaymentUseCase     = verifyPaymentUseCase;
        this.handleWebhookUseCase     = handleWebhookUseCase;
        this.getPaymentsUseCase       = getPaymentsUseCase;
    }

    // ── Get payments ──────────────────────────────────────────────────────
    getPayments = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getPaymentsUseCase.execute(
                req.query as any,
            );
            sendPaginated(res, result.data, result.meta);
        } catch (err) { next(err); }
    };

    // ── Initialize payment ────────────────────────────────────────────────
    initializePayment = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.initializePaymentUseCase.execute(
                req.body,
                req.user!.id,
            );
            sendSuccess(res, result, "Payment initialized successfully");
        } catch (err) { next(err); }
    };

    // ── Verify payment (callback) ─────────────────────────────────────────
    verifyPayment = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.verifyPaymentUseCase.execute({
                reference: req.params.reference as string,
            });
            sendSuccess(res, result, "Payment verified successfully");
        } catch (err) { next(err); }
    };

    // ── Paystack webhook ──────────────────────────────────────────────────
    handleWebhook = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const signature = req.headers["x-paystack-signature"] as string;
            const payload   = JSON.stringify(req.body);

            const result = await this.handleWebhookUseCase.execute(
                payload,
                signature,
            );

            // Always return 200 to Paystack immediately
            res.status(200).json({ received: true, ...result });
        } catch (err) {
            // Still return 200 so Paystack doesn't retry
            res.status(200).json({ received: true, error: "Processing failed" });
        }
    };
}