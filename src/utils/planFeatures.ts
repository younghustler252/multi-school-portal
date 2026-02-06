// src/utils/planFeatures.ts

import { PLAN_FEATURES } from "../config/planFeatures";
import { SubscriptionPlan } from "../types/School";

export function buildFeatureMap(plan: SubscriptionPlan): Map<string, boolean> {
	return new Map(
		Object.entries(PLAN_FEATURES[plan].features)
	);
}
