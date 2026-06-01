import { IUserRepository } from "../../../domain/repositories/user.repositoty"
import { IMembershipRepository } from "../../../domain/repositories/membership.repository"
import { User } from "../../../domain/entities/user.entity"
import { Membership } from "../../../domain/entities/membership.entity"

export interface VerifyUserDTO {
	verificationToken: string
}

export class VerifyUserUseCase {
	constructor(
		private readonly userRepository: IUserRepository,
		private readonly membershipRepository: IMembershipRepository
	) {}

	public async execute(dto: VerifyUserDTO): Promise<User> {
		// 1️⃣ Find user by verification token
		const user = await this.userRepository.findByVerificationToken(dto.verificationToken)
		if (!user) throw new Error("Invalid or expired verification token")

		// 2️⃣ If already verified, just return
		if (!user.emailVerified) {
			user.verifyEmail()
			await this.userRepository.save(user)
		}

		// 3️⃣ Activate any pending memberships
		const memberships = await this.membershipRepository.findAllByUser(user.id)
		for (const m of memberships) {
			if (!m.isActive) {
				m.activate()
				await this.membershipRepository.save(m)
			}
		}

		return user
	}
}