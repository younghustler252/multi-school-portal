import { PaystackProvider }    from "../../../infrastructure/payments/paystack.provider";
import { VerifyPaymentUseCase } from "./verify-payment.usecase";
import { BadRequestError }     from "../../../shared/errors/domain.errors";
import { PaymentErrorMessage } from "../domain/payment.enums";

/*
|--------------------------------------------------------------------------
| HANDLE WEBHOOK USE CASE
| Processes Paystack webhook events
| Must verify signature before processing
|--------------------------------------------------------------------------
*/

interface Dependencies {
    paymentProvider:    PaystackProvider;
    verifyPaymentUseCase: VerifyPaymentUseCase;
}

export class HandleWebhookUseCase {
    private readonly paymentProvider:     PaystackProvider;
    private readonly verifyPaymentUseCase: VerifyPaymentUseCase;

    constructor({ paymentProvider, verifyPaymentUseCase }: Dependencies) {
        this.paymentProvider      = paymentProvider;
        this.verifyPaymentUseCase = verifyPaymentUseCase;
    }

    async execute(
        payload:   string,
        signature: string,
    ): Promise<{ processed: boolean }> {

        // ── Verify webhook signature ──────────────────────────────────────
        const isValid = this.paymentProvider.verifyWebhookSignature(
            payload,
            signature,
        );

        if (!isValid) {
            throw new BadRequestError(PaymentErrorMessage.WEBHOOK_INVALID);
        }

        const event = JSON.parse(payload);

        // ── Only handle successful charge events ──────────────────────────
        if (event.event === "charge.success") {
            await this.verifyPaymentUseCase.execute({
                reference: event.data.reference,
            });
            return { processed: true };
        }

        return { processed: false };
    }
}