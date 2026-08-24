import { asClass }                      from "awilix";
import type { AwilixContainer }         from "awilix";
import { GetPlatformStatsUseCase }      from "./usecases/get-platform-stats.usecase";
import { GetAllUsersUseCase }           from "./usecases/get-all-users.usecase";
import { ImpersonateSchoolUseCase }     from "./usecases/impersonate-school.usecase";
import { DeactivateUserUseCase }        from "./usecases/deactivate-user.usecase";
import { SuperAdminController }         from "./controllers/super-admin.controller";
import { GetMrrTrendUseCase } from "./usecases/get-mrr-trend.usecase";

export const registerSuperAdmin = (container: AwilixContainer): void => {
    container.register({
        getPlatformStatsUseCase:  asClass(GetPlatformStatsUseCase).scoped(),
        getAllUsersUseCase:        asClass(GetAllUsersUseCase).scoped(),
        impersonateSchoolUseCase: asClass(ImpersonateSchoolUseCase).scoped(),
        deactivateUserUseCase:    asClass(DeactivateUserUseCase).scoped(),
        getMrrTrendUseCase: asClass(GetMrrTrendUseCase).scoped(),
        superAdminController:     asClass(SuperAdminController).scoped(),
    });
};