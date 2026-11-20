export type Gender = "male" | "female";
export type StaffCategory = "teaching" | "non_teaching";
export type EmploymentType = "full_time" | "part_time" | "contract" | "volunteer";
export type StaffStatusFilter = "active" | "inactive" | "all";
export type PortalStatus = "none" | "invited" | "active" | "suspended";

export interface StaffBranchRef {
	id: string;
	name: string;
	code: string | null;
	isPrimary: boolean;
}

/** A staff record as GET /staff and GET /staff/:id return it (docs/backend/modules/staff.md section 6). */
export interface StaffResponseData {
	id: string;
	employeeId: string | null;
	firstName: string;
	lastName: string;
	middleName: string | null;
	fullName: string;
	email: string | null;
	phone: string | null;
	photoUrl: string | null;
	gender: Gender | null;
	dateOfBirth: string | null;
	address: string | null;
	department: string | null;
	designation: string | null;
	qualification: string | null;
	category: StaffCategory;
	employmentType: EmploymentType;
	joinDate: string | null;
	exitDate: string | null;
	exitReason: string | null;
	isActive: boolean;
	branches: StaffBranchRef[];
	/** Portal login state is separate from employment status: a staff record can exist with no login at all. */
	portal: { status: PortalStatus; roles: Array<{ id: string; name: string }> };
	createdAt: string;
}

/** POST /staff. A login is never created here; `invite` (needs an email) sends the portal invitation straight away. */
export interface CreateStaffDto {
	firstName: string;
	lastName: string;
	middleName?: string;
	email?: string;
	phone?: string;
	gender?: Gender;
	dateOfBirth?: string;
	address?: string;
	department?: string;
	designation?: string;
	qualification?: string;
	category?: StaffCategory;
	employmentType?: EmploymentType;
	joinDate?: string;
	employeeId?: string;
	branchIds?: string[];
	/** Send true only after the user confirmed a POSSIBLE_DUPLICATE_STAFF warning. */
	confirmNotDuplicate?: boolean;
	invite?: { roleId: string };
}

/** The created record, plus how the optional invitation went. The record exists even when the invite failed. */
export type CreateStaffResult = StaffResponseData & { invite?: { status: "sent" | "failed"; code?: string } };

/** PUT /staff/:id. Nullable fields can be cleared with null; at least one field is required. */
export type UpdateStaffDto = Partial<{
	firstName: string;
	lastName: string;
	middleName: string | null;
	email: string | null;
	phone: string | null;
	gender: Gender | null;
	dateOfBirth: string | null;
	address: string | null;
	department: string | null;
	designation: string | null;
	qualification: string | null;
	category: StaffCategory;
	employmentType: EmploymentType;
	joinDate: string | null;
	employeeId: string;
}>;

export interface ListStaffParams {
	page?: number;
	limit?: number;
	search?: string;
	category?: StaffCategory;
	employmentType?: EmploymentType;
	department?: string;
	branchId?: string;
	/** Server default is "active". */
	status?: StaffStatusFilter;
}

export interface DeactivateStaffDto {
	exitDate?: string;
	exitReason?: string;
}

/** POST /staff/:id/deactivate. `activeAssignments` classes/subjects still need a new teacher. */
export interface DeactivateStaffResult {
	staff: StaffResponseData;
	warnings: { activeAssignments: number };
}

export interface SetStaffBranchesDto {
	branchIds: string[];
	primaryBranchId?: string;
}

export interface StaffBranchesResult {
	staffId: string;
	branchIds: string[];
	primaryBranchId: string | null;
}

export interface StaffRolesResult {
	staffId: string;
	roleIds: string[];
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

export interface MyHomeroomClassResponseData {
	classId: string;
	className: string;
	studentCount: number;
}

export interface MySubjectClassResponseData {
	classId: string;
	className: string;
	subjects: MyClassSubjectData[];
}

export interface MyClassesResponse {
	classesAsClassTeacher: MyHomeroomClassResponseData[];
	classesAsSubjectTeacher: MySubjectClassResponseData[];
}

/*
| Picker data (docs/backend/modules/staff.md, "Assignable roles" and "Assignable branches"). Both need `staff.manage` only,
| answer for the signed-in person, and must be loaded when the picker opens, never cached across users or sessions.
| The backend declares the same shapes as AssignableStaffRole / AssignableBranch in @schoolos/contracts (on refactor/api).
*/
export interface AssignableStaffRole {
	id: string;
	name: string;
	description: string | null;
	kind: "SYSTEM_LOCKED" | "SYSTEM_EDITABLE" | "CUSTOM";
	/** Holds every permission (School Admin). Show it as an administrator role. */
	grantsAll: boolean;
}

export interface AssignableBranch {
	id: string;
	name: string;
	code: string;
	isMain: boolean;
}
