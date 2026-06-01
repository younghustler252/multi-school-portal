// src/application/use-cases/register-user.use-case.ts
import { IUserRepository } from "../../../domain/repositories/user.repositoty"
import { ISchoolRepository } from "../../../domain/repositories/school.repository"
import { User } from "../../../domain/entities/user.entity"
import { Membership, SchoolRole } from "../../../domain/entities/membership.entity"
import { PlatformRole } from "../../../domain/enums/platform-roles.enum"
import { IPasswordHasher } from "../../interface/password-hasher.interface"
import { IMembershipRepository } from "../../../domain/repositories/membership.repository"
import { v4 as uuidv4 } from "uuid"

export interface RegisterUserDTO {
	firstName: string
	lastName: string
	email: string
	password: string
	schoolId?: string
	invitedById?: string
}

export class RegisterUserUseCase {
	constructor(
		private readonly userRepository: IUserRepository,
		private readonly schoolRepository: ISchoolRepository,
		private readonly passwordHasher: IPasswordHasher,
		private readonly membershipRepository: IMembershipRepository
	) {}

	public async execute(dto: RegisterUserDTO): Promise<User> {
		const email = dto.email.toLowerCase()
		const existingUser = await this.userRepository.findByEmail(email)
		if (existingUser) throw new Error("Email already registered")

		let school = null
		if (dto.schoolId) {
			school = await this.schoolRepository.findById(dto.schoolId)
			if (!school) throw new Error("School not found")
			if (!school.isActive) throw new Error("Cannot register user to inactive school")
		}

		const passwordHash = await this.passwordHasher.hash(dto.password)

		const user = User.create({
			id: uuidv4(),
			email,
			passwordHash,
			firstName: dto.firstName.trim(),
			lastName: dto.lastName.trim(),
			platformRole: PlatformRole.USER,
			phone: null,
			profilePicture: null,
			timezone: "UTC"
		})

		await this.userRepository.save(user)

		if (school && dto.schoolId) {
			const membership = Membership.create({
				id: uuidv4(),
				userId: user.id,
				schoolId: dto.schoolId, // ✅ TypeScript knows this is a string
				role: SchoolRole.STUDENT,
				invitedBy: dto.invitedById ?? null
			})

			await this.membershipRepository.save(membership)
		}

		return user
	}
}