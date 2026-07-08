import { asClass }            from "awilix";
import type { AwilixContainer } from "awilix";
import { PlanMapper }         from "./mappers/plan.mapper";
import { PlanRepositoryImpl } from "./repositories/plan.repository.impl";

import { GetPlanByIdUseCase } from "./usecases/public/get-plan-by-id.usecase";
import { DeletePlanUseCase }  from "./usecases/super-admin/delete-plan.usecase";

import { CreatePlanUseCase }  from "./usecases/super-admin/create-plan.usecase";
import { GetPlansUseCase }    from "./usecases/public/get-plans.usecase";
import { UpdatePlanUseCase }  from "./usecases/super-admin/update-plan.usecase";
import { SeedPlansUseCase }   from "./usecases/super-admin/seed-plans.usecase";
import { PlanController }     from "./controllers/plan.controller";

/*
|--------------------------------------------------------------------------
| PLANS CONTAINER
|--------------------------------------------------------------------------
*/

export const registerPlans = (container: AwilixContainer): void => {
    container.register({
        planMapper:         asClass(PlanMapper).singleton(),
        planRepository:     asClass(PlanRepositoryImpl).scoped(),

        getPlansUseCase:    asClass(GetPlansUseCase).scoped(),
        getPlanByIdUseCase: asClass(GetPlanByIdUseCase).scoped(),

        createPlanUseCase:  asClass(CreatePlanUseCase).scoped(),
        updatePlanUseCase:  asClass(UpdatePlanUseCase).scoped(),
        seedPlansUseCase:   asClass(SeedPlansUseCase).scoped(),
        deletePlanUseCase:  asClass(DeletePlanUseCase).scoped(),

        planController:     asClass(PlanController).scoped(),
    });
};