import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { SubscriptionMapper } from "./mappers/subscription.mapper";
import { SubscriptionRepositoryImpl } from "./repositories/subscription.repository.impl";
import { InvoiceRepository } from "./repositories/invoice.repository";

import { InvoiceNumberService } from "./services/invoice-number.service";
import { CouponService } from "./services/coupon.service";
import { UsageService } from "./services/usage.service";
import { ProrationService } from "./services/proration.service";
import { InvoiceService } from "./services/invoice.service";
import { PlanChangeService } from "./services/plan-change.service";
import { BillingNotifier } from "./services/billing-notifier.service";
import { BillingEngine } from "./services/billing-engine.service";
import { BillingLifecycleService } from "./services/billing-lifecycle.service";

import { GetBillingSummaryUseCase, ListMyInvoicesUseCase, GetMyInvoiceUseCase } from "./usecases/billing-summary.usecases";
import { PreviewPlanChangeUseCase, ChangePlanUseCase, RequestDowngradeUseCase } from "./usecases/plan-change.usecases";
import { VerifyBillingPaymentUseCase, PayInvoiceUseCase, ToggleAutoRenewUseCase, ManagePaymentMethodsUseCase, CancelSubscriptionUseCase } from "./usecases/payments.usecases";
import {
    ListSubscriptionsUseCase, GetSchoolSubscriptionUseCase, PlatformChangePlanUseCase, ExtendPeriodUseCase, PlatformInvoicesUseCase, GetBillingStatsUseCase,
} from "./usecases/platform/platform-billing.usecases";

import { BillingController } from "./controllers/billing.controller";
import { BillingPlatformController } from "./controllers/billing-platform.controller";

/*
| Requires: registerShared (prismaClient, paymentProvider, encryptionService), registerFoundation (entitlementsService),
| registerPlans, registerAuth (userRepository, urlService), audit and notifications.
*/
export const registerSubscriptions = (container: AwilixContainer): void => {
    container.register({
        subscriptionMapper:     asClass(SubscriptionMapper).singleton(),
        subscriptionRepository: asClass(SubscriptionRepositoryImpl).scoped(),
        invoiceRepository:      asClass(InvoiceRepository).scoped(),

        invoiceNumberService:   asClass(InvoiceNumberService).scoped(),
        couponService:          asClass(CouponService).scoped(),
        usageService:           asClass(UsageService).scoped(),
        prorationService:       asClass(ProrationService).scoped(),
        invoiceService:         asClass(InvoiceService).scoped(),
        planChangeService:      asClass(PlanChangeService).scoped(),
        billingNotifier:        asClass(BillingNotifier).scoped(),
        billingEngine:          asClass(BillingEngine).scoped(),
        billingLifecycleService: asClass(BillingLifecycleService).scoped(),

        getBillingSummaryUseCase: asClass(GetBillingSummaryUseCase).scoped(),
        listMyInvoicesUseCase:    asClass(ListMyInvoicesUseCase).scoped(),
        getMyInvoiceUseCase:      asClass(GetMyInvoiceUseCase).scoped(),
        previewPlanChangeUseCase: asClass(PreviewPlanChangeUseCase).scoped(),
        changePlanUseCase:        asClass(ChangePlanUseCase).scoped(),
        requestDowngradeUseCase:  asClass(RequestDowngradeUseCase).scoped(),
        verifyBillingPaymentUseCase: asClass(VerifyBillingPaymentUseCase).scoped(),
        payInvoiceUseCase:        asClass(PayInvoiceUseCase).scoped(),
        toggleAutoRenewUseCase:   asClass(ToggleAutoRenewUseCase).scoped(),
        managePaymentMethodsUseCase: asClass(ManagePaymentMethodsUseCase).scoped(),
        cancelSubscriptionUseCase: asClass(CancelSubscriptionUseCase).scoped(),

        listSubscriptionsUseCase:      asClass(ListSubscriptionsUseCase).scoped(),
        getSchoolSubscriptionUseCase:  asClass(GetSchoolSubscriptionUseCase).scoped(),
        platformChangePlanUseCase:     asClass(PlatformChangePlanUseCase).scoped(),
        extendPeriodUseCase:           asClass(ExtendPeriodUseCase).scoped(),
        platformInvoicesUseCase:       asClass(PlatformInvoicesUseCase).scoped(),
        getBillingStatsUseCase:        asClass(GetBillingStatsUseCase).scoped(),

        billingController:         asClass(BillingController).scoped(),
        billingPlatformController: asClass(BillingPlatformController).scoped(),
    });
};
