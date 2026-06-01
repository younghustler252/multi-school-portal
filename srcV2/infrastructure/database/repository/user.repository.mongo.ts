// src/infrastructure/database/repositories/UserRepository.ts

import { IUserRepository } from "../../../domain/repositories/user.repositoty"
import { User } from "../../../domain/entities/user.entity"
import { UserModel } from "../models/user.model"
import { UserMapper } from "../mappers/user.mapper"

export class UserRepository implements IUserRepository {

	async save(user: User): Promise<void> {

		await UserModel.findByIdAndUpdate(
			user.id,
			{
				_id: user.id,
				email: user.email,
				passwordHash: user.getPasswordHash(),
				firstName: user.firstName,
				lastName: user.lastName,
				platformRole: user.platformRole,
				phone: user.phone,
				profilePicture: user.profilePicture,
				timezone: user.timezone,
				isActive: user.isActive,
				emailVerified: user.emailVerified,
				updatedAt: user.updatedAt
			},
			{ upsert: true }
		).exec()
	}

	async findByEmail(email: string): Promise<User | null> {
		const doc = await UserModel
			.findOne({ email: email.toLowerCase() })
			.select("+passwordHash")
			.exec()

		return doc ? UserMapper.toDomain(doc) : null
	}

	async findById(id: string): Promise<User | null> {
		const doc = await UserModel
			.findById(id)
			.select("+passwordHash")
			.exec()

		return doc ? UserMapper.toDomain(doc) : null
	}

	async findByVerificationToken(token: string): Promise<User | null> {
		const doc = await UserModel.findOne({ verificationToken: token }).select("+passwordHash").exec()
		if (!doc) return null
		return UserMapper.toDomain(doc)
	}
}