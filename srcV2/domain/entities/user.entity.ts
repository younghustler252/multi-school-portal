import { PlatformRole } from "../enums/platform-roles.enum"

export type UserId = string

// ==============================
// 🧱 Props For Creation
// ==============================

interface CreateUserProps {
	id: UserId
	email: string
	passwordHash: string
	firstName: string
	lastName: string
	platformRole: PlatformRole
	phone?: string | null
	profilePicture?: string | null
	timezone?: string
}

// ==============================
// ♻️ Props For Rehydration (from DB)
// ==============================

interface RehydrateUserProps extends CreateUserProps {
	isActive: boolean
	emailVerified: boolean
	createdAt: Date
	updatedAt: Date
}

export class User {

	// ==============================
	// 🔒 Private Constructor
	// ==============================

	private constructor(
		public readonly id: UserId,
		public email: string,
		private passwordHash: string,
		public firstName: string,
		public lastName: string,
		public platformRole: PlatformRole,
		public phone: string | null,
		public profilePicture: string | null,
		public timezone: string,
		public isActive: boolean,
		public emailVerified: boolean,
		public readonly createdAt: Date,
		public updatedAt: Date
	) {}

	// ==============================
	// 🆕 Factory: Create New User
	// ==============================

	static create(props: CreateUserProps): User {
		return new User(
			props.id,
			props.email.toLowerCase(),
			props.passwordHash,
			props.firstName,
			props.lastName,
			props.platformRole ?? PlatformRole.USER,
			props.phone ?? null,
			props.profilePicture ?? null,
			props.timezone ?? "UTC",
			true,               // isActive default
			false,              // emailVerified default
			new Date(),
			new Date()
		)
	}

	// ==============================
	// ♻️ Factory: Rehydrate From DB
	// ==============================

	static rehydrate(props: RehydrateUserProps): User {
		return new User(
			props.id,
			props.email,
			props.passwordHash,
			props.firstName,
			props.lastName,
			props.platformRole,
			props.phone ?? null,
			props.profilePicture ?? null,
			props.timezone ?? "UTC",
			props.isActive,
			props.emailVerified,
			props.createdAt,
			props.updatedAt
		)
	}

	// ==============================
	// 🔐 Authentication Behavior
	// ==============================

	getPasswordHash(): string {
		return this.passwordHash
	}

	changePassword(newHash: string) {
		this.passwordHash = newHash
		this.touch()
	}

	verifyEmail() {
		if (!this.emailVerified) {
			this.emailVerified = true
			this.touch()
		}
	}

	// ==============================
	// 👤 Account State
	// ==============================

	deactivate() {
		if (this.isActive) {
			this.isActive = false
			this.touch()
		}
	}

	activate() {
		if (!this.isActive) {
			this.isActive = true
			this.touch()
		}
	}

	// ==============================
	// 📝 Profile Updates
	// ==============================

	updateProfile(data: {
		firstName?: string
		lastName?: string
		phone?: string | null
		profilePicture?: string | null
		timezone?: string
	}) {
		if (data.firstName !== undefined) this.firstName = data.firstName
		if (data.lastName !== undefined) this.lastName = data.lastName
		if (data.phone !== undefined) this.phone = data.phone
		if (data.profilePicture !== undefined) this.profilePicture = data.profilePicture
		if (data.timezone !== undefined) this.timezone = data.timezone

		this.touch()
	}

	// ==============================
	// 🔑 Role Control
	// ==============================

	changePlatformRole(newRole: PlatformRole) {
		if (this.platformRole !== newRole) {
			this.platformRole = newRole
			this.touch()
		}
	}

	// ==============================
	// 🕒 Internal Timestamp Update
	// ==============================

	private touch() {
		this.updatedAt = new Date()
	}
}