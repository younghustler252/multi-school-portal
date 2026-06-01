// infrastructure/database/models/Membership.ts

import { Schema, model, Document, Types } from "mongoose";
import { SchoolRole } from "../../../domain/entities/membership.entity";

export interface IMembershipDocument extends Document {
	user: Types.ObjectId;
	school: Types.ObjectId;
	role: SchoolRole;
	isActive: boolean;
	invitedBy?: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

const membershipSchema = new Schema<IMembershipDocument>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},

		school: {
			type: Schema.Types.ObjectId,
			ref: "School",
			required: true,
			index: true,
		},

		role: {
			type: String,
			enum: Object.values(SchoolRole),
			required: true,
		},

		isActive: {
			type: Boolean,
			default: true,
		},

		// optional but professional
		invitedBy: {
			type: Schema.Types.ObjectId,
			ref: "User",
		},
	},
	{
		timestamps: true,
	}
);


membershipSchema.index(
	{ user: 1, school: 1 },
	{ unique: true }
);

export default model<IMembershipDocument>(
	"Membership",
	membershipSchema
);