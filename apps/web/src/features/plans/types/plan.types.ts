/** One line of "what this plan includes", as GET /plans returns it (apps/api/src/modules/plans/domain/plan.entity.ts). */
export interface PlanEntitlementView {
	key: string;
	name: string;
	description: string | null;
	module: string;
	kind: "BOOLEAN" | "LIMIT" | "QUOTA" | "ENUM";
	unit: string | null;
	/** Inactive features are not enforced yet. */
	isActive: boolean;
	granted: boolean;
	/** Limits: null when unlimited. */
	value: boolean | number | string | null;
	unlimited: boolean;
}

/**
 * A plan as the API returns it now (PlanMapper.toResponse): what a plan includes is the `entitlements` list; there are
 * no studentLimit / staffLimit / features fields any more.
 */
export interface PublicPlan {
	id: string;
	name: string;
	description: string | null;
	monthlyPriceKobo: number;
	yearlyPriceKobo: number;
	yearlySavingsPercent: number;
	setupFeeKobo: number;
	isPublic: boolean;
	isActive: boolean;
	isCustom: boolean;
	isFree: boolean;
	entitlements: PlanEntitlementView[];
	createdAt: string;
}
