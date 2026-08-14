export type StaffRole = "school_admin" | "principal" | "teacher" | "bursar" | "other";
export type Gender = "male" | "female";

export interface StaffResponseData {
	id: string;
	userId: string;
	employeeId: string | null;
	firstName: string | null;
	lastName: string | null;
	email: string | undefined;
	phone: string | null;
	photoUrl: string | null;
	role: StaffRole;
	department: string | null;
	designation: string | null;
	qualification: string | null;
	gender: Gender | null;
	dateOfBirth: string | null;
	address: string | null;
	joinDate: string | null;
	isActive: boolean;
	createdAt: string;
}

export interface CreateStaffDto {
	email: string;
	firstName: string;
	lastName: string;
	phone?: string;
	password?: string; // auto-generated if omitted

	role: StaffRole;
	employeeId?: string;
	department?: string;
	designation?: string;
	qualification?: string;
	gender?: Gender;
	dateOfBirth?: string;
	address?: string;
	joinDate?: string;
}

export type UpdateStaffDto = Partial<Omit<CreateStaffDto, "email" | "password">>;

export interface ListStaffParams {
	page?: number;
	limit?: number;
	role?: StaffRole;
	department?: string;
	search?: string;
	isActive?: boolean;
}

export interface StaffAssignmentResponseData {
	classSubjectId: string;
	classId: string;
	className: string;
	subjectId: string;
	subjectName: string;
	subjectCode: string | null;
}

export interface MyClassSubjectData {
	classSubjectId: string;
	subjectId: string;
	subjectName: string;
	subjectCode: string | null;
}

export interface MyClassResponseData {
	classId: string;
	className: string;
	subjects: MyClassSubjectData[];
}