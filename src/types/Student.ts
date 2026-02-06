import { Types } from "mongoose";

export interface IStudent {
	school: Types.ObjectId;
	admissionNumber: string;
	firstName: string;
	lastName: string;
	middleName?: string;
	dateOfBirth?: Date;
	gender?: "male" | "female" | "other";
	classLevel?: Types.ObjectId;
	guardians: Types.ObjectId[];
	isActive: boolean;
	enrolledAt: Date;
}