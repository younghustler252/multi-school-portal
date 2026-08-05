import { GuardianResponseData, GuardianRelation } from "@/features/guardians/types/guardian.types";

export type Gender = "male" | "female";


export interface StudentResponseData {
	id: string;
	userId: string | null;
	admissionNumber: string | null;
	firstName: string;
	lastName: string;
	middleName: string | null;
	dateOfBirth: string | null;
	gender: Gender | null;
	bloodGroup: string | null;
	address: string | null;
	photoUrl: string | null;
	religion: string | null;
	nationality: string | null;
	stateOfOrigin: string | null;
	isActive: boolean;
	admittedAt: string | null;
	createdAt: string;
}

export interface CreateStudentDto {
	firstName: string;
	lastName: string;
	middleName?: string;
	admissionNumber?: string;
	dateOfBirth?: string;
	gender?: Gender;
	bloodGroup?: string;
	address?: string;
	religion?: string;
	nationality?: string;
	stateOfOrigin?: string;
	admittedAt?: string;

	guardianFirstName?: string;
	guardianLastName?: string;
	guardianEmail?: string;
	guardianPhone?: string;
	guardianRelation?: GuardianRelation;
}

export type UpdateStudentDto = Partial<Omit<CreateStudentDto,
	"guardianFirstName" | "guardianLastName" | "guardianEmail" | "guardianPhone" | "guardianRelation"
>>;

export interface ListStudentsParams {
	page?: number;
	limit?: number;
	gender?: Gender;
	isActive?: boolean;
	search?: string;
}

export interface UploadPhotoResponseData {
	url: string;
}


export interface StudentGuardianLinkResponseData extends GuardianResponseData {
	relation: GuardianRelation;
	isPrimary: boolean;
}

export interface StudentWithGuardiansResponseData extends StudentResponseData {
	guardians: StudentGuardianLinkResponseData[];
}