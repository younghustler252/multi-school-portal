import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { FeeTypeMapper } from "./mappers/fee-type.mapper";
import { FeeStructureMapper } from "./mappers/fee-structure.mapper";
import { FeeDiscountRuleMapper, StudentDiscountMapper } from "./mappers/fee-discount.mapper";
import { FeeTypeRepositoryImpl } from "./repositories/fee-type.repository.impl";
import { FeeStructureRepositoryImpl } from "./repositories/fee-structure.repository.impl";
import { FeeDiscountRepositoryImpl } from "./repositories/fee-discount.repository.impl";
import { ListFeeTypesUseCase, GetFeeTypeUseCase, CreateFeeTypeUseCase, UpdateFeeTypeUseCase, DeleteFeeTypeUseCase } from "./usecases/fee-type.usecases";
import { ListFeeStructuresUseCase, GetFeeStructureUseCase, CreateFeeStructureUseCase, UpdateFeeStructureUseCase, DeleteFeeStructureUseCase } from "./usecases/fee-structure.usecases";
import {
    ListDiscountRulesUseCase, CreateDiscountRuleUseCase, UpdateDiscountRuleUseCase, DeleteDiscountRuleUseCase,
    ListStudentDiscountsUseCase, GiveStudentDiscountUseCase, RemoveStudentDiscountUseCase,
} from "./usecases/fee-discount.usecases";
import { FeeSetupController } from "./controllers/fee-setup.controller";
import { FeeInvoiceMapper } from "./mappers/fee-invoice.mapper";
import { FeeInvoiceRepositoryImpl } from "./repositories/fee-invoice.repository.impl";
import { InvoiceGenerationRepositoryImpl } from "./repositories/invoice-generation.repository.impl";
import { ListInvoicesUseCase, GetInvoiceUseCase } from "./usecases/invoice-queries.usecases";
import { GenerateInvoicesUseCase, CreateInvoiceUseCase, UpdateDraftInvoiceUseCase, DeleteDraftInvoiceUseCase } from "./usecases/invoice-drafts.usecases";
import { IssueInvoiceUseCase, BulkIssueInvoicesUseCase, VoidInvoiceUseCase } from "./usecases/invoice-issue.usecases";
import { FeeAdjustmentMapper } from "./mappers/fee-adjustment.mapper";
import { FeeAdjustmentRepositoryImpl } from "./repositories/fee-adjustment.repository.impl";
import { ListAdjustmentsUseCase, GetAdjustmentUseCase, RequestAdjustmentUseCase, DecideAdjustmentUseCase } from "./usecases/fee-adjustment.usecases";
import { FeeAdjustmentController } from "./controllers/fee-adjustment.controller";
import { FeeReportRepositoryImpl } from "./repositories/fee-report.repository.impl";
import { AgeingReportUseCase, DefaultersReportUseCase, CollectionsReportUseCase, StatementUseCase, MyChildrenUseCase, MyInvoicesUseCase, MyStatementUseCase } from "./usecases/fee-report.usecases";
import { FeeReportController } from "./controllers/fee-report.controller";
import { InstalmentRepositoryImpl } from "./repositories/instalment.repository.impl";
import { SaveInstalmentPlanUseCase, GetInstalmentPlanUseCase, CancelInstalmentPlanUseCase, OpeningBalancesUseCase, RunLateFeesUseCase } from "./usecases/invoice-extras.usecases";
import { InvoiceExtrasController } from "./controllers/invoice-extras.controller";
import { FeeInvoiceController } from "./controllers/fee-invoice.controller";

