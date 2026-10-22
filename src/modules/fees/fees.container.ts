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

/*
| Requires: the audit module (auditService) and the ledger module (ledgerAccountRepository, to check income accounts).
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
    });
};
