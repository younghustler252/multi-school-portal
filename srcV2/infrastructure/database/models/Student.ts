import { IStudent } from "../../../shared/types/Student";
import { Schema, model, Document, Types } from "mongoose";

export interface IStudentDocument extends IStudent, Document {}

const studentSchema = new Schema<IStudentDocument>(
	{
		/* =======================
		   Tenant
		======================= */
		school: {
			type: Schema.Types.ObjectId,
			ref: "School",
			required: true,
			index: true
		},

		/* =======================
		   Identity
		======================= */
		admissionNumber: {
			type: String,
			required: true,
			trim: true
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

		middleName: {
			type: String,
			trim: true
		},

		dateOfBirth: {
			type: Date
		},

		gender: {
			type: String,
			enum: ["male", "female", "other"]
		},

		/* =======================
		   Academic Placement
		======================= */
		classLevel: {
			type: Schema.Types.ObjectId,
			ref: "Class"
		},

		/* =======================
		   Guardianship
		======================= */
		guardians: [
			{
				type: Schema.Types.ObjectId,
				ref: "Guardian"
			}
		],

		/* =======================
		   Lifecycle
		======================= */
		isActive: {
			type: Boolean,
			default: true
		},

		enrolledAt: {
			type: Date,
			default: Date.now
		}
	},
	{
		timestamps: true
	}
);

/* =======================
   Indexes
======================= */
studentSchema.index(
	{ school: 1, admissionNumber: 1 },
	{ unique: true }
);

export default model<IStudentDocument>("Student", studentSchema);
