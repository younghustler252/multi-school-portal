import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { BranchMapper } from "./mappers/branch.mapper";
import { BranchRepositoryImpl } from "./repositories/branch.repository.impl";
import { BranchUsageService } from "./services/branch-usage.service";
import { ListBranchesUseCase, GetMyBranchesUseCase, GetBranchUseCase, ListBranchMembersUseCase } from "./usecases/branch-queries.usecases";
import { CreateBranchUseCase, UpdateBranchUseCase, SetBranchActiveUseCase, DeleteBranchUseCase } from "./usecases/branch-commands.usecases";
import { BranchController } from "./controllers/branch.controller";

/* Requires: the audit module. */
export const registerBranches = (container: AwilixContainer): void => {
    container.register({
        branchMapper:        asClass(BranchMapper).singleton(),
        branchRepository:    asClass(BranchRepositoryImpl).scoped(),
        branchUsageService:  asClass(BranchUsageService).scoped(),

        listBranchesUseCase:      asClass(ListBranchesUseCase).scoped(),
        getMyBranchesUseCase:     asClass(GetMyBranchesUseCase).scoped(),
        getBranchUseCase:         asClass(GetBranchUseCase).scoped(),
        listBranchMembersUseCase: asClass(ListBranchMembersUseCase).scoped(),
        createBranchUseCase:      asClass(CreateBranchUseCase).scoped(),
        updateBranchUseCase:      asClass(UpdateBranchUseCase).scoped(),
        setBranchActiveUseCase:   asClass(SetBranchActiveUseCase).scoped(),
        deleteBranchUseCase:      asClass(DeleteBranchUseCase).scoped(),

        branchController:    asClass(BranchController).scoped(),
    });
};
