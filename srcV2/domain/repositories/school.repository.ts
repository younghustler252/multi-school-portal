import { School, SchoolId } from "../entities/school.entity";
import { SchoolType, SubscriptionPlan, VerificationStatus } from "../entities/school.entity";

export interface ISchoolRepository {
	/**
	 * Create a new school with minimal required fields.
	 * Optional fields can be added later using `update()`.
	 */
	create(data: {
		name: string;
		createdById: string;
		slug?: string;
		domain?: string;
		schoolType?: SchoolType;
		ownerId?: string;
		address?: string;
		contactEmail?: string;
		logoUrl?: string;
		timezone?: string;
		features?: Record<string, boolean>;
		subscriptionPlan?: SubscriptionPlan;
	}): Promise<SchoolId>;

	/**
	 * Find a school by its unique ID.
	 */
	findById(id: string): Promise<School | null>;

	/**
	 * Find a school by its domain name.
	 */
	findByDomain(domain: string): Promise<School | null>;

	/**
	 * Find a school by its slug.
	 */
	findBySlug(slug: string): Promise<School | null>;

	/**
	 * Update school fields. Only provided fields will be updated.
	 */
	update(id: string, data: Partial<School>): Promise<void>;

	/**
	 * Activate a school. Ensure required fields are present before activation.
	 */
	activate(id: string): Promise<void>;

	/**
	 * Deactivate a school.
	 */
	deactivate(id: string): Promise<void>;
} 