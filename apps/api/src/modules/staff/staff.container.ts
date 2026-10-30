import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { StaffMapper } from "./mappers/staff.mapper";
import { StaffRepositoryImpl } from "./repositories/staff.repository.impl";
import { StaffPortalService } from "./services/staff-portal.service";
import { NumberSequenceService } from "../../shared/services/number-sequence.service";
import { ListStaffUseCase, GetStaffUseCase, GetMyStaffProfileUseCase, ExportStaffUseCase } from "./usecases/staff-queries.usecases";
import { CreateStaffUseCase } from "./usecases/create-staff.usecase";
import { UpdateStaffUseCase } from "./usecases/update-staff.usecase";
import { SetStaffBranchesUseCase } from "./usecases/staff-branches.usecase";
import { DeactivateStaffUseCase, ReactivateStaffUseCase } from "./usecases/staff-status.usecases";
import { InviteStaffUseCase, ChangeStaffRolesUseCase } from "./usecases/staff-portal.usecases";
import { GetMyClassesUseCase, GetStaffAssignmentsUseCase } from "./usecases/staff-assignments.usecases";
import { StaffController } from "./controllers/staff.controller";

/*
| Requires: registerAuth (membershipService, sendInviteUseCase, refreshTokenRepository), registerFoundation (accessService),
| registerBranches is NOT required here, audit, and (for the two assignment endpoints) the classes and sessions modules.
*/
export const registerStaff = (container: AwilixContainer): void => {
    container.register({
        staffMapper:           asClass(StaffMapper).singleton(),
        staffRepository:       asClass(StaffRepositoryImpl).scoped(),
        staffPortalService:    asClass(StaffPortalService).scoped(),
        numberSequenceService: asClass(NumberSequenceService).singleton(),

        listStaffUseCase:         asClass(ListStaffUseCase).scoped(),
        getStaffUseCase:          asClass(GetStaffUseCase).scoped(),
        getMyStaffProfileUseCase: asClass(GetMyStaffProfileUseCase).scoped(),
        exportStaffUseCase:       asClass(ExportStaffUseCase).scoped(),
        createStaffUseCase:       asClass(CreateStaffUseCase).scoped(),
        updateStaffUseCase:       asClass(UpdateStaffUseCase).scoped(),
        setStaffBranchesUseCase:  asClass(SetStaffBranchesUseCase).scoped(),
        deactivateStaffUseCase:   asClass(DeactivateStaffUseCase).scoped(),
        reactivateStaffUseCase:   asClass(ReactivateStaffUseCase).scoped(),
        inviteStaffUseCase:       asClass(InviteStaffUseCase).scoped(),
        changeStaffRolesUseCase:  asClass(ChangeStaffRolesUseCase).scoped(),
        getMyClassesUseCase:      asClass(GetMyClassesUseCase).scoped(),
        getStaffAssignmentsUseCase: asClass(GetStaffAssignmentsUseCase).scoped(),

        staffController:       asClass(StaffController).scoped(),
    });
};
