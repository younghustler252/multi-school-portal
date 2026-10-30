import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { PlanMapper } from "./mappers/plan.mapper";
import { PlanRepositoryImpl } from "./repositories/plan.repository.impl";
import { PlanEntitlementService } from "./services/plan-entitlement.service";

import { GetPublicPlansUseCase } from "./usecases/get-public-plans.usecase";
import { GetPublicPlanUseCase } from "./usecases/get-public-plan.usecase";

import { ListPlansUseCase } from "./usecases/platform/list-plans.usecase";
import { GetPlatformPlanUseCase } from "./usecases/platform/get-plan.usecase";
import { CreatePlanUseCase } from "./usecases/platform/create-plan.usecase";
import { UpdatePlanUseCase } from "./usecases/platform/update-plan.usecase";
import { SetPlanEntitlementsUseCase } from "./usecases/platform/set-plan-entitlements.usecase";
import { DeactivatePlanUseCase, ReactivatePlanUseCase } from "./usecases/platform/plan-status.usecases";
import { ClonePlanUseCase } from "./usecases/platform/clone-plan.usecase";

import { PlanController } from "./controllers/plan.controller";
import { PlanPlatformController } from "./controllers/plan-platform.controller";

/* Requires: prismaClient (registerShared) and the audit module. No dependency on subscriptions (counts are read directly). */
export const registerPlans = (container: AwilixContainer): void => {
    container.register({
        planMapper:             asClass(PlanMapper).singleton(),
        planRepository:         asClass(PlanRepositoryImpl).scoped(),
        planEntitlementService: asClass(PlanEntitlementService).scoped(),

        getPublicPlansUseCase: asClass(GetPublicPlansUseCase).scoped(),
        getPublicPlanUseCase:  asClass(GetPublicPlanUseCase).scoped(),

        listPlansUseCase:          asClass(ListPlansUseCase).scoped(),
        getPlatformPlanUseCase:    asClass(GetPlatformPlanUseCase).scoped(),
        createPlanUseCase:         asClass(CreatePlanUseCase).scoped(),
        updatePlanUseCase:         asClass(UpdatePlanUseCase).scoped(),
        setPlanEntitlementsUseCase: asClass(SetPlanEntitlementsUseCase).scoped(),
        deactivatePlanUseCase:     asClass(DeactivatePlanUseCase).scoped(),
        reactivatePlanUseCase:     asClass(ReactivatePlanUseCase).scoped(),
        clonePlanUseCase:          asClass(ClonePlanUseCase).scoped(),

        planController:         asClass(PlanController).scoped(),
        planPlatformController: asClass(PlanPlatformController).scoped(),
    });
};
