import { IUserDocument } from "../models/user.model"
import { User } from "../../../domain/entities/user.entity"

export class UserMapper {

	static toDomain(doc: IUserDocument): User {

		return User.rehydrate({
			id: doc._id.toString(),
			email: doc.email,
			passwordHash: doc.passwordHash,
			firstName: doc.firstName,
			lastName: doc.lastName,
			platformRole: doc.platformRole,
			phone: doc.phone ?? null,
			profilePicture: doc.profilePicture ?? null,
			timezone: doc.timezone ?? "UTC",
			isActive: doc.isActive,
			emailVerified: doc.emailVerified,
			createdAt: doc.createdAt,
			updatedAt: doc.updatedAt
		})
	}
}