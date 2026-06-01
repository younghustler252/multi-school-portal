// infrastructure/database/models/User.ts

import { Schema, model, HydratedDocument } from "mongoose"
import { PlatformRole } from "../../../domain/enums/platform-roles.enum"

export interface IUser {
	email: string
	passwordHash: string
	firstName: string
	lastName: string
	platformRole: PlatformRole
	phone?: string
	profilePicture?: string
	timezone?: string
	isActive: boolean
	emailVerified: boolean
	verificationToken?: string
	passwordResetToken?: string
	passwordResetExpires?: Date
	lastLogin?: Date
	createdAt: Date
	updatedAt: Date
}

export type IUserDocument = HydratedDocument<IUser>

const userSchema = new Schema<IUser>(
	{
		email: {
			type: String,
			required: true,
			lowercase: true,
			trim: true,
			unique: true
		},

		passwordHash: {
			type: String,
			required: true,
			select: false
		},

		firstName: {
			type: String,
			required: true,
			trim: true
		},

		lastName: {
			type: String,
			required: true,
			trim: true
		},

		platformRole: {
			type: String,
			enum: Object.values(PlatformRole),
			required: true
		},

		phone: String,
		profilePicture: String,

		timezone: {
			type: String,
			default: "UTC"
		},

		isActive: {
			type: Boolean,
			default: true
		},

		emailVerified: {
			type: Boolean,
			default: false
		},

		verificationToken: {
			type: String,
			select: false
		},

		passwordResetToken: {
			type: String,
			select: false
		},

		passwordResetExpires: {
			type: Date,
			select: false
		},

		lastLogin: Date
	},
	{
		timestamps: true
	}
)

export const UserModel = model<IUser>("User", userSchema)