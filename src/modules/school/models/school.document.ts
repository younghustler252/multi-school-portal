
import mongoose from "mongoose";
import { Types } from "mongoose";
import {
    SchoolStatus,
    VerificationStatus,
    SchoolType,
    OwnershipType,
    SubscriptionStatus,
} from "../domain/school.enum";


export interface SchoolDocument extends Document {
    _id: Types.ObjectId;
    name: string;
    slug: string;
    subdomain: string;
    schoolCode: string;

    email: string;
    phone?: string;

    address?: string;
    city?: string;
    state?: string;
    country?: string;
    timezone?: string;

    logo?: string;
    website?: string;

    schoolType: SchoolType;
    ownershipType: OwnershipType;

    status: SchoolStatus;
    verificationStatus: VerificationStatus;
    subscriptionStatus: SubscriptionStatus;

    currentPlanId?: string;

    studentLimit?: number;

    currentAcademicSession?: string;
    currentTerm?: string;

    trialEndsAt?: Date;
    verifiedAt?: Date;

    createdBy: mongoose.Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}
