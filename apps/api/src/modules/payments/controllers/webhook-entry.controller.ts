// modules/payments/controllers/webhook-entry.ts
import { Request, Response, NextFunction } from "express";
import { container } from "../../../container";
import { HandleWebhookUseCase } from "../usecases/handle-webhook.usecase";

export const handlePaystackWebhook = async (
    req:  Request,
    res:  Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const signature = req.headers["x-paystack-signature"] as string;
        const rawBody   = req.body.toString("utf8"); // Buffer, thanks to express.raw()

        const useCase = container.resolve<HandleWebhookUseCase>("handleWebhookUseCase");
        const result  = await useCase.execute(rawBody, signature);

        res.status(200).json(result); // Paystack expects a fast 200 regardless of processing outcome
    } catch (err) {
        // Never let a webhook processing error propagate as a 4xx/5xx to
        // Paystack — that triggers their retry storm. Log it, but ack.
        console.error("Webhook processing error:", err);
        res.status(200).json({ processed: false });
    }
};