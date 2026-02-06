import { VerificationDocumentType } from "../types/School";
import School, { ISchoolDocument } from "../models/School";
import { NotificationType } from "../types/Notification";
import { normalizeDomain, validateDomain } from "../utils/domain";
import { generateSlug } from "../utils/slug";
import { Types } from "mongoose";
import { AppError } from "../utils/AppError";

import {
	SubscriptionPlan,
	SchoolType,
	VerificationStatus,
	BillingStatus
} from "../types/School";

import { PLAN_FEATURES } from "../config/planFeatures";
import { FeatureKey } from "../types/Features";
import { NotificationService } from "./NotificationService";
import { UserRole } from "../types/UserRole";
import { renderNotification } from "../templates/notifications";
import { NotificationTemplateKey } from "../templates/notifications";

export class SchoolService {

	/* =======================
	   Creation
	======================= */
	static async createNewSchool(
		ownerId: Types.ObjectId | null,       // optional for MVP
		createdBy: Types.ObjectId | null,     // optional for MVP, audit
		name: string,
		schoolType: SchoolType,
		plan: SubscriptionPlan = SubscriptionPlan.FREE,
		domain?: string
	): Promise<ISchoolDocument> {

		const slug = generateSlug(name);
		let normalizedDomain: string | undefined;

		// Custom domain enforcement
		if (domain) {
			const canUseCustomDomain =
				PLAN_FEATURES[plan].features[FeatureKey.CUSTOM_DOMAIN];

			if (!canUseCustomDomain) {
				throw new AppError(
					"Upgrade your plan to use a custom domain",
					403
				);
			}

			normalizedDomain = normalizeDomain(domain);

			if (!validateDomain(normalizedDomain)) {
				throw new AppError("Invalid custom domain", 400);
			}
		}

		const school = new School({
			name,
			slug,
			domain: normalizedDomain,
			schoolType,
			subscriptionPlan: plan,
			ownerId: ownerId || undefined,       // optional for MVP
			createdBy: createdBy || undefined,   // optional for MVP
			billing: {
				status:
					plan === SubscriptionPlan.FREE
						? BillingStatus.ACTIVE
						: BillingStatus.TRIAL
			},
			verificationStatus: VerificationStatus.PENDING
		});

		return school.save();
	}

	/* =======================
	   Fetchers
	======================= */
	static async getAllSchools(
		filter: Partial<{
			subscriptionPlan: SubscriptionPlan;
			isActive: boolean;
			verificationStatus: VerificationStatus;
		}> = {},
		page = 1,
		limit = 20
	) {
		const skip = (page - 1) * limit;

		const [schools, total] = await Promise.all([
			School.find(filter)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean(),
			School.countDocuments(filter)
		]);

		return {
			data: schools,
			meta: {
				total,
				page,
				limit,
				pages: Math.ceil(total / limit)
			}
		};
	}

	static async getSchoolBySlug(slug: string) {
		return School.findOne({ slug });
	}

	static async getSchoolByDomain(domain: string) {
		return School.findOne({ domain });
	}

	static async getSchoolByTenantId(
		tenantId: string | Types.ObjectId,
		selectFields?: string
	): Promise<ISchoolDocument> {

		const query = School.findById(tenantId);
		if (selectFields) query.select(selectFields);

		const school = await query;
		if (!school) throw new AppError("School not found", 404);

		return school;
	}

	static async getSchoolById( 
		schoolId: string | Types.ObjectId, 
		selectFields?: string ): Promise<ISchoolDocument> { 
			const query = School.findById(schoolId); 
			if (selectFields) query.select(selectFields); 

			const school = await query; 
			if (!school) { throw new AppError("School not found", 404); } 
			
			return school; 
		}

	/* =======================
	   Verification
	======================= */
	static canActivateSchool(school: ISchoolDocument): boolean {
		const requiredDocuments: VerificationDocumentType[] = [
			VerificationDocumentType.CAC,
			VerificationDocumentType.MINISTRY_APPROVAL
		];

		const hasAllRequiredDocs = requiredDocuments.every(docType =>
			school.verificationDocuments.some(doc =>
				doc.documentType === docType &&
				doc.status === VerificationStatus.APPROVED
			)
		);

		return school.isProfileComplete && hasAllRequiredDocs;
	}

	static async tryActivateSchool(school: ISchoolDocument): Promise<boolean> {
		if (school.isActive) return false;
		if (!this.canActivateSchool(school)) return false;

		school.isActive = true;
		school.verificationStatus = VerificationStatus.APPROVED;
		await school.save();

		try {
			if (school.createdBy) {

				const message = renderNotification(NotificationTemplateKey.SCHOOL_ACTIVATED, {
					schoolName: school.name
				});

				await NotificationService.sendToUser(
					school._id,
					school.createdBy,
					"School Activated",
					message,
					NotificationType.INFO,
					UserRole.ADMIN
				);
			}
		} catch (err) {
			console.error("Activation notification failed:", err);
		}

		return true;
	}

	/* =======================
	   Billing
	======================= */
	// static async activateSubscription(
	// 	schoolId: string | Types.ObjectId
	// ): Promise<ISchoolDocument> {

	// 	const school = await School.findById(schoolId);
	// 	if (!school) throw new AppError("School not found", 404);

	// 	school.billing.status = BillingStatus.ACTIVE;
	// 	school.billing.lastPaymentAt = new Date();

	// 	await school.save();
	// 	return school;
	// }

	/* =======================
	   Feature helpers
	======================= */
	static getFeaturesForPlan(plan: SubscriptionPlan) {
		return PLAN_FEATURES[plan];
	}


	static async getSchoolAnalytics() {

		const stats = await School.aggregate([
			{
				$group: {
					_id: null,
					totalSchools: { $sum: 1},
					activeSchools: { $sum: { $cond: ["$isActive", 1, 0] } },
					inActiveSchools: { $sum: { $cond: ["$isActive", 0, 1 ] } },
					freePlanSchools: {
						$sum: { $cond: [{ $eq: ["$subscriptionPlan", SubscriptionPlan.FREE] }, 1, 0] }
					},
					premiumPlanSchools: {
						$sum: { $cond: [{ $eq: ["$subscriptionPlan", SubscriptionPlan.PREMIUM] }, 1, 0] }
					},
					enterprisePlanSchools: {
						$sum: { $cond: [{ $eq: ["$subscriptionPlan", SubscriptionPlan.ENTERPRISE] }, 1, 0] }
					},

					pendingVerificationSchools: {
						$sum: { $cond: [{ $eq: ["$verificationStatus", VerificationStatus.PENDING] }, 1, 0] }
					}


				}
			}
		])

			if (!stats || stats.length === 0) {
			return {
				totalSchools: 0,
				activeSchools: 0,
				inactiveSchools: 0,
				freePlanSchools: 0,
				paidPlanSchools: 0,
				enterprisePlanSchools: 0,
				pendingVerificationSchools: 0
			};
		}

		return stats[0];
	}
}
