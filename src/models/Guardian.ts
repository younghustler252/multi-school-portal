import { IGuardian } from "../types/Guardian";
import { Schema, model, Document, Types } from "mongoose";
import { RelationshipType } from "../types/Guardian";

export interface IGuardianDocument extends IGuardian, Document {}

const guardianSchema = new Schema<IGuardianDocument>(
	{
		school: {
			type: Schema.Types.ObjectId,
			ref: "School",
			required: true,
			index: true
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

		phone: {
			type: String,
			trim: true
		},

		email: {
			type: String,
			trim: true,
			lowercase: true
		},

		relationship: {
			type: String,
			enum: Object.values(RelationshipType)as string[],
			required: true
		},

		students: [
			{
				type: Schema.Types.ObjectId,
				ref: "Student"
			}
		],

		isActive: {
			type: Boolean,
			default: true
		}
	},
	{
		timestamps: true
	}
);

export default model<IGuardianDocument>("Guardian", guardianSchema);
