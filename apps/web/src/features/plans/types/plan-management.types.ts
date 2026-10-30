import { PlanFeatures } from "@/features/plans/types/plan.types";

export interface CreatePlanDto {
	name: string;
	description?: string;
	studentLimit: number; // -1 = unlimited
	staffLimit: number;
	features?: Partial<PlanFeatures>;
	monthlyPriceKobo: number;
	yearlyPriceKobo: number;
	setupFeeKobo?: number;
	isPublic?: boolean;
	isCustom?: boolean;
}

export type UpdatePlanDto = Partial<CreatePlanDto> & { isActive?: boolean };