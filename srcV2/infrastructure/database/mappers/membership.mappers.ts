import { Types } from "mongoose"
import { Membership } from "../../../domain/entities/membership.entity"
import { IMembershipDocument } from "../models/membership.model"

export class MembershipMapper {
	static toDomain(doc: IMembershipDocument): Membership {
		return Membership.rehydrate({
			id: doc._id.toString(),
			userId: doc.user.toString(),
			schoolId: doc.school.toString(),
			role: doc.role,
			isActive: doc.isActive,
			invitedBy: doc.invitedBy?.toString() ?? null,
			createdAt: doc.createdAt,
			updatedAt: doc.updatedAt
		})
	}

	static toPersistence(entity: Membership) {
		return {
			_id: entity.id,
			user: new Types.ObjectId(entity.userId),
			school: new Types.ObjectId(entity.schoolId),
			role: entity.role,
			isActive: entity.isActive,
			invitedBy: entity.invitedBy ? new Types.ObjectId(entity.invitedBy) : undefined,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt
		}
	}
}