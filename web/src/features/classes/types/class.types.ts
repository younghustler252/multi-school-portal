export interface ClassResponseData {
	id: string;
	name: string;
	level: string | null;
	capacity: number | null;
	classTeacherId: string | null;
	studentCount: number;
	classTeacherName: string | null ;
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