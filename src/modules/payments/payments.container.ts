import { asClass }                    from "awilix";
import type { AwilixContainer }       from "awilix";
import { PaymentMapper }              from "./mappers/payment.mapper";
import { PaymentRepositoryImpl }      from "./repositories/payment.repository.impl";
import { InitializePaymentUseCase }   from "./usecases/initialize-payment.usecase";
import { VerifyPaymentUseCase }       from "./usecases/verify-payment.usecase";
import { HandleWebhookUseCase }       from "./usecases/handle-webhook.usecase";
import { GetPaymentsUseCase }         from "./usecases/get-payments.usecase";
import { PaymentController }          from "./controllers/payment.controller";

export const registerPayments = (container: AwilixContainer): void => {
    container.register({
        paymentMapper:             asClass(PaymentMapper).singleton(),
        paymentRepository:         asClass(PaymentRepositoryImpl).scoped(),
        initializePaymentUseCase:  asClass(InitializePaymentUseCase).scoped(),
        verifyPaymentUseCase:      asClass(VerifyPaymentUseCase).scoped(),
        handleWebhookUseCase:      asClass(HandleWebhookUseCase).scoped(),
        getPaymentsUseCase:        asClass(GetPaymentsUseCase).scoped(),
        paymentController:         asClass(PaymentController).scoped(),
    });
};