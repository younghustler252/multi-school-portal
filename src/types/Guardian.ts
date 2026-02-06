import { Types } from "mongoose";

export enum RelationshipType {
	FATHER = "father",
	MOTHER = "mother",
	LEGAL_GUARDIAN = "legal_guardian",
	FOSTER = "foster",
	OTHER = "other"
}

export interface IGuardian {
	school: Types.ObjectId;
	firstName: string;
	lastName: string;
	phone?: string;
	email?: string;
	relationship: RelationshipType;
	students: Types.ObjectId[];
	isActive: boolean;
}
