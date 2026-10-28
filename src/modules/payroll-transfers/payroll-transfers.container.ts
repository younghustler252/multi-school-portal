import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { SalaryTransferRepositoryImpl } from "./repositories/salary-transfer.repository.impl";
import { TransferMapper } from "./mappers";
import { TransferOutcomeService } from "./usecases/transfer-outcome.service";
import {
    StartTransfersUseCase, SendTransfersUseCase, ReconcileTransfersUseCase, RetryTransferUseCase, CancelTransferUseCase, GetRunTransfersUseCase, ListTransfersUseCase, HandleTransferEventUseCase,
} from "./usecases/transfer.usecases";
import { TransferController } from "./controllers/transfer.controller";

/* Requires: the payroll module (payrollRunRepository), the ledger module (postingService, ledgerAccountRepository), shared (transferProvider, encryptionService), finance settings and audit. */
export const registerPayrollTransfers = (container: AwilixContainer): void => {
    container.register({
        transferMapper: asClass(TransferMapper).singleton(),
        salaryTransferRepository: asClass(SalaryTransferRepositoryImpl).scoped(),
        transferOutcomeService: asClass(TransferOutcomeService).scoped(),
        startTransfersUseCase: asClass(StartTransfersUseCase).scoped(), sendTransfersUseCase: asClass(SendTransfersUseCase).scoped(),
        reconcileTransfersUseCase: asClass(ReconcileTransfersUseCase).scoped(), retryTransferUseCase: asClass(RetryTransferUseCase).scoped(),
        cancelTransferUseCase: asClass(CancelTransferUseCase).scoped(), getRunTransfersUseCase: asClass(GetRunTransfersUseCase).scoped(),
        listTransfersUseCase: asClass(ListTransfersUseCase).scoped(), handleTransferEventUseCase: asClass(HandleTransferEventUseCase).scoped(),
        transferController: asClass(TransferController).scoped(),
    });
};
