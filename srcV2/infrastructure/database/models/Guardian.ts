import { IGuardian } from "../../../shared/types/Guardian";
import { Schema, model, Document, Types } from "mongoose";
import { RelationshipType } from "../../../shared/types/Guardian";

export interface IGuardianDocument extends IGuardian, Document {}

const guardianSchema = new Schema<IGuardianDocument>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			unique: true,
			index: true
		},

		school: {
			type: Schema.Types.ObjectId,
			ref: "School",
			required: true,
			index: true
		},

		relations: [
			{
				student: {
					type: Schema.Types.ObjectId,
					ref: "Student",
					required: true
				},
				type: {
					type: String,
					enum: Object.values(RelationshipType),
					required: true
				}
			}
		],

		isActive: {
			type: Boolean,
			default: true
		}
	},
	{ timestamps: true }
);

export default model<IGuardianDocument>("Guardian", guardianSchema);
