import { asClass }                      from "awilix";
import type { AwilixContainer }         from "awilix";
import { SubscriptionMapper }           from "./mappers/subscription.mapper";
import { SubscriptionRepositoryImpl }   from "./repositories/subscription.repository.impl";
import { CreateSubscriptionUseCase }    from "./usecases/super-admin/create-subscription.usecase";
import { GetSubscriptionUseCase }       from "./usecases/school-admin/get-subscription.usecase";
import { InitiateSubscriptionUpgradeUseCase }           from "./usecases/school-admin/initiate-upgrade-subscription.usecase";
import { VerifySubscriptionUpgradeUseCase } from "./usecases/school-admin/verify-subscription-upgrade";
import { GetMyBillingHistoryUseCase } from "./usecases/school-admin/get-my-billing-history.ysecase";
import { RequestDowngradeUseCase } from "./usecases/school-admin/request-downgrade.usecase";
import { CancelSubscriptionUseCase }    from "./usecases/school-admin/cancel-subscription.usecase";
import { GetAllSubscriptionsUseCase }     from "./usecases/super-admin/get-all-subscriptions.usecase";
import { GetSubscriptionBySchoolUseCase } from "./usecases/super-admin/get-subscription-by-school.usecase";
import { DeactivateSubscriptionUseCase }  from "./usecases/super-admin/deactivate-subscription.usecase";
import { ToggleSubscriptionAutoRenewUseCase } from "./usecases/school-admin/toggle-subscription-auto-renew";
import { GetSchoolBillingHistoryUseCase } from "./usecases/super-admin/get-school-billing-history.usecase";
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
        initiateSubscriptionUpgradeUseCase:           asClass(InitiateSubscriptionUpgradeUseCase).scoped(),
        verifySubscriptionUpgradeUseCase:             asClass(VerifySubscriptionUpgradeUseCase).scoped(),
        cancelSubscriptionUseCase:    asClass(CancelSubscriptionUseCase).scoped(),
        toggleSubscriptionAutoRenewUseCase: asClass(ToggleSubscriptionAutoRenewUseCase).scoped(),
        getMyBillingHistoryUseCase: asClass(GetMyBillingHistoryUseCase).scoped(),
        requestDowngradeUseCase: asClass(RequestDowngradeUseCase).scoped(),

        createSubscriptionUseCase:    asClass(CreateSubscriptionUseCase).scoped(),
        getAllSubscriptionsUseCase:     asClass(GetAllSubscriptionsUseCase).scoped(),
        getSubscriptionBySchoolUseCase: asClass(GetSubscriptionBySchoolUseCase).scoped(),
        deactivateSubscriptionUseCase:  asClass(DeactivateSubscriptionUseCase).scoped(),
        getSchoolBillingHistoryUseCase: asClass(GetSchoolBillingHistoryUseCase).scoped(),

        subscriptionController:       asClass(SubscriptionController).scoped(),
    });
};