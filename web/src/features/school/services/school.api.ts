import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	SchoolResponseData,
	UpdateSchoolDto,
	SetupChecklist,
	UploadFileResponseData,
	SchoolDashboardData,
	PublicSchoolInfo,
} from "../types/school.types";
import { SchoolDocumentResponseData } from "../types/school-document.types";


export const schoolApi = {

	getMySchool: (): Promise<ApiResponse<SchoolResponseData>> =>
		API.get("/schools/me"),

	updateMySchool: (data: UpdateSchoolDto): Promise<ApiResponse<SchoolResponseData>> =>
		API.put("/schools/me", data),

	uploadLogo: (file: File): Promise<ApiResponse<UploadFileResponseData>> => {
		const formData = new FormData();
		formData.append("logo", file);
		return API.post("/schools/me/logo", formData, {
			headers: { "Content-Type": "multipart/form-data" },
		});
	},

	getMyDocuments: (): Promise<ApiResponse<SchoolDocumentResponseData[]>> =>
		API.get("/schools/me/documents"),

	uploadDocument: (file: File, type: string): Promise<ApiResponse<SchoolDocumentResponseData>> => {
		const formData = new FormData();
		formData.append("document", file);
		formData.append("type", type);
		return API.post("/schools/me/documents", formData, {
			headers: { "Content-Type": "multipart/form-data" },
		});
	},

	getSetupChecklist: (): Promise<ApiResponse<SetupChecklist>> =>
		API.get("/schools/me/setup-checklist"),

	getDashboard: (): Promise<ApiResponse<SchoolDashboardData>> =>
		API.get("/schools/me/dashboard"),


	getPublicInfo: (subdomain: string): Promise<ApiResponse<PublicSchoolInfo>> =>
		API.get(`/schools/public/${subdomain}`),

	
};