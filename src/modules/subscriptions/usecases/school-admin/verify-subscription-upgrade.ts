import { IPaymentProvider } from "../../../../infrastructure/payments/interfaces/payment.provider.interface";
import { NotificationService } from "../../../notifications/services/notification.service";
import { prisma } from "../../../../infrastructure/database/prisma/prisma.client";
import { NotFoundError } from "../../../../shared/errors/domain.errors";
import {
    SubscriptionErrorMessage,
    SubscriptionSuccessMessage,
} from "../../domain/subscription.enums";

interface Dependencies {
    paymentProvider: IPaymentProvider;
    notificationService: NotificationService;
}

export class VerifySubscriptionUpgradeUseCase {
    private readonly paymentProvider: IPaymentProvider;
    private readonly notificationService: NotificationService;

    constructor({
        paymentProvider,
        notificationService,
    }: Dependencies) {
        this.paymentProvider = paymentProvider;
        this.notificationService = notificationService;
    }

    async execute(reference: string) {
        const billing = await prisma.billingHistory.findFirst({
            where: {
                paystackReference: reference,
            },
        });

        if (!billing) {
            throw new NotFoundError(
                SubscriptionErrorMessage.BILLING_RECORD_NOT_FOUND,
            );
        }

        if (billing.status === "success") {
            return {
                success: true,
                alreadyVerified: true,
                message:
                    SubscriptionSuccessMessage.PAYMENT_ALREADY_VERIFIED,
            };
        }

        const verification =
            await this.paymentProvider.verifyTransaction(reference);

        const isSuccess = verification.status === "success";

        await prisma.billingHistory.update({
            where: {
                id: billing.id,
            },
            data: {
                status: isSuccess ? "success" : "failed",
                paidAt: isSuccess ? new Date() : null,
            },
        });

        if (!isSuccess) {
            return {
                success: false,
                alreadyVerified: false,
                message:
                    SubscriptionErrorMessage.PAYMENT_VERIFICATION_FAILED,
            };
        }

        const meta = verification.metadata as {
            subscriptionId: string;
            planId: string;
            billingCycle: "monthly" | "yearly";
            schoolId: string;
        };

        const now = new Date();
        const end = new Date(now);

        if (meta.billingCycle === "yearly") {
            end.setFullYear(end.getFullYear() + 1);
        } else {
            end.setMonth(end.getMonth() + 1);
        }

        await prisma.subscription.update({
            where: {
                id: meta.subscriptionId,
            },
            data: {
                planId: meta.planId,
                billingCycle: meta.billingCycle,
                status: "active",
                currentPeriodStart: now,
                currentPeriodEnd: end,
                nextBillingDate: end,

                ...(verification.reusable &&
                verification.authorizationCode
                    ? {
                          paystackAuthorizationCode:
                              verification.authorizationCode,
                      }
                    : {}),
            },
        });

        await this.notificationService.sendPlatformNotification({
            schoolId: meta.schoolId,
            type: "subscription_renewed",
            title: "Plan upgraded",
            message: SubscriptionSuccessMessage.UPGRADED,
            createdByAdminId: "SYSTEM_SUBSCRIPTION_UPGRADE",
        });

        return {
            success: true,
            alreadyVerified: false,
            message: SubscriptionSuccessMessage.UPGRADED,
            reference,
            subscriptionId: meta.subscriptionId,
        };
    }
}
