export interface PromotionPreviewRow {
	studentId: string;
	studentName: string;
	fromClassId: string;
	fromClassName: string;
	toClassId: string | null;
	toClassName: string | null;
}


export interface PromotionPreviewDto {
	termId: string;
}

export type PromotionOverrideAction = "promote" | "repeat" | "graduate" | "exclude";

export interface PromotionOverride {
	studentId: string;
	action: PromotionOverrideAction;
	classId?: string;
}

export interface PromoteStudentsDto {
	currentTermId: string;
	newTermId: string;
	rows: { studentId: string; fromClassId: string; toClassId: string | null }[];
	overrides: PromotionOverride[];
}

export interface PromoteStudentsResult {
	promoted: number;
	repeated: number;
	graduated: number;
	excluded: number;
}

export type PromotionPreviewResponseData = PromotionPreviewRow[];