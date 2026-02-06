import { SubscriptionPlan } from "../types/School";
import { FeatureKey } from "../types/Features";

/**
 * Explicit plan config shape
 * - Easy to reuse
 * - Easy to reason about
 */
export interface PlanConfig {
	features: Record<FeatureKey, boolean>;
	limits: {
		students: number;
		staff: number;
	};
}

/**
 * Base feature set for paid plans
 * Keeps PREMIUM / ENTERPRISE differences obvious
 */
const PAID_FEATURES: Record<FeatureKey, boolean> = {
	[FeatureKey.EXAMS]: true,
	[FeatureKey.ATTENDANCE]: true,
	[FeatureKey.CBT]: true,
	[FeatureKey.RESULTS]: true,
	[FeatureKey.CUSTOM_DOMAIN]: true,
	[FeatureKey.API_ACCESS]: false, // overridden per plan
	[FeatureKey.NOTIFY_IN_APP]: true,
	[FeatureKey.NOTIFY_EMAIL]: true,
	[FeatureKey.NOTIFY_PUSH]: true
};

export const PLAN_FEATURES: Record<SubscriptionPlan, PlanConfig> = {
	[SubscriptionPlan.FREE]: {
		features: {
			[FeatureKey.EXAMS]: false,
			[FeatureKey.ATTENDANCE]: true,
			[FeatureKey.CBT]: false,
			[FeatureKey.RESULTS]: true,
			[FeatureKey.CUSTOM_DOMAIN]: false,
			[FeatureKey.API_ACCESS]: false,

			// Notifications
			[FeatureKey.NOTIFY_IN_APP]: true,
			[FeatureKey.NOTIFY_EMAIL]: false,
			[FeatureKey.NOTIFY_PUSH]: false
		},
		limits: {
			students: 100,
			staff: 10
		}
	},

	[SubscriptionPlan.PREMIUM]: {
		features: {
			...PAID_FEATURES,
			[FeatureKey.API_ACCESS]: false
		},
		limits: {
			students: 1000,
			staff: 50
		}
	},

	[SubscriptionPlan.ENTERPRISE]: {
		features: {
			...PAID_FEATURES,
			[FeatureKey.API_ACCESS]: true
		},
		limits: {
			students: Number.MAX_SAFE_INTEGER,
			staff: Number.MAX_SAFE_INTEGER
		}
	}
};
