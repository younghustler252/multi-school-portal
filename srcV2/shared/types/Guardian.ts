import { Types } from "mongoose";

export enum RelationshipType {
	FATHER = "father",
	MOTHER = "mother",
	LEGAL_GUARDIAN = "legal_guardian",
	FOSTER = "foster",
	OTHER = "other"
}

export interface IGuardian {
	user: Types.ObjectId;
	school: Types.ObjectId;
	relations: {
		student: Types.ObjectId;
		type: RelationshipType;
	}[];
	isActive: boolean;
}
