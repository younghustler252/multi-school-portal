import type { PublicPlan } from "./plan.types";

/*
| Platform plan console (docs/backend/modules/plans.md, apps/api/src/modules/plans). A plan's prices and flags are edited
| with PUT /platform/plans/:id; what it includes is a separate list of grants (PUT .../entitlements).
*/

/** GET /platform/plans (no entitlements in the list) and GET /platform/plans/:id (every feature, granted or not). */
export type AdminPlan = PublicPlan & { subscribers: number };

export interface CreatePlanDto {
	name: string;
	description?: string;
	monthlyPriceKobo: number;
	yearlyPriceKobo: number;
	setupFeeKobo?: number;
	isPublic?: boolean;
	isCustom?: boolean;
}

export interface UpdatePlanDto {
	name?: string;
	description?: string | null;
	monthlyPriceKobo?: number;
	yearlyPriceKobo?: number;
	setupFeeKobo?: number;
	isPublic?: boolean;
}

/** One grant change. BOOLEAN: boolValue. LIMIT/QUOTA: limitValue (null = unlimited). ENUM: enumValue. remove=true deletes the grant. */
export interface EntitlementChange {
	featureKey: string;
	boolValue?: boolean;
	limitValue?: number | null;
	enumValue?: string;
	remove?: boolean;
}

export interface ClonePlanDto {
	name: string;
	isPublic: boolean;
}
