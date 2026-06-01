import { IUserRepository } from "../../../domain/repositories/user.repositoty"
import { IMembershipRepository } from "../../../domain/repositories/membership.repository"
import { User } from "../../../domain/entities/user.entity"
import { IPasswordHasher } from "../../interface/password-hasher.interface"


export interface LoginUserDTO {
	email: string
	password: string
	schoolId?: string // optional, provided when logging into a school subdomain
}

export class LoginUserUseCase {
	constructor(
		private readonly userRepository: IUserRepository,
		private readonly membershipRepository: IMembershipRepository,
		private readonly passwordHasher: IPasswordHasher
	) {}

	public async execute(dto: LoginUserDTO): Promise<User> {
		const email = dto.email.toLowerCase()

		// 1️⃣ Find user by email
		const user = await this.userRepository.findByEmail(email)
		if (!user) throw new Error("Invalid credentials")

		// 2️⃣ Check if email is verified
		if (!user.emailVerified) throw new Error("Email not verified")

		// 3️⃣ Verify password
		const isValid = await this.passwordHasher.compare(dto.password, user.getPasswordHash())
		if (!isValid) throw new Error("Invalid credentials")

		// 4️⃣ If logging into a school, check membership
		if (dto.schoolId) {
			const membership = await this.membershipRepository.findByUserAndSchool(user.id, dto.schoolId)
			if (!membership || !membership.isActive) {
				throw new Error("User does not have access to this school")
			}
		}

		// 5️⃣ Update last login
		// user.lastLogin = new Date()
		await this.userRepository.save(user)

		// 6️⃣ Return user entity
		return user
	}
}