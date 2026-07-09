import { asClass }                  from "awilix";
import type { AwilixContainer }     from "awilix";
import { StaffMapper }              from "./mappers/staff.mapper";
import { StaffRepositoryImpl }      from "./repositories/staff.repository.impl";
import { CreateStaffUseCase }       from "./usecases/create-staff.usecase";
import { GetStaffUseCase }          from "./usecases/get-staff.usecase";
import { ListStaffUseCase }         from "./usecases/list-staff.usecase";
import { UpdateStaffUseCase }       from "./usecases/update-staff.usecase";
import { DeactivateStaffUseCase }   from "./usecases/deactivate-staff.usecase";
import { StaffController }          from "./controllers/staff.controller";

/*
|--------------------------------------------------------------------------
| STAFF CONTAINER
|--------------------------------------------------------------------------
*/

export const registerStaff = (container: AwilixContainer): void => {
    container.register({
        staffMapper:             asClass(StaffMapper).singleton(),
        staffRepository:         asClass(StaffRepositoryImpl).scoped(),
        createStaffUseCase:      asClass(CreateStaffUseCase).scoped(),
        getStaffUseCase:         asClass(GetStaffUseCase).scoped(),
        listStaffUseCase:        asClass(ListStaffUseCase).scoped(),
        updateStaffUseCase:      asClass(UpdateStaffUseCase).scoped(),
        deactivateStaffUseCase:  asClass(DeactivateStaffUseCase).scoped(),
        staffController:         asClass(StaffController).scoped(),
    });
};