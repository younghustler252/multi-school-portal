import { IPaymentProvider }     from "../../../infrastructure/payments/interfaces/payment.provider.interface";
import { VerifyPaymentUseCase } from "./verify-payment.usecase";
import { VerifySubscriptionUpgradeUseCase }       from "../../subscriptions/usecases/school-admin/verify-subscription-upgrade"
import { BadRequestError }      from "../../../shared/errors/domain.errors";
import { PaymentErrorMessage }  from "../domain/payment.enums";

interface Dependencies {
    paymentProvider:      IPaymentProvider;
    verifyPaymentUseCase: VerifyPaymentUseCase;
    verifySubscriptionUpgradeUseCase: VerifySubscriptionUpgradeUseCase;
}

export class HandleWebhookUseCase {
    private readonly paymentProvider:      IPaymentProvider;
    private readonly verifyPaymentUseCase: VerifyPaymentUseCase;
    private readonly verifySubscriptionUpgradeUseCase: VerifySubscriptionUpgradeUseCase;

    constructor({ paymentProvider, verifyPaymentUseCase, verifySubscriptionUpgradeUseCase }: Dependencies) {
        this.paymentProvider      = paymentProvider;
        this.verifyPaymentUseCase = verifyPaymentUseCase;
        this.verifySubscriptionUpgradeUseCase = verifySubscriptionUpgradeUseCase;
    }

    async execute(payload: string, signature: string) {
        const isValid = this.paymentProvider.verifyWebhookSignature(payload, signature);
        if (!isValid) throw new BadRequestError(PaymentErrorMessage.WEBHOOK_INVALID);

        const event = JSON.parse(payload);

        if (event.event === "charge.success") {
            const metaType = event.data.metadata?.type;

            if (metaType === "subscription_upgrade") {
                await this.verifySubscriptionUpgradeUseCase.execute(event.data.reference);
            } else {
                await this.verifyPaymentUseCase.execute({ reference: event.data.reference });
            }

            return { processed: true };
        }

        return { processed: false };
    }
}