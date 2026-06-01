import { Schema, model, Document, Types } from "mongoose";
import {
	ISchool,
	SubscriptionPlan,
	SchoolType,
	VerificationStatus,
	VerificationDocumentType,
	BillingStatus
} from "../../../shared/types/School";

export interface ISchoolDocument extends ISchool, Document {}

const schoolSchema = new Schema<ISchoolDocument>(
	{
		/* =======================
		   Core Identity
		======================= */
		name: {
			type: String,
			required: true,
			trim: true
		},

		slug: {
			type: String,
			trim: true,
			lowercase: true,
			
		},

		domain: {
			type: String,
			trim: true,
			lowercase: true,
			
		},

		schoolType: {
			type: String,
			enum: Object.values(SchoolType),
			required: true
		},

		createdBy: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true
		},

		ownerId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: false 
		},


		/* =======================
		   Contact / Branding
		======================= */
		address: {
			type: String,
			trim: true
		},

		contactEmail: {
			type: String,
			trim: true,
			lowercase: true
		},

		logoUrl: {
			type: String,
			trim: true
		},

		timezone: {
			type: String,
			default: "UTC"
		},

		/* =======================
		   Tenant Capabilities
		======================= */
		features: {
			type: Map,
			of: Boolean,
			default: {}
		},

		/* =======================
		   Subscription & Billing
		======================= */
		subscriptionPlan: {
			type: String,
			enum: Object.values(SubscriptionPlan),
			default: SubscriptionPlan.FREE
		},

		billing: {
			status: {
				type: String,
				enum: Object.values(BillingStatus),
				default: BillingStatus.TRIAL
			},
			provider: String,
			providerCustomerId: String,
			lastPaymentAt: Date
		},

		/* =======================
		   Verification
		======================= */
		verificationStatus: {
			type: String,
			enum: Object.values(VerificationStatus),
			default: VerificationStatus.PENDING
		},

		verificationDocuments: [
			{
				documentType: {
					type: String,
					enum: Object.values(VerificationDocumentType),
					required: true
				},

				fileUrl: {
					type: String,
					required: true
				},

				status: {
					type: String,
					enum: Object.values(VerificationStatus),
					default: VerificationStatus.PENDING
				},

				verifiedAt: Date,

				verifiedBy: {
					type: Types.ObjectId,
					ref: "Admin"
				},

				rejectionReason: String
			}
		],

		/* =======================
		   Lifecycle Flags
		======================= */
		isProfileComplete: {
			type: Boolean,
			default: false
		},

		isActive: {
			type: Boolean,
			default: false
		}
	},
	{
		timestamps: true
	}
);

/* =======================
   Indexes
======================= */
schoolSchema.index({ slug: 1 }, { unique: true, sparse: true });
schoolSchema.index({ domain: 1 }, { unique: true, sparse: true });
schoolSchema.index({ isActive: 1 });
schoolSchema.index({ verificationStatus: 1 });
schoolSchema.index({ subscriptionPlan: 1 });

export default model<ISchoolDocument>("School", schoolSchema);
