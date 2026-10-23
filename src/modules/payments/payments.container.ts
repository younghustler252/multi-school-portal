import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { PaymentMapper } from "./mappers/payment.mapper";
import { PaymentRepositoryImpl } from "./repositories/payment.repository.impl";
import { PaymentContextRepositoryImpl } from "./repositories/payment-context.repository.impl";
import { PaymentConfirmationService } from "./services/payment-confirmation.service";
import { RecordPaymentUseCase, ConfirmPaymentUseCase, RejectPaymentUseCase, PreviewAllocationUseCase } from "./usecases/payment-record.usecases";
import { ListPaymentsUseCase, GetPaymentUseCase, GetReceiptUseCase } from "./usecases/payment-queries.usecases";
import { RefundMapper } from "./mappers/refund.mapper";
import { RefundRepositoryImpl } from "./repositories/refund.repository.impl";
import { CreditService } from "./services/credit.service";
import { GetCreditUseCase, ApplyCreditUseCase } from "./usecases/credit.usecases";
import { ListRefundsUseCase, GetRefundUseCase, RequestRefundUseCase, DecideRefundUseCase, PayRefundUseCase } from "./usecases/refund.usecases";
import { ReversePaymentUseCase } from "./usecases/payment-reverse.usecase";
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

        refundMapper:                 asClass(RefundMapper).singleton(),
        refundRepository:             asClass(RefundRepositoryImpl).scoped(),
        creditService:                asClass(CreditService).scoped(),
        getCreditUseCase:             asClass(GetCreditUseCase).scoped(),
        applyCreditUseCase:           asClass(ApplyCreditUseCase).scoped(),
        listRefundsUseCase:           asClass(ListRefundsUseCase).scoped(),
        getRefundUseCase:             asClass(GetRefundUseCase).scoped(),
        requestRefundUseCase:         asClass(RequestRefundUseCase).scoped(),
        decideRefundUseCase:          asClass(DecideRefundUseCase).scoped(),
        payRefundUseCase:             asClass(PayRefundUseCase).scoped(),
        reversePaymentUseCase:        asClass(ReversePaymentUseCase).scoped(),

        paymentController:         asClass(PaymentController).scoped(),
    });
};
