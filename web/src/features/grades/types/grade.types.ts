export interface GradeResponseData {
	id: string;
	studentId: string;
	termId: string;
	classSubjectId: string;
	caScore: number | null;
	examScore: number | null;
	total: number | null;
	grade: string | null;
	remark: string | null;
	position: number | null;
	totalStudents: number | null;
	isPublished: boolean;
	createdAt: string;
}

export interface EnterGradeDto {
	studentId: string;
	termId: string;
	classSubjectId: string;
	caScore?: number;
	examScore?: number;
}

export interface BulkGradeRecord {
	studentId: string;
	caScore?: number;
	examScore?: number;
}

export interface BulkEnterGradesDto {
	termId: string;
	classSubjectId: string;
	grades: BulkGradeRecord[];
}

export interface UpdateGradeDto {
	caScore?: number;
	examScore?: number;
}

export interface PublishGradesDto {
	termId: string;
	classSubjectId?: string;
}

export interface ListGradesParams {
	page?: number;
	limit?: number;
	studentId?: string;
	termId?: string;
	classSubjectId?: string;
	isPublished?: boolean;
}

export interface GradingConfigRow {
	minScore: number;
	maxScore: number;
	grade: string;
	remark: string;
}

export interface UpdateGradingConfigDto {
	configs: GradingConfigRow[];
}