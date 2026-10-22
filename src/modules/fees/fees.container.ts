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
import { FeeInvoiceController } from "./controllers/fee-invoice.controller";

/*
| Requires: the audit module (auditService) and the ledger module (ledgerAccountRepository to check income accounts;
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
    });
};