/*
| Requires: the payments module (paymentRepository, creditService), the audit module (auditService) and the ledger module (ledgerAccountRepository to check income accounts;
| postingService and numberSequenceService to issue invoices).
| Invoices, payments and the rest of fees v2 register here as they are built.
*/
export const registerFees = (container: AwilixContainer): void => {
    container.register({
        feeTypeMapper:         asClass(FeeTypeMapper).singleton(),
        feeStructureMapper:    asClass(FeeStructureMapper).singleton(),
        feeDiscountRuleMapper: asClass(FeeDiscountRuleMapper).singleton(),
        studentDiscountMapper: asClass(StudentDiscountMapper).singleton(),

        feeTypeRepository:      asClass(FeeTypeRepositoryImpl).scoped(),
        feeStructureRepository: asClass(FeeStructureRepositoryImpl).scoped(),
        feeDiscountRepository:  asClass(FeeDiscountRepositoryImpl).scoped(),

        listFeeTypesUseCase:  asClass(ListFeeTypesUseCase).scoped(),
        getFeeTypeUseCase:    asClass(GetFeeTypeUseCase).scoped(),
        createFeeTypeUseCase: asClass(CreateFeeTypeUseCase).scoped(),
        updateFeeTypeUseCase: asClass(UpdateFeeTypeUseCase).scoped(),
        deleteFeeTypeUseCase: asClass(DeleteFeeTypeUseCase).scoped(),

        listFeeStructuresUseCase:  asClass(ListFeeStructuresUseCase).scoped(),
        getFeeStructureUseCase:    asClass(GetFeeStructureUseCase).scoped(),
        createFeeStructureUseCase: asClass(CreateFeeStructureUseCase).scoped(),
        updateFeeStructureUseCase: asClass(UpdateFeeStructureUseCase).scoped(),
        deleteFeeStructureUseCase: asClass(DeleteFeeStructureUseCase).scoped(),

        listDiscountRulesUseCase:     asClass(ListDiscountRulesUseCase).scoped(),
        createDiscountRuleUseCase:    asClass(CreateDiscountRuleUseCase).scoped(),
        updateDiscountRuleUseCase:    asClass(UpdateDiscountRuleUseCase).scoped(),
        deleteDiscountRuleUseCase:    asClass(DeleteDiscountRuleUseCase).scoped(),
        listStudentDiscountsUseCase:  asClass(ListStudentDiscountsUseCase).scoped(),
        giveStudentDiscountUseCase:   asClass(GiveStudentDiscountUseCase).scoped(),
        removeStudentDiscountUseCase: asClass(RemoveStudentDiscountUseCase).scoped(),

        feeSetupController: asClass(FeeSetupController).scoped(),

        feeInvoiceMapper:              asClass(FeeInvoiceMapper).singleton(),
        feeInvoiceRepository:          asClass(FeeInvoiceRepositoryImpl).scoped(),
        invoiceGenerationRepository:   asClass(InvoiceGenerationRepositoryImpl).scoped(),
        listInvoicesUseCase:           asClass(ListInvoicesUseCase).scoped(),
        getInvoiceUseCase:             asClass(GetInvoiceUseCase).scoped(),
        generateInvoicesUseCase:       asClass(GenerateInvoicesUseCase).scoped(),
        createInvoiceUseCase:          asClass(CreateInvoiceUseCase).scoped(),
        updateDraftInvoiceUseCase:     asClass(UpdateDraftInvoiceUseCase).scoped(),
        deleteDraftInvoiceUseCase:     asClass(DeleteDraftInvoiceUseCase).scoped(),
        issueInvoiceUseCase:           asClass(IssueInvoiceUseCase).scoped(),
        bulkIssueInvoicesUseCase:      asClass(BulkIssueInvoicesUseCase).scoped(),
        voidInvoiceUseCase:            asClass(VoidInvoiceUseCase).scoped(),
        feeInvoiceController:          asClass(FeeInvoiceController).scoped(),

        feeAdjustmentMapper:           asClass(FeeAdjustmentMapper).singleton(),
        feeAdjustmentRepository:       asClass(FeeAdjustmentRepositoryImpl).scoped(),
        listAdjustmentsUseCase:        asClass(ListAdjustmentsUseCase).scoped(),
        getAdjustmentUseCase:          asClass(GetAdjustmentUseCase).scoped(),
        requestAdjustmentUseCase:      asClass(RequestAdjustmentUseCase).scoped(),
        decideAdjustmentUseCase:       asClass(DecideAdjustmentUseCase).scoped(),
        feeAdjustmentController:       asClass(FeeAdjustmentController).scoped(),

        feeReportRepository:           asClass(FeeReportRepositoryImpl).scoped(),
        ageingReportUseCase:           asClass(AgeingReportUseCase).scoped(),
        defaultersReportUseCase:       asClass(DefaultersReportUseCase).scoped(),
        collectionsReportUseCase:      asClass(CollectionsReportUseCase).scoped(),
        statementUseCase:              asClass(StatementUseCase).scoped(),
        myChildrenUseCase:             asClass(MyChildrenUseCase).scoped(),
        myInvoicesUseCase:             asClass(MyInvoicesUseCase).scoped(),
        myStatementUseCase:            asClass(MyStatementUseCase).scoped(),
        feeReportController:           asClass(FeeReportController).scoped(),

        instalmentRepository:          asClass(InstalmentRepositoryImpl).scoped(),
        saveInstalmentPlanUseCase:     asClass(SaveInstalmentPlanUseCase).scoped(),
        getInstalmentPlanUseCase:      asClass(GetInstalmentPlanUseCase).scoped(),
        cancelInstalmentPlanUseCase:   asClass(CancelInstalmentPlanUseCase).scoped(),
        openingBalancesUseCase:        asClass(OpeningBalancesUseCase).scoped(),
        runLateFeesUseCase:            asClass(RunLateFeesUseCase).scoped(),
        invoiceExtrasController:       asClass(InvoiceExtrasController).scoped(),
    });
};
