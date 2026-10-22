import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { PaymentMapper } from "./mappers/payment.mapper";
import { PaymentRepositoryImpl } from "./repositories/payment.repository.impl";
import { PaymentContextRepositoryImpl } from "./repositories/payment-context.repository.impl";
import { PaymentConfirmationService } from "./services/payment-confirmation.service";
import { RecordPaymentUseCase, ConfirmPaymentUseCase, RejectPaymentUseCase, PreviewAllocationUseCase } from "./usecases/payment-record.usecases";
import { ListPaymentsUseCase, GetPaymentUseCase, GetReceiptUseCase } from "./usecases/payment-queries.usecases";
import { PaymentController } from "./controllers/payment.controller";

/*
| Requires: the ledger module (postingService, numberSequenceService, ledgerAccountRepository), the fees module (feeInvoiceRepository)
| and the audit module (auditService). The online (gateway) payment path joins here in a later piece.
*/
export const registerPayments = (container: AwilixContainer): void => {
    container.register({
        paymentMapper:                asClass(PaymentMapper).singleton(),
        paymentRepository:            asClass(PaymentRepositoryImpl).scoped(),
        paymentContextRepository:     asClass(PaymentContextRepositoryImpl).scoped(),
        paymentConfirmationService:   asClass(PaymentConfirmationService).scoped(),

        recordPaymentUseCase:      asClass(RecordPaymentUseCase).scoped(),
        confirmPaymentUseCase:     asClass(ConfirmPaymentUseCase).scoped(),
        rejectPaymentUseCase:      asClass(RejectPaymentUseCase).scoped(),
        previewAllocationUseCase:  asClass(PreviewAllocationUseCase).scoped(),
        listPaymentsUseCase:       asClass(ListPaymentsUseCase).scoped(),
        getPaymentUseCase:         asClass(GetPaymentUseCase).scoped(),
        getReceiptUseCase:         asClass(GetReceiptUseCase).scoped(),

        paymentController:         asClass(PaymentController).scoped(),
    });
};
