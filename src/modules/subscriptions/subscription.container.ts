import { asClass }                      from "awilix";
import type { AwilixContainer }         from "awilix";
import { SubscriptionMapper }           from "./mappers/subscription.mapper";
import { SubscriptionRepositoryImpl }   from "./repository/subscription.repository.impl";
import { CreateSubscriptionUseCase }    from "./usecases/super-admin/create-subscription.usecase";
import { GetSubscriptionUseCase }       from "./usecases/school-admin/get-subscription.usecase";
import { UpgradePlanUseCase }           from "./usecases/school-admin/upgrade-plan.usecase";
import { CancelSubscriptionUseCase }    from "./usecases/school-admin/cancel-subscription.usecase";
import { GetAllSubscriptionsUseCase }     from "./usecases/super-admin/get-all-subscriptions.usecase";
import { GetSubscriptionBySchoolUseCase } from "./usecases/super-admin/get-subscription-by-school.usecase";
import { DeactivateSubscriptionUseCase }  from "./usecases/super-admin/deactivate-subscription.usecase";

import { SubscriptionController }       from "./controllers/subscription.controller";

/*
|--------------------------------------------------------------------------
| SUBSCRIPTION CONTAINER
|--------------------------------------------------------------------------
*/

export const registerSubscriptions = (container: AwilixContainer): void => {
    container.register({
        subscriptionMapper:           asClass(SubscriptionMapper).singleton(),
        subscriptionRepository:       asClass(SubscriptionRepositoryImpl).scoped(),

        getSubscriptionUseCase:       asClass(GetSubscriptionUseCase).scoped(),
        upgradePlanUseCase:           asClass(UpgradePlanUseCase).scoped(),
        cancelSubscriptionUseCase:    asClass(CancelSubscriptionUseCase).scoped(),
        
        createSubscriptionUseCase:    asClass(CreateSubscriptionUseCase).scoped(),
        getAllSubscriptionsUseCase:     asClass(GetAllSubscriptionsUseCase).scoped(),
        getSubscriptionBySchoolUseCase: asClass(GetSubscriptionBySchoolUseCase).scoped(),
        deactivateSubscriptionUseCase:  asClass(DeactivateSubscriptionUseCase).scoped(),
        
        subscriptionController:       asClass(SubscriptionController).scoped(),
    });
};