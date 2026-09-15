// src/features/classes/types/class.types.ts
export interface ClassSubjectResponseData {
	classSubjectId: string; // was `id` — fix to match real API field name
	classId: string;
	subjectId: string;
	staffId: string;
	subjectName: string;
	subjectCode: string | null;
	teacherName: string;
	createdAt: string;
}

export interface SubjectResponseData {
	id: string;
	name: string;
	code: string | null;
	description: string | null;
	createdAt: string;
}
export interface ClassSubjectResponseData {
	id: string;
	classId: string;
	subjectId: string;
	staffId: string;
	subjectName: string;   // NEW
	subjectCode: string | null; // NEW
	teacherName: string;   // NEW
	createdAt: string;
}

export interface CreateClassDto {
	name: string;
	level?: string;
	capacity?: number;
}

export type UpdateClassDto = Partial<CreateClassDto>;

export interface CreateSubjectDto {
	name: string;
	code?: string;
	description?: string;
}

export type UpdateSubjectDto = Partial<CreateSubjectDto>;

export interface AssignSubjectDto {
	subjectId: string;
	staffId: string;
}

export interface ClassProgressionResponseData {
	id: string;
	fromClassId: string;
	fromClassName: string;
	toClassId: string | null;
	toClassName: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface SetClassProgressionDto {
	toClassId: string | null; // null clears the progression (e.g. a terminal class like SS3)
}