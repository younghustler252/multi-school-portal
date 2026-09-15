import { ISubscriptionRepository } from "../../repositories/subscription.repository";
import { IPlanRepository } from "../../../plans/repositories/plan.repository";
import { ISchoolRepository } from "../../../school/repositories/school.repository";
import { IUserRepository } from "../../../auth/repositories/user.repository";
import { IPaymentProvider } from "../../../../infrastructure/payments/interfaces/payment.provider.interface";
import { NotFoundError } from "../../../../shared/errors/domain.errors";
import { SubscriptionErrorMessage } from "../../domain/subscription.enums";
import { UpgradePlanDtoType } from "../../dtos/subscription.dto";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../../../../infrastructure/database/prisma/prisma.client";

interface Dependencies {
	subscriptionRepository: ISubscriptionRepository;
	planRepository: IPlanRepository;
	schoolRepository: ISchoolRepository;
	userRepository: IUserRepository;
	paymentProvider: IPaymentProvider;
}

export class InitiateSubscriptionUpgradeUseCase {
	private readonly subscriptionRepository: ISubscriptionRepository;
	private readonly planRepository: IPlanRepository;
	private readonly schoolRepository: ISchoolRepository;
	private readonly userRepository: IUserRepository;
	private readonly paymentProvider: IPaymentProvider;

	constructor(deps: Dependencies) {
		this.subscriptionRepository = deps.subscriptionRepository;
		this.planRepository = deps.planRepository;
		this.schoolRepository = deps.schoolRepository;
		this.userRepository = deps.userRepository;
		this.paymentProvider = deps.paymentProvider;
	}

	async execute(
		schoolId: string,
		userId: string,
		dto: UpgradePlanDtoType,
	) {
		const subscription =
			await this.subscriptionRepository.findActiveBySchoolId(schoolId);

		if (!subscription) {
			throw new NotFoundError(
				SubscriptionErrorMessage.NOT_FOUND,
			);
		}

		const newPlan = await this.planRepository.findById(dto.planId);

		if (!newPlan) {
			throw new NotFoundError(
				SubscriptionErrorMessage.PLAN_NOT_FOUND,
			);
		}

		const school = await this.schoolRepository.findById(schoolId);
		const user = await this.userRepository.findById(userId);

		if (!school || !user) {
			throw new NotFoundError("School or user not found");
		}

		const amountKobo =
			dto.billingCycle === "yearly"
				? newPlan.yearlyPriceKobo
				: newPlan.monthlyPriceKobo;

		const reference = `SUB-${uuidv4()
			.replace(/-/g, "")
			.substring(0, 12)
			.toUpperCase()}`;

		const billing = await prisma.billingHistory.create({
			data: {
				subscriptionId: subscription.id,
				amountKobo,
				status: "pending",
				billingCycle: dto.billingCycle,
				paystackReference: reference,
			},
		});

		// Subscription payment is platform revenue,
		// so no subaccount is used here.
		const result =
			await this.paymentProvider.initializeTransaction({
				email: user.email,
				amountKobo,
				reference,
				callbackUrl: dto.callbackUrl,
				metadata: {
					type: "subscription_upgrade",
					subscriptionId: subscription.id,
					billingHistoryId: billing.id,
					schoolId,
					planId: dto.planId,
					billingCycle: dto.billingCycle,
				},
			});
        console.log(result)
		return {
			authorizationUrl: result.authorizationUrl,
			reference: result.reference,
			amountKobo,
		};
	}
}
