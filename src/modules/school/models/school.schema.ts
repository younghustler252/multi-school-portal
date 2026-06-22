import mongoose, { Schema, Document } from "mongoose";

import {
    SchoolStatus,
    VerificationStatus,
    SchoolType,
    OwnershipType,
    SubscriptionStatus,
} from "../domain/school.enum";

import { SchoolDocument } from "./school.document";

export const SchoolSchema = new Schema<SchoolDocument>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        slug: {
            type: String,
            required: true,
            unique: true,
        },

        subdomain: {
            type: String,
            required: true,
            unique: true,
        },

        schoolCode: {
            type: String,
            required: true,
            unique: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
        },

        phone: String,

        address: String,
        city: String,
        state: String,
        country: String,
        timezone: String,

        logo: String,
        website: String,

        schoolType: {
            type: String,
            enum: Object.values(SchoolType),
            required: true,
        },

        ownershipType: {
            type: String,
            enum: Object.values(OwnershipType),
            required: true,
        },

        status: {
            type: String,
            enum: Object.values(SchoolStatus),
            default: SchoolStatus.PENDING,
        },

        verificationStatus: {
            type: String,
            enum: Object.values(VerificationStatus),
            default: VerificationStatus.PENDING,
        },

        subscriptionStatus: {
            type: String,
            enum: Object.values(SubscriptionStatus),
            default: SubscriptionStatus.TRIAL,
        },

        currentPlanId: String,

        studentLimit: Number,

        currentAcademicSession: String,
        currentTerm: String,

        trialEndsAt: Date,
        verifiedAt: Date,

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        deletedAt: Date,
    },
    {
        timestamps: true,
    }
);

SchoolSchema.index({ slug: 1 });
SchoolSchema.index({ subdomain: 1 });
SchoolSchema.index({ schoolCode: 1 });
SchoolSchema.index({ email: 1 });
SchoolSchema.index({ status: 1 });