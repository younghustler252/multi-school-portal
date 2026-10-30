import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { SettlementMapper } from "./mappers/settlement.mapper";
import { SettlementRepositoryImpl } from "./repositories/settlement.repository.impl";
import {
    PreviewSettlementReportUseCase, RecordSettlementReportUseCase, SettlePaymentsUseCase, ListUnsettledUseCase, ListSettlementsUseCase,
    GetSettlementUseCase, ReverseSettlementUseCase,
} from "./usecases/settlement.usecases";
import { SettlementController } from "./controllers/settlement.controller";

/* Requires: the ledger module (postingService, ledgerAccountRepository) and the audit module. */
export const registerGatewaySettlements = (container: AwilixContainer): void => {
    container.register({
        settlementMapper: asClass(SettlementMapper).singleton(),
        settlementRepository: asClass(SettlementRepositoryImpl).scoped(),
        previewSettlementReportUseCase: asClass(PreviewSettlementReportUseCase).scoped(), recordSettlementReportUseCase: asClass(RecordSettlementReportUseCase).scoped(),
        settlePaymentsUseCase: asClass(SettlePaymentsUseCase).scoped(), listUnsettledUseCase: asClass(ListUnsettledUseCase).scoped(),
        listSettlementsUseCase: asClass(ListSettlementsUseCase).scoped(), getSettlementUseCase: asClass(GetSettlementUseCase).scoped(),
        reverseSettlementUseCase: asClass(ReverseSettlementUseCase).scoped(),
        settlementController: asClass(SettlementController).scoped(),
    });
};
