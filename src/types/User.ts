import { Types } from "mongoose";
import { UserRole } from "./UserRole";

export interface IUser {
    email: string;
    firstName: string;
    lastName: string;

    passwordHash: string;

    role: UserRole;

    school: Types.ObjectId;

    isActive: boolean;
    emailVerified: boolean;

    verificationToken?: string;
    passwordResetToken?: string;
    passwordResetExpires?: Date;

    profilePicture?: string;
    phone?: string;
    timezone?: string;

    lastLogin?: Date;
}
