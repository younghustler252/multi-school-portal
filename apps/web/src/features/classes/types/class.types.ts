// src/features/classes/types/class.types.ts

export interface ClassResponseData {
	id: string;
	name: string;
	level: string | null;
	capacity: number | null;
	classTeacherId: string | null;
	classTeacherName: string | null;
	studentCount: number;
	toClassId: string | null;
	toClassName: string | null;
	createdAt: string;
}
export interface ClassSubjectResponseData {
	id: string | null; // null when this subject has no ClassSubject row yet
	classId: string;
	subjectId: string;
	staffId: string | null;
	termId: string;
	assignedVia: "manual" | "auto_subject_default" | "auto_homeroom" | null;
	createdAt: string | null;
	updatedAt: string | null;
}

export interface EnrichedClassSubject {
	classSubjectId: string | null;
	classId: string;
	subjectId: string;
	subjectName: string;
	subjectCode: string | null;
	staffId: string | null;
	teacherName: string | null;
	termId: string;
	assignedVia: "manual" | "auto_subject_default" | "auto_homeroom" | null;
}

export interface SubjectResponseData {
	id: string;
	name: string;
	code: string | null;
	description: string | null;
	defaultTeacherId: string | null;
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

/**
 * Assign a subject to a class for a specific term.
 */
export interface AssignSubjectDto {
	subjectId: string;
	staffId: string;
	termId: string;
}

/**
 * Bulk assign subjects to a class for a specific term.
 */
export interface BulkAssignSubjectsDto {
	staffId: string;
	termId: string;
	subjectIds: string[];
}

/**
 * Update an existing class-subject assignment.
 */
export interface UpdateClassSubjectDto {
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
	toClassId: string | null;
}

export interface ApplyTeachingDefaultsDto {
	classId: string;
	termId: string;
}

export interface ApplyTeachingDefaultsResult {
	updated: number;
	skipped: number; // rows left alone because assignedVia === "manual"
}
