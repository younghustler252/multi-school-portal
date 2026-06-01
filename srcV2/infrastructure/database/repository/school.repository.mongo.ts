// // src/infrastructure/database/repositories/school.repository.mongo.ts

// import { ISchoolRepository } from "../../../domain/repositories/school.repository";
// import SchoolModel, { ISchoolDocument } from "../models/school.model";
// import { SchoolId } from "../../../domain/entities/school.entity";

// export class SchoolRepository implements ISchoolRepository {
// 	/**
// 	 * Create a new school
// 	 */
// 	async create(data: {
// 		name: string;
// 		slug?: string;
// 		domain?: string;
// 		schoolType?: string;
// 		createdById: string;
// 		ownerId?: string;
// 		address?: string;
// 		contactEmail?: string;
// 		logoUrl?: string;
// 		timezone?: string;
// 		features?: Record<string, boolean>;
// 		subscriptionPlan?: string;
// 	}): Promise<SchoolId> {
// 		const school = await SchoolModel.create({
// 			name: data.name,
// 			slug: data.slug,
// 			domain: data.domain,
// 			schoolType: data.schoolType,
// 			createdBy: data.createdById,
// 			ownerId: data.ownerId,
// 			address: data.address,
// 			contactEmail: data.contactEmail,
// 			logoUrl: data.logoUrl,
// 			timezone: data.timezone ?? "UTC",
// 			features: data.features ?? {},
// 			subscriptionPlan: data.subscriptionPlan ?? "FREE",
// 		});
// 		return school.id;
// 	}

// 	/**
// 	 * Find school by ID
// 	 */
// 	async findById(id: string): Promise<ISchoolDocument | null> {
// 		return SchoolModel.findById(id).exec();
// 	}

// 	/**
// 	 * Find school by domain
// 	 */
// 	async findByDomain(domain: string): Promise<ISchoolDocument | null> {
// 		return SchoolModel.findOne({ domain }).exec();
// 	}

// 	/**
// 	 * Find school by slug
// 	 */
// 	async findBySlug(slug: string): Promise<ISchoolDocument | null> {
// 		return SchoolModel.findOne({ slug }).exec();
// 	}

// 	/**
// 	 * Update school fields
// 	 */
// 	async update(id: string, data: Partial<ISchoolDocument>): Promise<void> {
// 		await SchoolModel.findByIdAndUpdate(id, data).exec();
// 	}

// 	/**
// 	 * Activate the school
// 	 */
// 	async activate(id: string): Promise<void> {
// 		await SchoolModel.findByIdAndUpdate(id, { isActive: true }).exec();
// 	}

// 	/**
// 	 * Deactivate the school
// 	 */
// 	async deactivate(id: string): Promise<void> {
// 		await SchoolModel.findByIdAndUpdate(id, { isActive: false }).exec();
// 	}
// }