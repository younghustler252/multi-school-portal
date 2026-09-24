export type ReportCardTemplate = "classic" | "modern" | "minimal" | "custom_letterhead";
export type TeachingModel = "homeroom" | "subject_specialist"


export interface SchoolSettingsResponseData {
	id: string;
	logoUrl: string | null;
	primaryColor: string | null;
	secondaryColor: string | null;
	motto: string | null;
	address: string | null;
	website: string | null;
	foundedYear: number | null;
	principalName: string | null;
	stamp: string | null;
	signature: string | null;
	reportCardTemplate: ReportCardTemplate | null;
	reportCardLetterheadUrl: string | null;
	letterheadContentTopMm: number | null;
	letterheadContentBottomMm: number | null;
	teachingModel: 	TeachingModel | null;
	updatedAt: string;
}

export interface UpdateSchoolSettingsDto {
	primaryColor?: string;
	secondaryColor?: string;
	motto?: string;
	address?: string;
	website?: string;
	foundedYear?: number;
	principalName?: string;
	reportCardTemplate?: ReportCardTemplate;
	reportCardLetterheadUrl?: string;
	letterheadContentTopMm?: number;
	letterheadContentBottomMm?: number;
	teachingModel: 	TeachingModel | null;
}

export interface UploadFileResponseData {
	url: string;
}