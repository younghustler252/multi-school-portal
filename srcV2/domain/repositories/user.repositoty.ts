// src/domain/repositories/user.repository.ts

import { User } from "../entities/user.entity"
import { UserId } from "../entities/user.entity"

export interface IUserRepository {

	// Save updates to existing user
	save(user: User): Promise<void>

	// Find by email
	findByEmail(email: string): Promise<User | null>

	// Find by ID
	findById(id: UserId): Promise<User | null>

	findByVerificationToken(token: string): Promise<User | null>
}