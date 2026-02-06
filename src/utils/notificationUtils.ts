import { Types } from "mongoose";
import { NotificationChannels } from "../types/Notification";
import { FeatureKey } from "../types/Features";
import { PLAN_FEATURES } from "../config/planFeatures";
import { SubscriptionPlan } from "../types/School";

export const toObjectId = (id: string | Types.ObjectId): Types.ObjectId =>
	id instanceof Types.ObjectId ? id : new Types.ObjectId(id);

export const resolveAllowedChannels = (
	plan: SubscriptionPlan,
	requested?: NotificationChannels
): NotificationChannels => {
	const planConfig = PLAN_FEATURES[plan];

	const isEnabled = (key: FeatureKey): boolean =>
		planConfig.features[key] === true;

	return {
		inApp:
			(requested?.inApp ?? true) &&
			isEnabled(FeatureKey.NOTIFY_IN_APP),

		email:
			(requested?.email ?? true) &&
			isEnabled(FeatureKey.NOTIFY_EMAIL),

		push:
			(requested?.push ?? true) &&
			isEnabled(FeatureKey.NOTIFY_PUSH)
	};
};
