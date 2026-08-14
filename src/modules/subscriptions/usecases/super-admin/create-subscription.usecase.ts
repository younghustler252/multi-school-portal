import { ISubscriptionRepository }  from "../../repositories/subscription.repository";
import { IPlanRepository }          from "../../../plans/repositories/plan.repository";
import { SubscriptionMapper }       from "../../mappers/subscription.mapper";
import { SubscriptionResponseData } from "../../mappers/subscription.mapper";
import {
    NotFoundError,
    ConflictError,
}                                   from "../../../../shared/errors/domain.errors";
import {
    SubscriptionErrorMessage,
}                                   from "../../domain/subscription.enums";
import { CreateSubscriptionDtoType } from "../../dtos/subscription.dto";

/*
|--------------------------------------------------------------------------
| CREATE SUBSCRIPTION USE CASE
| Called automatically on school registrationupgrade
| Assigns Free plan by default
|--------------------------------------------------------------------------
*/

interface Dependencies {
    subscriptionRepository: ISubscriptionRepository;
    planRepository:         IPlanRepository;
    subscriptionMapper:     SubscriptionMapper;
}

export class CreateSubscriptionUseCase {
    private readonly subscriptionRepository: ISubscriptionRepository;
    private readonly planRepository:         IPlanRepository;
    private readonly subscriptionMapper:     SubscriptionMapper;

    constructor({
        subscriptionRepository,
        planRepository,
        subscriptionMapper,
    }: Dependencies) {
        this.subscriptionRepository = subscriptionRepository;
        this.planRepository         = planRepository;
        this.subscriptionMapper     = subscriptionMapper;
    }

    async execute(
        dto: CreateSubscriptionDtoType,
    ): Promise<SubscriptionResponseData> {

        // ── Check no active subscription exists ───────────────────────────
        const existing = await this.subscriptionRepository
            .findActiveBySchoolId(dto.schoolId);

        if (existing) {
            throw new ConflictError(
                SubscriptionErrorMessage.ALREADY_ACTIVE,
            );
        }

        // ── Find plan ─────────────────────────────────────────────────────
        const plan = await this.planRepository.findById(dto.planId);
        if (!plan) {
            throw new NotFoundError(SubscriptionErrorMessage.PLAN_NOT_FOUND);
        }

        // ── Calculate period ──────────────────────────────────────────────
        const now              = new Date();
        const currentPeriodStart = now;
        const currentPeriodEnd   = this.calculatePeriodEnd(
            now,
            dto.billingCycle ?? "monthly",
        );

        // ── Create subscription ───────────────────────────────────────────
        const subscription = await this.subscriptionRepository.create({
            schoolId:           dto.schoolId,
            planId:             dto.planId,
            status:             plan.monthlyPriceKobo === 0
                                    ? "active"   // Free plan — active immediately
                                    : "trialing", // Paid plan — trial first
            billingCycle:       dto.billingCycle ?? "monthly",
            currentPeriodStart,
            currentPeriodEnd,
            nextBillingDate:    plan.monthlyPriceKobo === 0
                                    ? null
                                    : currentPeriodEnd,
        });

        return this.subscriptionMapper.toResponse(subscription);
    }

    private calculatePeriodEnd(
        start:        Date,
        billingCycle: string,
    ): Date {
        const end = new Date(start);
        if (billingCycle === "yearly") {
            end.setFullYear(end.getFullYear() + 1);
        } else {
            end.setMonth(end.getMonth() + 1);
        }
        return end;
    }
}