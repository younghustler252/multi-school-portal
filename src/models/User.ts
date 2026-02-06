// models/User.ts
import { Schema, model, Document, Types } from "mongoose";
import { IUser } from "../types/User";
import { UserRoles } from "../types/UserRole";

export interface IUserDocument extends IUser, Document {}

const userSchema = new Schema<IUserDocument>(
	{
		email: {
			type: String,
			required: true,
			lowercase: true,
			trim: true,
		},

		firstName: {
			type: String,
			required: true,
			trim: true,
		},

		lastName: {
			type: String,
			required: true,
			trim: true,
		},

		passwordHash: {
			type: String,
			required: true,
			select: false, // 🔒 hidden by default
		},

		role: {
			type: String,
			enum: UserRoles,
			required: true,
		},

		// 🔑 Tenant isolation
		school: {
			type: Schema.Types.ObjectId,
			ref: "School",
			required: true,
			index: true,
		},

		isActive: {
			type: Boolean,
			default: true,
		},

		emailVerified: {
			type: Boolean,
			default: false,
		},

		verificationToken: {
			type: String,
			select: false,
		},

		passwordResetToken: {
			type: String,
			select: false,
		},

		passwordResetExpires: {
			type: Date,
			select: false,
		},

		profilePicture: {
			type: String,
			trim: true,
		},

		phone: {
			type: String,
			trim: true,
		},

		timezone: {
			type: String,
			default: "UTC",
		},

		lastLogin: {
			type: Date,
		},
	},
	{
		timestamps: true,
		toJSON: {
            transform: (doc, ret: Record<string, any>) => {
                delete ret.passwordHash;
                delete ret.verificationToken;
                delete ret.passwordResetToken;
                delete ret.passwordResetExpires;
                return ret;
            }
        },
        toObject: {
            transform: (doc, ret: Record<string, any>) => {
                delete ret.passwordHash;
                delete ret.verificationToken;
                delete ret.passwordResetToken;
                delete ret.passwordResetExpires;
                return ret;
            }
        }

	}
);

/**
 * 🔐 UNIQUE PER SCHOOL, NOT GLOBAL
 */
userSchema.index(
	{ email: 1, school: 1 },
	{ unique: true }
);

/**
 * Common query optimizations
 */
userSchema.index({ school: 1, role: 1 });
userSchema.index({ isActive: 1 });

export default model<IUserDocument>("User", userSchema);
