// src/domain/entities/Membership.ts

export type MembershipId = string;
import { UserId } from "./user.entity";
import { SchoolId } from "./school.entity";

export enum SchoolRole {
	OWNER = "OWNER",      // School creator (full control + billing)
	ADMIN = "ADMIN",      // Manage users & settings
	STAFF = "STAFF",      // Non-teaching staff
	TEACHER = "TEACHER",
	STUDENT = "STUDENT",
	PARENT = "PARENT"
}

// ==============================
// 💼 Props for creation
// ==============================
interface CreateMembershipProps {
	id: string
	userId: UserId
	schoolId: SchoolId
	role: SchoolRole
	invitedBy?: UserId | null
}

// ==============================
// ♻️ Props for rehydration from DB
// ==============================
interface RehydrateMembershipProps extends CreateMembershipProps {
	isActive: boolean
	createdAt: Date
	updatedAt: Date
}

// ==============================
// 🧱 Membership Entity
// ==============================
export class Membership {
	public readonly id: string
	public readonly userId: UserId
	public readonly schoolId: SchoolId
	public role: SchoolRole
	public isActive: boolean
	public invitedBy: UserId | null
	public readonly createdAt: Date
	public updatedAt: Date

	// 🔒 Private constructor
	private constructor(props: RehydrateMembershipProps) {
		this.id = props.id
		this.userId = props.userId
		this.schoolId = props.schoolId
		this.role = props.role
		this.isActive = props.isActive
		this.invitedBy = props.invitedBy ?? null
		this.createdAt = props.createdAt
		this.updatedAt = props.updatedAt
	}

	// 🆕 Factory: create new membership
	static create(props: CreateMembershipProps): Membership {
		const now = new Date()
		return new Membership({
			...props,
			isActive: true,
			createdAt: now,
			updatedAt: now,
			invitedBy: props.invitedBy ?? null
		})
	}

	// ♻️ Rehydrate from DB
	static rehydrate(props: RehydrateMembershipProps): Membership {
		return new Membership(props)
	}

	// 🔐 Update role
	changeRole(newRole: SchoolRole) {
		if (this.role !== newRole) {
			this.role = newRole
			this.touch()
		}
	}

	// 👤 Activate / Deactivate membership
	activate() {
		if (!this.isActive) {
			this.isActive = true
			this.touch()
		}
	}

	deactivate() {
		if (this.isActive) {
			this.isActive = false
			this.touch()
		}
	}

	// 🕒 Internal timestamp update
	private touch() {
		this.updatedAt = new Date()
	}
}