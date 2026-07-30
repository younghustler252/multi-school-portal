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
}

export interface UploadFileResponseData {
	url: string;
}